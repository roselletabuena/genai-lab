import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chat, chatStream, DAILY_CAP_MESSAGE } from "../../src/lib/bedrock/chatOrchestrator";
import * as usageService from "../../src/services/usageCounterService";

describe("chatOrchestrator daily cap", () => {
  it("chat() returns DAILY_CAP_MESSAGE when cap is reached without Bedrock call", async (t) => {
    t.mock.method(usageService, "checkAndIncrementDailyChatCap", async () => ({
      allowed: false,
      currentCount: 100,
      limit: 100,
    }));

    const result = await chat([{ role: "user", content: "Tell me about Roselle" }]);

    assert.equal(result.answer, DAILY_CAP_MESSAGE);
    assert.equal(result.uiWidget, undefined);
  });

  it("chatStream() yields token with DAILY_CAP_MESSAGE and done when cap is reached", async (t) => {
    t.mock.method(usageService, "checkAndIncrementDailyChatCap", async () => ({
      allowed: false,
      currentCount: 100,
      limit: 100,
    }));

    const chunks: any[] = [];
    for await (const chunk of chatStream([{ role: "user", content: "Tell me about Roselle" }])) {
      chunks.push(chunk);
    }

    assert.equal(chunks.length, 2);
    assert.deepEqual(chunks[0], { type: "token", text: DAILY_CAP_MESSAGE });
    assert.deepEqual(chunks[1], { type: "done" });
  });
});
