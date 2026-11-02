import { z } from "zod";
export declare const suggestedPromptsPayloadSchema: z.ZodObject<
  {
    conversation: z.ZodArray<
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
    >;
    lastMessage: z.ZodString;
  },
  z.core.$strict
>;
export type SuggestedPromptsPayload = z.infer<typeof suggestedPromptsPayloadSchema>;
export declare const suggestedPromptsResponseSchema: z.ZodObject<
  {
    prompts: z.ZodArray<z.ZodString>;
  },
  z.core.$strict
>;
export type SuggestedPromptsResponse = z.infer<typeof suggestedPromptsResponseSchema>;
//# sourceMappingURL=prompt.d.ts.map
