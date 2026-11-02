import { z } from "zod";
export declare const MAX_MESSAGE_CONTENT_LENGTH = 1000;
export declare const MAX_MESSAGES_COUNT = 20;
export declare const chatMessageSchema: z.ZodObject<
  {
    role: z.ZodEnum<{
      user: "user";
      assistant: "assistant";
    }>;
    content: z.ZodString;
  },
  z.core.$strict
>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
/**
 * Schema for standard chat requests (/portfolio/chat, /portfolio/chat/stream, Next.js /api/chat).
 * Supports multi-turn messages array or a direct single message string, with optional visitorId.
 * Rejects unexpected extra properties via strict validation.
 */
export declare const chatPayloadSchema: z.ZodObject<
  {
    messages: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            role: z.ZodEnum<{
              user: "user";
              assistant: "assistant";
            }>;
            content: z.ZodString;
          },
          z.core.$strict
        >
      >
    >;
    message: z.ZodOptional<z.ZodString>;
    visitorId: z.ZodOptional<z.ZodString>;
  },
  z.core.$strict
>;
export type ChatPayload = z.infer<typeof chatPayloadSchema>;
/**
 * Normalizes a ChatPayload into a guaranteed ChatMessage array and optional visitorId.
 */
export declare function normalizeChatPayload(payload: ChatPayload): {
  messages: ChatMessage[];
  visitorId?: string;
};
//# sourceMappingURL=chat.d.ts.map
