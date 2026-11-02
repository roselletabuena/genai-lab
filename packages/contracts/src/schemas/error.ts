import { z } from "zod";

export const INVALID_PAYLOAD_ERROR = "Invalid request payload";

export const validationErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const validationErrorResponseSchema = z.object({
  error: z.string(),
  details: z.array(validationErrorDetailSchema).optional(),
});

export type ValidationErrorDetail = z.infer<typeof validationErrorDetailSchema>;
export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;

export function formatZodError(error: z.ZodError): ValidationErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "root",
    message: issue.message,
  }));
}
