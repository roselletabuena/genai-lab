import { FastifyPluginAsync, FastifyRequest } from "fastify";
import { chat, chatStream, invokeSingleTurnPrompt, GUARDRAIL_FALLBACK } from "../../lib/bedrock";
import { buildSuggestedPrompt } from "../../prompts/portfolio.prompt";
import { trackUserInteraction, getPortfolioStats } from "../../services/portfolioService";
import { ChatMessage } from "../../types/portfolio";
import { isAuthorized } from "../../utils/auth";

const CONVERSATION_LIMIT = 10;

interface ChatBody {
  messages: ChatMessage[];
}

const chatSchema = {
  body: {
    type: "object",
    required: ["messages"],
    properties: {
      messages: {
        type: "array",
        items: {
          type: "object",
          required: ["role", "content"],
          properties: {
            role: { type: "string", enum: ["user", "assistant"] },
            content: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
};

function trackVisitor(request: FastifyRequest): void {
  const visitorId = request.headers["x-visitor-id"];
  if (typeof visitorId === "string" && visitorId.trim() !== "") {
    void trackUserInteraction(visitorId.trim());
  }
}

const portfolio: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: ChatBody }>("/chat", { schema: chatSchema }, async (request, reply) => {
    trackVisitor(request);

    try {
      const truncatedMessages = request.body.messages.slice(-CONVERSATION_LIMIT);
      return await chat(truncatedMessages);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: "Failed to process portfolio question",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

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
  fastify.post<{ Body: ChatBody }>(
    "/chat/stream",
    { schema: chatSchema },
    async (request, reply) => {
      trackVisitor(request);

      reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no"); // prevent nginx buffering
      reply.raw.flushHeaders();

      const writeChunk = (data: object) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const truncatedMessages = request.body.messages.slice(-CONVERSATION_LIMIT);
        const stream = chatStream(truncatedMessages);

        for await (const chunk of stream) {
          if (chunk.type === "guardrail") {
            writeChunk({ type: "guardrail", fallback: GUARDRAIL_FALLBACK });
          } else {
            writeChunk(chunk);
          }
        }
      } catch (err) {
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

  fastify.post<{
    Body: { conversation: ChatMessage[]; lastMessage: string };
  }>("/suggested-prompts", {}, async (request, reply) => {
    const { conversation, lastMessage } = request.body;

    const prompt = buildSuggestedPrompt(conversation, lastMessage);
    if (prompt == null) return {};

    const raw = await invokeSingleTurnPrompt(prompt);

    try {
      return reply.send(JSON.parse(raw));
    } catch {
      return reply.code(500).send({ error: "Invalid model response", raw });
    }
  });
};

export default portfolio;
