import crypto from "crypto";

export type HeadersInput =
  | Record<string, string | string[] | undefined>
  | NodeJS.Dict<string | string[]>
  | null
  | undefined;

/**
 * Validates whether incoming request headers contain a valid x-internal-api-key.
 *
 * Guarantees:
 * 1. Fail closed: returns false if expectedKey / INTERNAL_API_KEY is not set or empty.
 * 2. Case-insensitive lookup for 'x-internal-api-key' header.
 * 3. Constant-time comparison using crypto.timingSafeEqual to prevent timing attacks.
 */
export function isAuthorized(
  headers?: HeadersInput,
  expectedKey: string | undefined = process.env.INTERNAL_API_KEY
): boolean {
  if (!expectedKey || expectedKey.trim() === "") {
    return false;
  }

  if (!headers) {
    return false;
  }

  let receivedKey: string | undefined;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "x-internal-api-key") {
      if (Array.isArray(value)) {
        receivedKey = value[0];
      } else if (typeof value === "string") {
        receivedKey = value;
      }
      break;
    }
  }

  if (!receivedKey || receivedKey.trim() === "") {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedKey);
  const receivedBuffer = Buffer.from(receivedKey);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
