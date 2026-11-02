import { z } from "zod";

export const VISITOR_ID_HEADER = "x-visitor-id";
export const CLIENT_IP_HEADER = "x-client-ip";
export const INTERNAL_API_KEY_HEADER = "x-internal-api-key";

/**
 * Schema for incoming visitor session headers on Fastify/Next.js routes.
 */
export const visitorSessionHeaderSchema = z
  .object({
    "x-visitor-id": z.string().min(1).max(256).optional(),
    "x-client-ip": z.string().min(1).max(128).optional(),
    "x-internal-api-key": z.string().min(1).optional(),
  })
  .passthrough();

export type VisitorSessionHeaders = z.infer<typeof visitorSessionHeaderSchema>;

/**
 * Client-facing session parameters helper.
 */
export const clientSessionSchema = z
  .object({
    visitorId: z.string().min(1).max(256).optional(),
    clientIp: z.string().min(1).max(128).optional(),
    internalApiKey: z.string().min(1).optional(),
  })
  .strict();

export type ClientSession = z.infer<typeof clientSessionSchema>;

/**
 * Converts a client session object to standard HTTP headers.
 */
export function toSessionHeaders(session: {
  visitorId?: string;
  clientIp?: string;
  internalApiKey?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (session.visitorId && session.visitorId.trim() !== "") {
    headers[VISITOR_ID_HEADER] = session.visitorId.trim();
  }
  if (session.clientIp && session.clientIp.trim() !== "") {
    headers[CLIENT_IP_HEADER] = session.clientIp.trim();
  }
  if (session.internalApiKey && session.internalApiKey.trim() !== "") {
    headers[INTERNAL_API_KEY_HEADER] = session.internalApiKey.trim();
  }
  return headers;
}
