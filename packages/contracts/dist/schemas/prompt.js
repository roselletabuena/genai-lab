"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestedPromptsResponseSchema = exports.suggestedPromptsPayloadSchema = void 0;
const zod_1 = require("zod");
const chat_1 = require("./chat");
exports.suggestedPromptsPayloadSchema = zod_1.z
  .object({
    conversation: zod_1.z.array(chat_1.chatMessageSchema).max(chat_1.MAX_MESSAGES_COUNT),
    lastMessage: zod_1.z.string().min(1).max(chat_1.MAX_MESSAGE_CONTENT_LENGTH),
  })
  .strict();
exports.suggestedPromptsResponseSchema = zod_1.z
  .object({
    prompts: zod_1.z.array(zod_1.z.string()),
  })
  .strict();
//# sourceMappingURL=prompt.js.map
