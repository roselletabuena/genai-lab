"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientSessionSchema =
  exports.visitorSessionHeaderSchema =
  exports.INTERNAL_API_KEY_HEADER =
  exports.CLIENT_IP_HEADER =
  exports.VISITOR_ID_HEADER =
    void 0;
exports.toSessionHeaders = toSessionHeaders;
const zod_1 = require("zod");
exports.VISITOR_ID_HEADER = "x-visitor-id";
exports.CLIENT_IP_HEADER = "x-client-ip";
exports.INTERNAL_API_KEY_HEADER = "x-internal-api-key";
/**
 * Schema for incoming visitor session headers on Fastify/Next.js routes.
 */
exports.visitorSessionHeaderSchema = zod_1.z
  .object({
    "x-visitor-id": zod_1.z.string().min(1).max(256).optional(),
    "x-client-ip": zod_1.z.string().min(1).max(128).optional(),
    "x-internal-api-key": zod_1.z.string().min(1).optional(),
  })
  .passthrough();
/**
 * Client-facing session parameters helper.
 */
exports.clientSessionSchema = zod_1.z
  .object({
    visitorId: zod_1.z.string().min(1).max(256).optional(),
    clientIp: zod_1.z.string().min(1).max(128).optional(),
    internalApiKey: zod_1.z.string().min(1).optional(),
  })
  .strict();
/**
 * Converts a client session object to standard HTTP headers.
 */
function toSessionHeaders(session) {
  const headers = {};
  if (session.visitorId && session.visitorId.trim() !== "") {
    headers[exports.VISITOR_ID_HEADER] = session.visitorId.trim();
  }
  if (session.clientIp && session.clientIp.trim() !== "") {
    headers[exports.CLIENT_IP_HEADER] = session.clientIp.trim();
  }
  if (session.internalApiKey && session.internalApiKey.trim() !== "") {
    headers[exports.INTERNAL_API_KEY_HEADER] = session.internalApiKey.trim();
  }
  return headers;
}
//# sourceMappingURL=visitor.js.map
