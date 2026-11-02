"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationErrorResponseSchema =
  exports.validationErrorDetailSchema =
  exports.INVALID_PAYLOAD_ERROR =
    void 0;
exports.formatZodError = formatZodError;
const zod_1 = require("zod");
exports.INVALID_PAYLOAD_ERROR = "Invalid request payload";
exports.validationErrorDetailSchema = zod_1.z.object({
  path: zod_1.z.string(),
  message: zod_1.z.string(),
});
exports.validationErrorResponseSchema = zod_1.z.object({
  error: zod_1.z.string(),
  details: zod_1.z.array(exports.validationErrorDetailSchema).optional(),
});
function formatZodError(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "root",
    message: issue.message,
  }));
}
//# sourceMappingURL=error.js.map
