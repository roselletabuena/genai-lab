import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app";
import { setupOfflineAwsMocks, OfflineAwsMocks } from "./harness";
import {
  chatPayloadSchema,
  chatMessageSchema,
  suggestedPromptsPayloadSchema,
  suggestedPromptsResponseSchema,
  visitorSessionHeaderSchema,
  clientSessionSchema,
  toSessionHeaders,
  formatZodError,
  normalizeChatPayload,
  INVALID_PAYLOAD_ERROR,
  VISITOR_ID_HEADER,
  CLIENT_IP_HEADER,
  INTERNAL_API_KEY_HEADER,
} from "@genai-lab/contracts";

describe("Shared Contracts & Validation — Story GL-49", () => {
  let mocks: OfflineAwsMocks;
  const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

  beforeEach(() => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    mocks = setupOfflineAwsMocks();
    mocks.bedrock.mockConverse("Hello! This is a deterministic offline response from Grizz.");
  });

  afterEach(() => {
    mocks.restoreAll();
    if (originalAccessKey !== undefined) {
      process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
    }
    if (originalSecretKey !== undefined) {
      process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey;
    }
  });

  describe("TC-1.4-01 / AC1: Common schema definitions package", () => {
    test("exports expected schema contracts and helpers from @genai-lab/contracts", () => {
      assert.ok(chatPayloadSchema);
      assert.ok(chatMessageSchema);
      assert.ok(suggestedPromptsPayloadSchema);
      assert.ok(suggestedPromptsResponseSchema);
      assert.ok(visitorSessionHeaderSchema);
      assert.ok(clientSessionSchema);
      assert.strictEqual(typeof toSessionHeaders, "function");
      assert.strictEqual(typeof formatZodError, "function");
      assert.strictEqual(typeof normalizeChatPayload, "function");
      assert.strictEqual(VISITOR_ID_HEADER, "x-visitor-id");
      assert.strictEqual(CLIENT_IP_HEADER, "x-client-ip");
      assert.strictEqual(INTERNAL_API_KEY_HEADER, "x-internal-api-key");
    });

    test("converts client session to HTTP headers without drift", () => {
      const headers = toSessionHeaders({
        visitorId: "v-456",
        clientIp: "192.168.1.1",
        internalApiKey: "secret-key",
      });

      assert.deepStrictEqual(headers, {
        "x-visitor-id": "v-456",
        "x-client-ip": "192.168.1.1",
        "x-internal-api-key": "secret-key",
      });
    });

    test("validates visitor session headers schema", () => {
      const valid = visitorSessionHeaderSchema.safeParse({
        "x-visitor-id": "visitor-abc",
        "x-client-ip": "127.0.0.1",
        "content-type": "application/json",
      });
      assert.strictEqual(valid.success, true);
    });
  });

  describe("TC-1.4-02 / AC2: Backend request validation enforcement", () => {
    test("POST /portfolio/chat accepts single message payload with visitorId { message, visitorId }", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/portfolio/chat",
        headers: { "Content-Type": "application/json" },
        payload: {
          message: "Hello from visitor!",
          visitorId: "v123",
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.strictEqual(
        body.answer,
        "Hello! This is a deterministic offline response from Grizz."
      );
    });

    test("POST /portfolio/chat accepts multi-turn messages array payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/portfolio/chat",
        headers: { "Content-Type": "application/json" },
        payload: {
          messages: [{ role: "user", content: "What are your skills?" }],
          visitorId: "v456",
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.strictEqual(
        body.answer,
        "Hello! This is a deterministic offline response from Grizz."
      );
    });

    test("normalizeChatPayload handles both single message and messages array", () => {
      const fromSingle = normalizeChatPayload({
        message: "Hello single",
        visitorId: "v1",
      });
      assert.deepStrictEqual(fromSingle.messages, [{ role: "user", content: "Hello single" }]);
      assert.strictEqual(fromSingle.visitorId, "v1");

      const fromMulti = normalizeChatPayload({
        messages: [{ role: "user", content: "Hello multi" }],
        visitorId: "v2",
      });
      assert.deepStrictEqual(fromMulti.messages, [{ role: "user", content: "Hello multi" }]);
      assert.strictEqual(fromMulti.visitorId, "v2");
    });
  });

  describe("TC-1.4-04 / AC4: Runtime error response for malformed payloads", () => {
    test("POST /portfolio/chat rejects non-string message { message: 12345 } with 400 and field-level details", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/portfolio/chat",
        headers: { "Content-Type": "application/json" },
        payload: { message: 12345 },
      });

      assert.strictEqual(response.statusCode, 400);
      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, INVALID_PAYLOAD_ERROR);
      assert.ok(Array.isArray(body.details));
      assert.ok(body.details.length > 0);
      assert.ok(body.details.some((d: any) => d.path === "message"));
    });

    test("POST /portfolio/chat rejects extra unexpected properties via strict validation", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/portfolio/chat",
        headers: { "Content-Type": "application/json" },
        payload: {
          message: "Valid text",
          unexpectedField: "malicious or invalid",
        },
      });

      assert.strictEqual(response.statusCode, 400);
      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, INVALID_PAYLOAD_ERROR);
      assert.ok(Array.isArray(body.details));
      assert.ok(
        body.details.some(
          (d: any) =>
            d.message.includes("unrecognized") ||
            d.path === "unexpectedField" ||
            d.message.includes("unexpectedField")
        )
      );
    });

    test("POST /portfolio/suggested-prompts rejects extra properties via strict validation", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/portfolio/suggested-prompts",
        headers: { "Content-Type": "application/json" },
        payload: {
          conversation: [],
          lastMessage: "valid last message",
          extraProp: "disallowed",
        },
      });

      assert.strictEqual(response.statusCode, 400);
      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, INVALID_PAYLOAD_ERROR);
      assert.ok(Array.isArray(body.details));
    });
  });
});
