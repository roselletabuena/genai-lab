import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkAndIncrementDailyChatCap,
  getDailyChatUsage,
  getUtcDateString,
  DAILY_CAP_MESSAGE,
} from "../../src/services/usageCounterService";

describe("usageCounterService", () => {
  it("getUtcDateString returns formatted YYYY-MM-DD date", () => {
    const fixedDate = new Date("2026-11-02T15:30:00Z");
    assert.equal(getUtcDateString(fixedDate), "2026-11-02");
  });

  it("DAILY_CAP_MESSAGE contains friendly Grizz persona", () => {
    assert.match(DAILY_CAP_MESSAGE, /Grizz/i);
    assert.match(DAILY_CAP_MESSAGE, /limit/i);
    assert.match(DAILY_CAP_MESSAGE, /tomorrow/i);
  });

  it("checkAndIncrementDailyChatCap allows request when under limit", async () => {
    let capturedCommand: any = null;
    const mockClient = {
      send: async (command: any) => {
        capturedCommand = command;
        return {
          Attributes: {
            count: 42,
            ttl: 1234567890,
          },
        };
      },
    };

    const result = await checkAndIncrementDailyChatCap({
      limit: 100,
      tableName: "UsageCounters-test",
      dateKey: "2026-11-02",
      client: mockClient,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.currentCount, 42);
    assert.equal(result.limit, 100);

    // Verify command parameters
    assert.equal(capturedCommand.input.TableName, "UsageCounters-test");
    assert.deepEqual(capturedCommand.input.Key, { counterId: "chat_daily#2026-11-02" });
    assert.equal(
      capturedCommand.input.UpdateExpression,
      "SET #ttl = if_not_exists(#ttl, :ttl) ADD #count :inc"
    );
    assert.equal(
      capturedCommand.input.ConditionExpression,
      "attribute_not_exists(#count) OR #count < :limit"
    );
    assert.equal(capturedCommand.input.ExpressionAttributeValues[":inc"], 1);
    assert.equal(capturedCommand.input.ExpressionAttributeValues[":limit"], 100);
    assert.ok(capturedCommand.input.ExpressionAttributeValues[":ttl"] > 0);
  });

  it("checkAndIncrementDailyChatCap blocks request when cap is reached", async () => {
    const conditionalError = new Error("The conditional request failed");
    conditionalError.name = "ConditionalCheckFailedException";

    const mockClient = {
      send: async () => {
        throw conditionalError;
      },
    };

    const result = await checkAndIncrementDailyChatCap({
      limit: 100,
      tableName: "UsageCounters-test",
      dateKey: "2026-11-02",
      client: mockClient,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.currentCount, 100);
    assert.equal(result.limit, 100);
  });

  it("checkAndIncrementDailyChatCap fails open with warning on unexpected error", async () => {
    const mockClient = {
      send: async () => {
        throw new Error("Networking connection timeout");
      },
    };

    const result = await checkAndIncrementDailyChatCap({
      limit: 50,
      client: mockClient,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.currentCount, -1);
    assert.equal(result.limit, 50);
  });

  it("getDailyChatUsage returns existing counter value", async () => {
    const mockClient = {
      send: async () => ({
        Item: {
          counterId: "chat_daily#2026-11-02",
          count: 75,
        },
      }),
    };

    const result = await getDailyChatUsage({
      limit: 100,
      client: mockClient,
      dateKey: "2026-11-02",
    });

    assert.equal(result.count, 75);
    assert.equal(result.limit, 100);
  });

  it("getDailyChatUsage returns 0 when item does not exist", async () => {
    const mockClient = {
      send: async () => ({}),
    };

    const result = await getDailyChatUsage({
      limit: 100,
      client: mockClient,
      dateKey: "2026-11-02",
    });

    assert.equal(result.count, 0);
    assert.equal(result.limit, 100);
  });
});
