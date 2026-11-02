import { z } from "zod";
import { chatMessageSchema, MAX_MESSAGE_CONTENT_LENGTH, MAX_MESSAGES_COUNT } from "./chat";

export const suggestedPromptsPayloadSchema = z
  .object({
    conversation: z.array(chatMessageSchema).max(MAX_MESSAGES_COUNT),
    lastMessage: z.string().min(1).max(MAX_MESSAGE_CONTENT_LENGTH),
  })
  .strict();

export type SuggestedPromptsPayload = z.infer<typeof suggestedPromptsPayloadSchema>;

export const suggestedPromptsResponseSchema = z
  .object({
    prompts: z.array(z.string()),
  })
  .strict();

export type SuggestedPromptsResponse = z.infer<typeof suggestedPromptsResponseSchema>;
