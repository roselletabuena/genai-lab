import { z } from "zod";

export const MAX_MESSAGE_CONTENT_LENGTH = 1000;
export const MAX_MESSAGES_COUNT = 20;

export const chatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(MAX_MESSAGE_CONTENT_LENGTH),
  })
  .strict();

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * Schema for standard chat requests (/portfolio/chat, /portfolio/chat/stream, Next.js /api/chat).
 * Supports multi-turn messages array or a direct single message string, with optional visitorId.
 * Rejects unexpected extra properties via strict validation.
 */
export const chatPayloadSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(MAX_MESSAGES_COUNT).optional(),
    message: z.string().min(1).max(MAX_MESSAGE_CONTENT_LENGTH).optional(),
    visitorId: z.string().min(1).max(256).optional(),
  })
  .strict()
  .refine((data) => (data.messages && data.messages.length > 0) || Boolean(data.message), {
    message: "Either 'messages' array or 'message' string must be provided",
    path: ["messages"],
  });

export type ChatPayload = z.infer<typeof chatPayloadSchema>;

/**
 * Normalizes a ChatPayload into a guaranteed ChatMessage array and optional visitorId.
 */
export function normalizeChatPayload(payload: ChatPayload): {
  messages: ChatMessage[];
  visitorId?: string;
} {
  const messages: ChatMessage[] =
    payload.messages && payload.messages.length > 0
      ? payload.messages
      : payload.message
        ? [{ role: "user", content: payload.message }]
        : [];
  return {
    messages,
    visitorId: payload.visitorId,
  };
}
