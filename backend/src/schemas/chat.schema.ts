import { z } from "zod";

/**
 * Maximum character length allowed for an individual chat message content.
 * Set to 1,000 characters (N = 1000), which sits comfortably above real
 * portfolio queries (typically 50-300 characters) while capping unbounded
 * token consumption, prompt injection bloat, and memory overhead.
 */
export const MAX_MESSAGE_CONTENT_LENGTH = 1000;

/**
 * Maximum number of messages allowed in a chat conversation payload.
 * Set to 20 messages (M = 20), which accommodates typical multi-turn
 * portfolio discussions while bounding request payload size and processing time.
 */
export const MAX_MESSAGES_COUNT = 20;

/**
 * Generic error message returned on validation failure.
 * Must not echo user input back in the response body.
 */
export const INVALID_PAYLOAD_ERROR = "Invalid request payload";

/**
 * Schema for an individual chat message.
 * Strict enum of "user" | "assistant" and 1..N character content constraint.
 */
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_MESSAGE_CONTENT_LENGTH),
});

/**
 * Schema for standard chat requests (/portfolio/chat, /portfolio/chat/stream, streamHandler).
 * Requires an array of 1..M valid chat messages.
 */
export const chatPayloadSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(MAX_MESSAGES_COUNT),
});

/**
 * Schema for suggested prompts requests (/portfolio/suggested-prompts).
 * Accepts conversation history (0..M messages) and the assistant's last message (1..N characters).
 */
export const suggestedPromptsPayloadSchema = z.object({
  conversation: z.array(chatMessageSchema).max(MAX_MESSAGES_COUNT),
  lastMessage: z.string().min(1).max(MAX_MESSAGE_CONTENT_LENGTH),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatPayload = z.infer<typeof chatPayloadSchema>;
export type SuggestedPromptsPayload = z.infer<typeof suggestedPromptsPayloadSchema>;
