import { z } from "zod";
export declare const VISITOR_ID_HEADER = "x-visitor-id";
export declare const CLIENT_IP_HEADER = "x-client-ip";
export declare const INTERNAL_API_KEY_HEADER = "x-internal-api-key";
/**
 * Schema for incoming visitor session headers on Fastify/Next.js routes.
 */
export declare const visitorSessionHeaderSchema: z.ZodObject<
  {
    "x-visitor-id": z.ZodOptional<z.ZodString>;
    "x-client-ip": z.ZodOptional<z.ZodString>;
    "x-internal-api-key": z.ZodOptional<z.ZodString>;
  },
  z.core.$loose
>;
export type VisitorSessionHeaders = z.infer<typeof visitorSessionHeaderSchema>;
/**
 * Client-facing session parameters helper.
 */
export declare const clientSessionSchema: z.ZodObject<
  {
    visitorId: z.ZodOptional<z.ZodString>;
    clientIp: z.ZodOptional<z.ZodString>;
    internalApiKey: z.ZodOptional<z.ZodString>;
  },
  z.core.$strict
>;
export type ClientSession = z.infer<typeof clientSessionSchema>;
/**
 * Converts a client session object to standard HTTP headers.
 */
export declare function toSessionHeaders(session: {
  visitorId?: string;
  clientIp?: string;
  internalApiKey?: string;
}): Record<string, string>;
//# sourceMappingURL=visitor.d.ts.map
