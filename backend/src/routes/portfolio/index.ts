import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { chat, chatStream, invokeSingleTurnPrompt, GUARDRAIL_FALLBACK } from "../../lib/bedrock";
import { buildSuggestedPrompt } from "../../prompts/portfolio.prompt";
import { trackUserInteraction, getPortfolioStats } from "../../services/portfolioService";
import { isAuthorized } from "../../utils/auth";
import {
  chatPayloadSchema,
  suggestedPromptsPayloadSchema,
  ChatPayload,
  SuggestedPromptsPayload,
  INVALID_PAYLOAD_ERROR,
  formatZodError,
  normalizeChatPayload,
  VISITOR_ID_HEADER,
  CLIENT_IP_HEADER,
} from "@genai-lab/contracts";
import { z } from "zod";

const CONVERSATION_LIMIT = 10;

function isRateLimitedOrThrottled(err: any): boolean {
  return (
    err?.name === "ThrottlingException" ||
    err?.name === "TooManyRequestsException" ||
    err?.name === "ProvisionedThroughputExceededException" ||
    err?.name === "RequestLimitExceeded" ||
    err?.code === "ThrottlingException"
  );
}

function trackVisitor(request: FastifyRequest, payloadVisitorId?: string): void {
  const visitorId =
    payloadVisitorId && payloadVisitorId.trim() !== ""
      ? payloadVisitorId.trim()
      : request.headers[VISITOR_ID_HEADER];
  if (typeof visitorId === "string" && visitorId.trim() !== "") {
    void trackUserInteraction(visitorId.trim());
  }

  const rawClientIp = request.headers[CLIENT_IP_HEADER];
  const clientIp = Array.isArray(rawClientIp) ? rawClientIp[0] : rawClientIp;
  if (typeof clientIp === "string" && clientIp.trim() !== "") {
    request.log.info({ clientIp: clientIp.trim() }, "Incoming chat request client IP");
  }
}

const validatePayload = <T>(schema: z.ZodType<T>) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: INVALID_PAYLOAD_ERROR,
        details: formatZodError(result.error),
      });
    }
    request.body = result.data;
  };
};

const portfolio: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: ChatPayload }>(
    "/chat",
    { preValidation: validatePayload(chatPayloadSchema) },
    async (request, reply) => {
      const normalized = normalizeChatPayload(request.body);
      trackVisitor(request, normalized.visitorId);

      try {
        const truncatedMessages = normalized.messages.slice(-CONVERSATION_LIMIT);
        return await chat(truncatedMessages);
      } catch (err: any) {
        request.log.error(err);
        if (isRateLimitedOrThrottled(err)) {
          return reply.code(429).send({
            error: "Bedrock rate limit exceeded",
            details: err instanceof Error ? err.message : "Rate limit exceeded",
          });
        }
        return reply.code(500).send({
          error: "Failed to process portfolio question",
          details: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  );

  /**
   * POST /portfolio/chat/stream
   *
   * Server-Sent Events endpoint. Streams tokens as they arrive from Bedrock.
   * Each frame is a JSON-encoded StreamChunk:
   *   { type: "token",    text: "..." }     — a text token
   *   { type: "guardrail" }                 — client should show the guardrail fallback
   *   { type: "done",    uiWidget?: {...} } — stream complete; optional widget payload
   *   { type: "error",   message: "..." }   — something went wrong
   *
   * GUARDRAIL_FALLBACK text: see lib/bedrock/chatOrchestrator.ts
   */
  fastify.post<{ Body: ChatPayload }>(
    "/chat/stream",
    { preValidation: validatePayload(chatPayloadSchema) },
    async (request, reply) => {
      const normalized = normalizeChatPayload(request.body);
      trackVisitor(request, normalized.visitorId);

      reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no"); // prevent nginx buffering
      reply.raw.flushHeaders();

      const writeChunk = (data: object) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const truncatedMessages = normalized.messages.slice(-CONVERSATION_LIMIT);
        const stream = chatStream(truncatedMessages);

        for await (const chunk of stream) {
          if (chunk.type === "guardrail") {
            writeChunk({ type: "guardrail", fallback: GUARDRAIL_FALLBACK });
          } else {
            writeChunk(chunk);
          }
        }
      } catch (err: any) {
        request.log.error(err);
        writeChunk({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to process portfolio question",
        });
      } finally {
        reply.raw.end();
      }
    }
  );

  fastify.get("/stats", {}, async (request, reply) => {
    if (!isAuthorized(request.headers)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    try {
      const stats = await getPortfolioStats();
      return reply.send(stats);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: "Failed to retrieve portfolio stats",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  fastify.post<{ Body: SuggestedPromptsPayload }>(
    "/suggested-prompts",
    { preValidation: validatePayload(suggestedPromptsPayloadSchema) },
    async (request, reply) => {
      trackVisitor(request);
      const { conversation, lastMessage } = request.body;

      const prompt = buildSuggestedPrompt(conversation, lastMessage);
      if (prompt == null) return {};

      try {
        const raw = await invokeSingleTurnPrompt(prompt);
        return reply.send(JSON.parse(raw));
      } catch (err: any) {
        request.log.error(err);
        if (isRateLimitedOrThrottled(err)) {
          return reply.code(429).send({
            error: "Bedrock rate limit exceeded",
            details: err instanceof Error ? err.message : "Rate limit exceeded",
          });
        }
        return reply.code(500).send({
          error: "Invalid model response",
          details: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  );
};

export default portfolio;
