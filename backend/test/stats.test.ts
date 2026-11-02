import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app";

describe("GET /portfolio/stats authorization", () => {
  const originalEnv = process.env.INTERNAL_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.INTERNAL_API_KEY = "stats-secret-key";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INTERNAL_API_KEY = originalEnv;
    } else {
      delete process.env.INTERNAL_API_KEY;
    }
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  test("rejects with 401 when header is missing in NODE_ENV=development", async () => {
    process.env.NODE_ENV = "development";
    const response = await app.inject({
      method: "GET",
      url: "/portfolio/stats",
    });
    assert.strictEqual(response.statusCode, 401);
    assert.deepStrictEqual(JSON.parse(response.body), { error: "Unauthorized" });
  });

  test("rejects with 401 when header is missing in NODE_ENV=dev", async () => {
    process.env.NODE_ENV = "dev";
    const response = await app.inject({
      method: "GET",
      url: "/portfolio/stats",
    });
    assert.strictEqual(response.statusCode, 401);
    assert.deepStrictEqual(JSON.parse(response.body), { error: "Unauthorized" });
  });

  test("rejects with 401 when header is missing in NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    const response = await app.inject({
      method: "GET",
      url: "/portfolio/stats",
    });
    assert.strictEqual(response.statusCode, 401);
    assert.deepStrictEqual(JSON.parse(response.body), { error: "Unauthorized" });
  });

  test("rejects with 401 when key is invalid", async () => {
    process.env.NODE_ENV = "development";
    const response = await app.inject({
      method: "GET",
      url: "/portfolio/stats",
      headers: {
        "x-internal-api-key": "invalid-key",
      },
    });
    assert.strictEqual(response.statusCode, 401);
    assert.deepStrictEqual(JSON.parse(response.body), { error: "Unauthorized" });
  });

  test("rejects with 401 when INTERNAL_API_KEY is unset (fail closed)", async () => {
    delete process.env.INTERNAL_API_KEY;
    const response = await app.inject({
      method: "GET",
      url: "/portfolio/stats",
      headers: {
        "x-internal-api-key": "stats-secret-key",
      },
    });
    assert.strictEqual(response.statusCode, 401);
    assert.deepStrictEqual(JSON.parse(response.body), { error: "Unauthorized" });
  });
});
