import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setupDynamoDbMock, DynamoDbMockHarness } from "../harness/dynamoDbMock";
import {
  checkAndIncrementDailyChatCap,
  getDailyChatUsage,
} from "../../src/services/usageCounterService";
import { trackUserInteraction, getPortfolioStats } from "../../src/services/portfolioService";

describe("TC-1.3-02 / AC2: Offline DynamoDB Client Mock Integration", () => {
  let ddbHarness: DynamoDbMockHarness;
  const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

  beforeEach(() => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    ddbHarness = setupDynamoDbMock();
  });

  afterEach(() => {
    ddbHarness.restore();
    if (originalAccessKey !== undefined) {
      process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
    }
    if (originalSecretKey !== undefined) {
      process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey;
    }
  });

  test("dispatches conditional updates to DynamoDB mock and increments count in memory", async () => {
    // 1st request
    const firstResult = await checkAndIncrementDailyChatCap({
      limit: 5,
      dateKey: "2026-11-03",
    });

    assert.strictEqual(firstResult.allowed, true);
    assert.strictEqual(firstResult.currentCount, 1);

    // 2nd request
    const secondResult = await checkAndIncrementDailyChatCap({
      limit: 5,
      dateKey: "2026-11-03",
    });

    assert.strictEqual(secondResult.allowed, true);
    assert.strictEqual(secondResult.currentCount, 2);

    // Verify getDailyChatUsage reflects in-memory state
    const usage = await getDailyChatUsage({
      limit: 5,
      dateKey: "2026-11-03",
    });
    assert.strictEqual(usage.count, 2);
    assert.strictEqual(usage.limit, 5);
  });

  test("triggers ConditionalCheckFailedException in memory when limit is reached", async () => {
    const limit = 2;

    // 1st request -> allowed (count: 1)
    const res1 = await checkAndIncrementDailyChatCap({ limit, dateKey: "2026-11-03" });
    assert.strictEqual(res1.allowed, true);
    assert.strictEqual(res1.currentCount, 1);

    // 2nd request -> allowed (count: 2)
    const res2 = await checkAndIncrementDailyChatCap({ limit, dateKey: "2026-11-03" });
    assert.strictEqual(res2.allowed, true);
    assert.strictEqual(res2.currentCount, 2);

    // 3rd request -> blocked (count was 2, condition count < limit fails)
    const res3 = await checkAndIncrementDailyChatCap({ limit, dateKey: "2026-11-03" });
    assert.strictEqual(res3.allowed, false);
    assert.strictEqual(res3.currentCount, 2);
  });

  test("simulates portfolio user interaction tracking and stats scan in memory", async () => {
    await trackUserInteraction("user-alpha");
    await trackUserInteraction("user-beta");
    await trackUserInteraction("user-alpha"); // same user, increments sessionCount

    const stats = await getPortfolioStats();
    assert.strictEqual(stats.uniqueUsersCount, 2);
  });
});
