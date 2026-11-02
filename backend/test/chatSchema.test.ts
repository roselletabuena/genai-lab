import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  chatMessageSchema,
  chatPayloadSchema,
  suggestedPromptsPayloadSchema,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_MESSAGES_COUNT,
  INVALID_PAYLOAD_ERROR,
} from "../src/schemas/chat.schema";

describe("chatMessageSchema", () => {
  test("accepts valid user message", () => {
    const valid = { role: "user", content: "What are her AWS skills?" };
    const result = chatMessageSchema.safeParse(valid);
    assert.strictEqual(result.success, true);
  });

  test("accepts valid assistant message", () => {
    const valid = { role: "assistant", content: "She is AWS certified." };
    const result = chatMessageSchema.safeParse(valid);
    assert.strictEqual(result.success, true);
  });

  test("accepts message content at boundary length (1000 chars)", () => {
    const boundary = { role: "user", content: "a".repeat(MAX_MESSAGE_CONTENT_LENGTH) };
    const result = chatMessageSchema.safeParse(boundary);
    assert.strictEqual(result.success, true);
  });

  test("rejects oversized content (> 1000 chars)", () => {
    const oversized = { role: "user", content: "a".repeat(MAX_MESSAGE_CONTENT_LENGTH + 1) };
    const result = chatMessageSchema.safeParse(oversized);
    assert.strictEqual(result.success, false);
  });

  test("rejects empty string content", () => {
    const empty = { role: "user", content: "" };
    const result = chatMessageSchema.safeParse(empty);
    assert.strictEqual(result.success, false);
  });

  test("rejects wrong role (e.g., system, admin, other)", () => {
    assert.strictEqual(
      chatMessageSchema.safeParse({ role: "system", content: "hello" }).success,
      false
    );
    assert.strictEqual(
      chatMessageSchema.safeParse({ role: "admin", content: "hello" }).success,
      false
    );
    assert.strictEqual(
      chatMessageSchema.safeParse({ role: "bot", content: "hello" }).success,
      false
    );
  });

  test("rejects non-string content (number, boolean, object, array, null)", () => {
    assert.strictEqual(
      chatMessageSchema.safeParse({ role: "user", content: 12345 }).success,
      false
    );
    assert.strictEqual(chatMessageSchema.safeParse({ role: "user", content: true }).success, false);
    assert.strictEqual(
      chatMessageSchema.safeParse({ role: "user", content: { text: "hello" } }).success,
      false
    );
    assert.strictEqual(
      chatMessageSchema.safeParse({ role: "user", content: ["hello"] }).success,
      false
    );
    assert.strictEqual(chatMessageSchema.safeParse({ role: "user", content: null }).success, false);
  });
});

describe("chatPayloadSchema", () => {
  test("accepts valid payload with single message", () => {
    const payload = {
      messages: [{ role: "user", content: "Hello!" }],
    };
    const result = chatPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, true);
  });

  test("accepts valid payload up to boundary (20 messages)", () => {
    const payload = {
      messages: Array.from({ length: MAX_MESSAGES_COUNT }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}`,
      })),
    };
    const result = chatPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, true);
  });

  test("rejects empty messages array", () => {
    const payload = { messages: [] };
    const result = chatPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, false);
  });

  test("rejects oversized messages array (> 20 messages)", () => {
    const payload = {
      messages: Array.from({ length: MAX_MESSAGES_COUNT + 1 }, (_, i) => ({
        role: "user",
        content: `Message ${i}`,
      })),
    };
    const result = chatPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, false);
  });

  test("rejects non-array messages property", () => {
    assert.strictEqual(chatPayloadSchema.safeParse({ messages: "hello" }).success, false);
    assert.strictEqual(chatPayloadSchema.safeParse({ messages: 123 }).success, false);
    assert.strictEqual(chatPayloadSchema.safeParse({ messages: null }).success, false);
    assert.strictEqual(chatPayloadSchema.safeParse({}).success, false);
  });

  test("rejects payload when any message has invalid fields", () => {
    const payload = {
      messages: [
        { role: "user", content: "Valid message" },
        { role: "user", content: "a".repeat(MAX_MESSAGE_CONTENT_LENGTH + 1) },
      ],
    };
    const result = chatPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, false);
  });
});

describe("suggestedPromptsPayloadSchema", () => {
  test("accepts valid conversation history and lastMessage", () => {
    const payload = {
      conversation: [{ role: "user", content: "Hi" }],
      lastMessage: "I am Roselle's AI assistant.",
    };
    const result = suggestedPromptsPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, true);
  });

  test("accepts empty conversation history with valid lastMessage", () => {
    const payload = {
      conversation: [],
      lastMessage: "I am Roselle's AI assistant.",
    };
    const result = suggestedPromptsPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, true);
  });

  test("rejects oversized lastMessage (> 1000 chars)", () => {
    const payload = {
      conversation: [],
      lastMessage: "a".repeat(MAX_MESSAGE_CONTENT_LENGTH + 1),
    };
    const result = suggestedPromptsPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, false);
  });

  test("rejects empty lastMessage", () => {
    const payload = {
      conversation: [],
      lastMessage: "",
    };
    const result = suggestedPromptsPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, false);
  });

  test("rejects non-string lastMessage", () => {
    const payload = {
      conversation: [],
      lastMessage: 12345,
    };
    const result = suggestedPromptsPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, false);
  });

  test("rejects conversation history exceeding 20 messages", () => {
    const payload = {
      conversation: Array.from({ length: MAX_MESSAGES_COUNT + 1 }, (_, i) => ({
        role: "user",
        content: `Msg ${i}`,
      })),
      lastMessage: "Hello",
    };
    const result = suggestedPromptsPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, false);
  });

  test("rejects invalid message in conversation history", () => {
    const payload = {
      conversation: [{ role: "hacker", content: "payload" }],
      lastMessage: "Hello",
    };
    const result = suggestedPromptsPayloadSchema.safeParse(payload);
    assert.strictEqual(result.success, false);
  });
});

describe("INVALID_PAYLOAD_ERROR constant", () => {
  test("is generic and does not echo user input", () => {
    assert.strictEqual(INVALID_PAYLOAD_ERROR, "Invalid request payload");
  });
});
