import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setupOfflineAwsMocks, OfflineAwsMocks } from "./index";
import { bedrockClient, bedrockAgentClient } from "../../src/lib/bedrock/client";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { ddbDocClient, USAGE_COUNTERS_TABLE } from "../../src/lib/dynamodb";
import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

describe("Offline AWS Mock Harness", () => {
  let mocks: OfflineAwsMocks;

  beforeEach(() => {
    mocks = setupOfflineAwsMocks();
  });

  afterEach(() => {
    mocks.restoreAll();
  });

  test("Bedrock mock returns deterministic converse output by default", async () => {
    const res = await bedrockClient.send(
      new ConverseCommand({
        modelId: "test-model",
        messages: [{ role: "user", content: [{ text: "Hello" }] }],
      })
    );

    assert.equal(
      res.output?.message?.content?.[0]?.text,
      "Hello! I am Grizz, Roselle's AI assistant."
    );
    assert.equal(res.stopReason, "end_turn");
  });

  test("Bedrock agent mock returns mock knowledge base retrieval results", async () => {
    const res = await bedrockAgentClient.send(
      new RetrieveCommand({
        knowledgeBaseId: "mock-kb",
        retrievalQuery: { text: "Tell me about Roselle" },
      })
    );

    assert.ok(res.retrievalResults && res.retrievalResults.length > 0);
    assert.equal(res.retrievalResults[0].content?.text, "Mocked knowledge base document context");
  });

  test("DynamoDB mock simulates in-memory counter increment and retrieval", async () => {
    const updateRes = await ddbDocClient.send(
      new UpdateCommand({
        TableName: USAGE_COUNTERS_TABLE,
        Key: { counterId: "chat_daily#2026-11-03" },
        UpdateExpression: "SET #ttl = if_not_exists(#ttl, :ttl) ADD #count :inc",
        ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":inc": 1, ":ttl": 1234567890, ":limit": 10 },
        ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
      })
    );

    assert.equal(updateRes.Attributes?.count, 1);

    const getRes = await ddbDocClient.send(
      new GetCommand({
        TableName: USAGE_COUNTERS_TABLE,
        Key: { counterId: "chat_daily#2026-11-03" },
      })
    );

    assert.equal(getRes.Item?.count, 1);
  });
});
