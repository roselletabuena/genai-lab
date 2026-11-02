import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isAuthorized } from "../src/utils/auth";

describe("isAuthorized helper", () => {
  const originalEnv = process.env.INTERNAL_API_KEY;

  beforeEach(() => {
    process.env.INTERNAL_API_KEY = "super-secret-key-12345";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INTERNAL_API_KEY = originalEnv;
    } else {
      delete process.env.INTERNAL_API_KEY;
    }
  });

  test("returns true for matching lowercase x-internal-api-key", () => {
    const result = isAuthorized({ "x-internal-api-key": "super-secret-key-12345" });
    assert.strictEqual(result, true);
  });

  test("returns true for matching Title-Case X-Internal-Api-Key", () => {
    const result = isAuthorized({ "X-Internal-Api-Key": "super-secret-key-12345" });
    assert.strictEqual(result, true);
  });

  test("returns true for matching uppercase X-INTERNAL-API-KEY", () => {
    const result = isAuthorized({ "X-INTERNAL-API-KEY": "super-secret-key-12345" });
    assert.strictEqual(result, true);
  });

  test("returns true for matching mixed-case header key", () => {
    const result = isAuthorized({ "x-InTeRnAl-ApI-kEy": "super-secret-key-12345" });
    assert.strictEqual(result, true);
  });

  test("returns true when header value is an array of strings", () => {
    const result = isAuthorized({ "x-internal-api-key": ["super-secret-key-12345"] });
    assert.strictEqual(result, true);
  });

  test("returns false when header key has invalid value (same length)", () => {
    const result = isAuthorized({ "x-internal-api-key": "wrong-secret-key-12345" });
    assert.strictEqual(result, false);
  });

  test("returns false when header key has invalid value (different length)", () => {
    const result = isAuthorized({ "x-internal-api-key": "short" });
    assert.strictEqual(result, false);
  });

  test("returns false when header key is missing", () => {
    const result = isAuthorized({ authorization: "Bearer token" });
    assert.strictEqual(result, false);
  });

  test("returns false when headers is empty object", () => {
    const result = isAuthorized({});
    assert.strictEqual(result, false);
  });

  test("returns false when headers is undefined or null", () => {
    assert.strictEqual(isAuthorized(undefined), false);
    assert.strictEqual(isAuthorized(null), false);
  });

  test("returns false when received header is empty string", () => {
    const result = isAuthorized({ "x-internal-api-key": "" });
    assert.strictEqual(result, false);
  });

  test("returns false when received header is whitespace string", () => {
    const result = isAuthorized({ "x-internal-api-key": "   " });
    assert.strictEqual(result, false);
  });

  test("fails closed (returns false) if INTERNAL_API_KEY is undefined", () => {
    delete process.env.INTERNAL_API_KEY;
    const result = isAuthorized({ "x-internal-api-key": "super-secret-key-12345" });
    assert.strictEqual(result, false);
  });

  test("fails closed (returns false) if INTERNAL_API_KEY is empty string", () => {
    process.env.INTERNAL_API_KEY = "";
    const result = isAuthorized({ "x-internal-api-key": "" });
    assert.strictEqual(result, false);
  });

  test("fails closed (returns false) if INTERNAL_API_KEY is whitespace", () => {
    process.env.INTERNAL_API_KEY = "    ";
    const result = isAuthorized({ "x-internal-api-key": "    " });
    assert.strictEqual(result, false);
  });

  test("allows custom expectedKey override in function call", () => {
    const result = isAuthorized({ "x-internal-api-key": "custom-key" }, "custom-key");
    assert.strictEqual(result, true);
  });
});
