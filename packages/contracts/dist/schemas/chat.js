"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatPayloadSchema =
  exports.chatMessageSchema =
  exports.MAX_MESSAGES_COUNT =
  exports.MAX_MESSAGE_CONTENT_LENGTH =
    void 0;
exports.normalizeChatPayload = normalizeChatPayload;
const zod_1 = require("zod");
exports.MAX_MESSAGE_CONTENT_LENGTH = 1000;
exports.MAX_MESSAGES_COUNT = 20;
exports.chatMessageSchema = zod_1.z
  .object({
    role: zod_1.z.enum(["user", "assistant"]),
    content: zod_1.z.string().min(1).max(exports.MAX_MESSAGE_CONTENT_LENGTH),
  })
  .strict();
/**
 * Schema for standard chat requests (/portfolio/chat, /portfolio/chat/stream, Next.js /api/chat).
 * Supports multi-turn messages array or a direct single message string, with optional visitorId.
 * Rejects unexpected extra properties via strict validation.
 */
exports.chatPayloadSchema = zod_1.z
  .object({
    messages: zod_1.z
      .array(exports.chatMessageSchema)
      .min(1)
      .max(exports.MAX_MESSAGES_COUNT)
      .optional(),
    message: zod_1.z.string().min(1).max(exports.MAX_MESSAGE_CONTENT_LENGTH).optional(),
    visitorId: zod_1.z.string().min(1).max(256).optional(),
  })
  .strict()
  .refine((data) => (data.messages && data.messages.length > 0) || Boolean(data.message), {
    message: "Either 'messages' array or 'message' string must be provided",
    path: ["messages"],
  });
/**
 * Normalizes a ChatPayload into a guaranteed ChatMessage array and optional visitorId.
 */
function normalizeChatPayload(payload) {
  const messages =
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
//# sourceMappingURL=chat.js.map
