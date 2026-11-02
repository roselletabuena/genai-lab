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

import { app } from "../src/app";
import { getHeaderValue } from "../src/utils/auth";
import { streamHandler } from "../src/lambda";

describe("getHeaderValue helper", () => {
  test("retrieves header value case-insensitively", () => {
    assert.strictEqual(
      getHeaderValue({ "x-client-ip": "203.0.113.195" }, "x-client-ip"),
      "203.0.113.195"
    );
    assert.strictEqual(
      getHeaderValue({ "X-Client-Ip": "203.0.113.195" }, "x-client-ip"),
      "203.0.113.195"
    );
    assert.strictEqual(
      getHeaderValue({ "X-CLIENT-IP": "203.0.113.195" }, "x-client-ip"),
      "203.0.113.195"
    );
    assert.strictEqual(
      getHeaderValue({ "x-client-ip": "203.0.113.195" }, "X-Client-Ip"),
      "203.0.113.195"
    );
  });

  test("handles string array header values", () => {
    assert.strictEqual(
      getHeaderValue({ "x-client-ip": ["203.0.113.195", "10.0.0.1"] }, "x-client-ip"),
      "203.0.113.195"
    );
  });

  test("returns undefined when header is absent or headers object is missing", () => {
    assert.strictEqual(getHeaderValue({}, "x-client-ip"), undefined);
    assert.strictEqual(getHeaderValue(undefined, "x-client-ip"), undefined);
    assert.strictEqual(getHeaderValue(null, "x-client-ip"), undefined);
  });
});

describe("Client IP logging and acceptance in Fastify routes", () => {
  test("accepts x-client-ip on POST /portfolio/chat", async () => {
    const logs: any[] = [];
    const originalLogInfo = app.log.info.bind(app.log);
    app.log.info = ((...args: any[]) => {
      logs.push(args);
      return (originalLogInfo as any)(...args);
    }) as any;

    try {
      const response = await app.inject({
        method: "POST",
        url: "/portfolio/chat",
        headers: {
          "Content-Type": "application/json",
          "x-client-ip": "198.51.100.42",
          "x-visitor-id": "visitor-123",
        },
        payload: {
          messages: [{ role: "user", content: "What is your experience?" }],
        },
      });

      // Valid payload accepted (either 200 mock response or 500 if Bedrock unconfigured in test)
      // The important guarantee is that x-client-ip does not cause 400 or rejection
      assert.notStrictEqual(response.statusCode, 400);

      // Verify that client IP was logged
      const foundLog = logs.some((entry) => {
        const obj = entry[0];
        return obj && typeof obj === "object" && obj.clientIp === "198.51.100.42";
      });
      assert.strictEqual(foundLog, true, "Expected clientIp to be logged");
    } finally {
      app.log.info = originalLogInfo;
    }
  });

  test("accepts x-client-ip on POST /portfolio/chat/stream", async () => {
    const logs: any[] = [];
    const originalLogInfo = app.log.info.bind(app.log);
    app.log.info = ((...args: any[]) => {
      logs.push(args);
      return (originalLogInfo as any)(...args);
    }) as any;

    try {
      const response = await app.inject({
        method: "POST",
        url: "/portfolio/chat/stream",
        headers: {
          "Content-Type": "application/json",
          "x-client-ip": "198.51.100.43",
        },
        payload: {
          messages: [{ role: "user", content: "Tell me about your projects" }],
        },
      });

      assert.strictEqual(response.statusCode, 200);

      const foundLog = logs.some((entry) => {
        const obj = entry[0];
        return obj && typeof obj === "object" && obj.clientIp === "198.51.100.43";
      });
      assert.strictEqual(foundLog, true, "Expected clientIp to be logged on stream route");
    } finally {
      app.log.info = originalLogInfo;
    }
  });

  test("accepts x-client-ip on POST /portfolio/suggested-prompts", async () => {
    const logs: any[] = [];
    const originalLogInfo = app.log.info.bind(app.log);
    app.log.info = ((...args: any[]) => {
      logs.push(args);
      return (originalLogInfo as any)(...args);
    }) as any;

    try {
      const response = await app.inject({
        method: "POST",
        url: "/portfolio/suggested-prompts",
        headers: {
          "Content-Type": "application/json",
          "x-client-ip": "198.51.100.44",
        },
        payload: {
          conversation: [{ role: "user", content: "Tell me about yourself" }],
          lastMessage: "I am a fullstack software engineer.",
        },
      });

      // Not rejected by validation
      assert.notStrictEqual(response.statusCode, 400);

      const foundLog = logs.some((entry) => {
        const obj = entry[0];
        return obj && typeof obj === "object" && obj.clientIp === "198.51.100.44";
      });
      assert.strictEqual(foundLog, true, "Expected clientIp to be logged on suggested-prompts");
    } finally {
      app.log.info = originalLogInfo;
    }
  });
});

describe("Client IP logging in Lambda streamHandler", () => {
  const originalEnv = process.env.INTERNAL_API_KEY;

  beforeEach(() => {
    process.env.INTERNAL_API_KEY = "test-secret";
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

  test("logs client IP when x-client-ip is supplied in headers", async () => {
    const logs: string[] = [];
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(" "));
      originalConsoleLog(...args);
    };

    try {
      const stream = createMockStream();
      const event = {
        headers: {
          "x-internal-api-key": "test-secret",
          "x-client-ip": "203.0.113.50",
          "x-visitor-id": "visitor-456",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello Grizz!" }],
        }),
      };

      await streamHandler(event, stream);

      assert.strictEqual(stream.getContentType(), "text/event-stream; charset=utf-8");
      const clientIpLogged = logs.some((log) => log.includes("203.0.113.50"));
      assert.strictEqual(clientIpLogged, true, "Expected client IP to be logged in streamHandler");
    } finally {
      console.log = originalConsoleLog;
    }
  });

  test("operates normally when x-client-ip is absent", async () => {
    const stream = createMockStream();
    const event = {
      headers: {
        "x-internal-api-key": "test-secret",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello Grizz!" }],
      }),
    };

    await streamHandler(event, stream);
    assert.strictEqual(stream.getContentType(), "text/event-stream; charset=utf-8");
    assert.strictEqual(stream.isEnded(), true);
  });
});
