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
