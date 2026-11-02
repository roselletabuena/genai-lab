import { z } from "zod";
export declare const INVALID_PAYLOAD_ERROR = "Invalid request payload";
export declare const validationErrorDetailSchema: z.ZodObject<
  {
    path: z.ZodString;
    message: z.ZodString;
  },
  z.core.$strip
>;
export declare const validationErrorResponseSchema: z.ZodObject<
  {
    error: z.ZodString;
    details: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            path: z.ZodString;
            message: z.ZodString;
          },
          z.core.$strip
        >
      >
    >;
  },
  z.core.$strip
>;
export type ValidationErrorDetail = z.infer<typeof validationErrorDetailSchema>;
export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;
export declare function formatZodError(error: z.ZodError): ValidationErrorDetail[];
//# sourceMappingURL=error.d.ts.map
