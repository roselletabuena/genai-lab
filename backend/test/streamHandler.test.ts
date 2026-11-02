import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Set up awslambda mock before requiring/importing lambda
(globalThis as any).awslambda = {
  streamifyResponse: (fn: any) => fn,
  HttpResponseStream: {
    from: (stream: any, metadata: any) => {
      stream.metadata = metadata;
      return stream;
    },
  },
};

import { streamHandler } from "../src/lambda";
import { MAX_MESSAGE_CONTENT_LENGTH, MAX_MESSAGES_COUNT } from "../src/schemas/chat.schema";

describe("streamHandler authorization", () => {
  const originalEnv = process.env.INTERNAL_API_KEY;

  beforeEach(() => {
    process.env.INTERNAL_API_KEY = "stream-secret-key";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INTERNAL_API_KEY = originalEnv;
    } else {
      delete process.env.INTERNAL_API_KEY;
    }
  });

  function createMockStream() {
    const written: string[] = [];
    let contentType = "";
    let ended = false;
    return {
      written,
      metadata: null as any,
      setContentType: (type: string) => {
        contentType = type;
      },
      getContentType: () => contentType,
      write: (data: string) => {
        written.push(data);
      },
      end: () => {
        ended = true;
      },
      isEnded: () => ended,
    };
  }

  test("returns 401 via HttpResponseStream and does not invoke Bedrock when key is missing", async () => {
    const stream = createMockStream();
    const event = {
      headers: {},
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    };

    await streamHandler(event, stream);

    assert.strictEqual(stream.isEnded(), true);
    assert.deepStrictEqual(stream.metadata, {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
    });
    assert.deepStrictEqual(JSON.parse(stream.written[0]), { error: "Unauthorized" });
  });

  test("returns 401 via HttpResponseStream when key is incorrect", async () => {
    const stream = createMockStream();
    const event = {
      headers: { "x-internal-api-key": "wrong-key" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    };

    await streamHandler(event, stream);

    assert.strictEqual(stream.isEnded(), true);
    assert.deepStrictEqual(stream.metadata, {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
    });
    assert.deepStrictEqual(JSON.parse(stream.written[0]), { error: "Unauthorized" });
  });

  test("returns 401 when INTERNAL_API_KEY is unset (fail closed)", async () => {
    delete process.env.INTERNAL_API_KEY;
    const stream = createMockStream();
    const event = {
      headers: { "x-internal-api-key": "stream-secret-key" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    };

    await streamHandler(event, stream);

    assert.strictEqual(stream.isEnded(), true);
    assert.deepStrictEqual(stream.metadata, {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
    });
    assert.deepStrictEqual(JSON.parse(stream.written[0]), { error: "Unauthorized" });
  });
});

describe("streamHandler payload validation", () => {
  const originalEnv = process.env.INTERNAL_API_KEY;

  beforeEach(() => {
    process.env.INTERNAL_API_KEY = "stream-secret-key";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INTERNAL_API_KEY = originalEnv;
    } else {
      delete process.env.INTERNAL_API_KEY;
    }
  });

  function createMockStream() {
    const written: string[] = [];
    let contentType = "";
    let ended = false;
    return {
      written,
      metadata: null as any,
      setContentType: (type: string) => {
        contentType = type;
      },
      getContentType: () => contentType,
      write: (data: string) => {
        written.push(data);
      },
      end: () => {
        ended = true;
      },
      isEnded: () => ended,
    };
  }

  test("returns 400 via HttpResponseStream when body is malformed JSON", async () => {
    const stream = createMockStream();
    const event = {
      headers: { "x-internal-api-key": "stream-secret-key" },
      body: "{ malformed json",
    };

    await streamHandler(event, stream);

    assert.strictEqual(stream.isEnded(), true);
    assert.deepStrictEqual(stream.metadata, {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
    });
    assert.deepStrictEqual(JSON.parse(stream.written[0]), { error: "Invalid request payload" });
  });

  test("returns 400 via HttpResponseStream when messages array is empty", async () => {
    const stream = createMockStream();
    const event = {
      headers: { "x-internal-api-key": "stream-secret-key" },
      body: JSON.stringify({ messages: [] }),
    };

    await streamHandler(event, stream);

    assert.strictEqual(stream.isEnded(), true);
    assert.deepStrictEqual(stream.metadata, {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
    });
    assert.deepStrictEqual(JSON.parse(stream.written[0]), { error: "Invalid request payload" });
  });

  test("returns 400 via HttpResponseStream when content is oversized (> 1000 chars) and does not echo input", async () => {
    const stream = createMockStream();
    const oversizedContent = "A".repeat(MAX_MESSAGE_CONTENT_LENGTH + 1);
    const event = {
      headers: { "x-internal-api-key": "stream-secret-key" },
      body: JSON.stringify({
        messages: [{ role: "user", content: oversizedContent }],
      }),
    };

    await streamHandler(event, stream);

    assert.strictEqual(stream.isEnded(), true);
    assert.deepStrictEqual(stream.metadata, {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
    });
    assert.deepStrictEqual(JSON.parse(stream.written[0]), { error: "Invalid request payload" });
    assert.strictEqual(stream.written[0].includes(oversizedContent), false);
  });

  test("returns 400 via HttpResponseStream when role is invalid", async () => {
    const stream = createMockStream();
    const event = {
      headers: { "x-internal-api-key": "stream-secret-key" },
      body: JSON.stringify({
        messages: [{ role: "system", content: "hello" }],
      }),
    };

    await streamHandler(event, stream);

    assert.strictEqual(stream.isEnded(), true);
    assert.deepStrictEqual(stream.metadata, {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
    });
    assert.deepStrictEqual(JSON.parse(stream.written[0]), { error: "Invalid request payload" });
  });

  test("returns 400 via HttpResponseStream when content is non-string", async () => {
    const stream = createMockStream();
    const event = {
      headers: { "x-internal-api-key": "stream-secret-key" },
      body: JSON.stringify({
        messages: [{ role: "user", content: 12345 }],
      }),
    };

    await streamHandler(event, stream);

    assert.strictEqual(stream.isEnded(), true);
    assert.deepStrictEqual(stream.metadata, {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
    });
    assert.deepStrictEqual(JSON.parse(stream.written[0]), { error: "Invalid request payload" });
  });

  test("returns 400 via HttpResponseStream when messages array exceeds limit", async () => {
    const stream = createMockStream();
    const event = {
      headers: { "x-internal-api-key": "stream-secret-key" },
      body: JSON.stringify({
        messages: Array.from({ length: MAX_MESSAGES_COUNT + 1 }, (_, i) => ({
          role: "user",
          content: `Message ${i}`,
        })),
      }),
    };

    await streamHandler(event, stream);

    assert.strictEqual(stream.isEnded(), true);
    assert.deepStrictEqual(stream.metadata, {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
    });
    assert.deepStrictEqual(JSON.parse(stream.written[0]), { error: "Invalid request payload" });
  });

  test("returns 400 via HttpResponseStream when messages property is missing", async () => {
    const stream = createMockStream();
    const event = {
      headers: { "x-internal-api-key": "stream-secret-key" },
      body: JSON.stringify({}),
    };

    await streamHandler(event, stream);

    assert.strictEqual(stream.isEnded(), true);
    assert.deepStrictEqual(stream.metadata, {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
    });
    assert.deepStrictEqual(JSON.parse(stream.written[0]), { error: "Invalid request payload" });
  });
});
