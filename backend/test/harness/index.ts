import { setupBedrockMock, BedrockMockHarness } from "./bedrockMock";
import { setupDynamoDbMock, DynamoDbMockHarness } from "./dynamoDbMock";

export * from "./bedrockMock";
export * from "./dynamoDbMock";

export interface OfflineAwsMocks {
  bedrock: BedrockMockHarness;
  dynamoDb: DynamoDbMockHarness;
  resetAll: () => void;
  restoreAll: () => void;
}

/**
 * Initializes full offline mock harnesses for both AWS Bedrock and DynamoDB.
 * Sets up safe, in-memory, deterministic responses so test suites run offline
 * without requiring AWS credentials or network access.
 */
export function setupOfflineAwsMocks(): OfflineAwsMocks {
  const bedrock = setupBedrockMock();
  const dynamoDb = setupDynamoDbMock();

  return {
    bedrock,
    dynamoDb,
    resetAll: () => {
      bedrock.reset();
      dynamoDb.reset();
    },
    restoreAll: () => {
      bedrock.restore();
      dynamoDb.restore();
    },
  };
}
