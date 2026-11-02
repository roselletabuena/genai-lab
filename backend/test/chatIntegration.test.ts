import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app";
import { setupOfflineAwsMocks, OfflineAwsMocks } from "./harness";

describe("Chat Integration with Offline Bedrock & DynamoDB Mocks", () => {
  let mocks: OfflineAwsMocks;
  const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

  beforeEach(() => {
    // Ensure AWS credentials are unset to guarantee tests run purely offline
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    mocks = setupOfflineAwsMocks();
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

  describe("TC-1.3-01 / AC1: Offline Bedrock runtime mock (Happy path)", () => {
    test("POST /portfolio/chat returns HTTP 200 with deterministic mock answer", async () => {
      mocks.bedrock.mockConverse("Hello! This is a deterministic offline response from Grizz.");

      const response = await app.inject({
        method: "POST",
        url: "/portfolio/chat",
        headers: { "Content-Type": "application/json" },
        payload: {
          messages: [{ role: "user", content: "Tell me about your tech stack" }],
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.strictEqual(
        body.answer,
        "Hello! This is a deterministic offline response from Grizz."
      );
    });

    test("POST /portfolio/chat/stream streams deterministic mock Bedrock response via SSE", async () => {
      const mockTokens = ["Grizz", " says", " hello", " from", " stream!"];
      mocks.bedrock.mockConverseStream(mockTokens);

      const response = await app.inject({
        method: "POST",
        url: "/portfolio/chat/stream",
        headers: { "Content-Type": "application/json" },
        payload: {
          messages: [{ role: "user", content: "Say hello!" }],
        },
      });

      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.headers["content-type"]?.includes("text/event-stream"));

      const events = response.body
        .split("\n\n")
        .filter((chunk) => chunk.startsWith("data: "))
        .map((chunk) => JSON.parse(chunk.replace("data: ", "")));

      const tokenChunks = events.filter((e) => e.type === "token").map((e) => e.text);
      assert.deepStrictEqual(tokenChunks, mockTokens);

      const doneEvent = events.find((e) => e.type === "done");
      assert.ok(doneEvent, "Expected done event in SSE stream");
    });
  });

  describe("TC-1.3-03 / AC3: Simulated Bedrock rate limit rejection (Error path)", () => {
    test("POST /portfolio/chat returns HTTP 429 when Bedrock throws ThrottlingException", async () => {
      mocks.bedrock.mockThrottling("Bedrock throughput quota exceeded");

      const response = await app.inject({
        method: "POST",
        url: "/portfolio/chat",
        headers: { "Content-Type": "application/json" },
        payload: {
          messages: [{ role: "user", content: "Are you there?" }],
        },
      });

      assert.strictEqual(response.statusCode, 429);
      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, "Bedrock rate limit exceeded");
      assert.match(body.details, /throttled|quota|exceeded/i);
    });

    test("POST /portfolio/suggested-prompts returns HTTP 429 when Bedrock throws ThrottlingException", async () => {
      mocks.bedrock.mockThrottling("Bedrock rate limit reached");

      const response = await app.inject({
        method: "POST",
        url: "/portfolio/suggested-prompts",
        headers: { "Content-Type": "application/json" },
        payload: {
          conversation: [{ role: "user", content: "What do you do?" }],
          lastMessage: "What do you do?",
        },
      });

      assert.strictEqual(response.statusCode, 429);
      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, "Bedrock rate limit exceeded");
    });
  });
});
