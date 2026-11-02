import awsLambdaFastify from "@fastify/aws-lambda";
import { app } from "./app";
import { ChatMessage } from "./types/portfolio";
import { chatStream, GUARDRAIL_FALLBACK } from "./lib/bedrock";
import { trackUserInteraction } from "./services/portfolioService";
import { isAuthorized } from "./utils/auth";
import { chatPayloadSchema, INVALID_PAYLOAD_ERROR } from "./schemas/chat.schema";

/**
 * Standard handler — used by API Gateway for all existing routes.
 * @fastify/aws-lambda buffers the full response, which is fine for non-streaming routes.
 */
export const handler = awsLambdaFastify(app, {
  callbackWaitsForEmptyEventLoop: false,
  serializeLambdaArguments: false,
});

function sendStreamError(responseStream: any, statusCode: number, error: string): void {
  const metadata = {
    statusCode,
    headers: { "Content-Type": "application/json" },
  };
  const httpResponseStream =
    typeof (awslambda as any)?.HttpResponseStream?.from === "function"
      ? (awslambda as any).HttpResponseStream.from(responseStream, metadata)
      : responseStream;
  if (typeof httpResponseStream.setContentType === "function") {
    httpResponseStream.setContentType("application/json");
  }
  httpResponseStream.write(JSON.stringify({ error }));
  httpResponseStream.end();
}

/**
 * Streaming handler — used exclusively by the Lambda Function URL
 * (InvokeMode: RESPONSE_STREAM) for POST /portfolio/chat/stream.
 *
 * We bypass @fastify/aws-lambda here because it buffers the full response.
 * awslambda.streamifyResponse lets us write chunks to responseStream directly
 * as Bedrock produces them.
 */
export const streamHandler = (awslambda as any).streamifyResponse(
  async (event: any, responseStream: any) => {
    const CONVERSATION_LIMIT = 10;

    // ── CORS preflight ──────────────────────────────────────────────────────
    if (event.requestContext?.http?.method === "OPTIONS") {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({}));
      responseStream.end();
      return;
    }

    // ── Internal API Key validation ──────────────────────────────────────────
    if (!isAuthorized(event.headers)) {
      sendStreamError(responseStream, 401, "Unauthorized");
      return;
    }

    // ── Parse & validate body ────────────────────────────────────────────────
    let parsedBody: unknown;
    try {
      parsedBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      sendStreamError(responseStream, 400, INVALID_PAYLOAD_ERROR);
      return;
    }

    const parseResult = chatPayloadSchema.safeParse(parsedBody);
    if (!parseResult.success) {
      sendStreamError(responseStream, 400, INVALID_PAYLOAD_ERROR);
      return;
    }

    const messages: ChatMessage[] = parseResult.data.messages.slice(-CONVERSATION_LIMIT);

    // ── Visitor tracking (fire-and-forget) ────────────────────────────────────
    const visitorId = event.headers?.["x-visitor-id"];
    if (typeof visitorId === "string" && visitorId.trim() !== "") {
      void trackUserInteraction(visitorId.trim());
    }

    // ── SSE streaming ─────────────────────────────────────────────────────────
    // Lambda Function URL streaming requires setContentType before first write.
    responseStream.setContentType("text/event-stream; charset=utf-8");

    const writeChunk = (data: object) => {
      responseStream.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const stream = chatStream(messages);

      for await (const chunk of stream) {
        if (chunk.type === "guardrail") {
          writeChunk({ type: "guardrail", fallback: GUARDRAIL_FALLBACK });
        } else {
          writeChunk(chunk);
        }
      }
    } catch (err) {
      writeChunk({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to process request",
      });
    } finally {
      responseStream.end();
    }
  }
);
