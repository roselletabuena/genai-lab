import { mockClient, AwsClientStub } from "aws-sdk-client-mock";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ddbClient,
  ddbDocClient,
  USAGE_COUNTERS_TABLE,
  PORTFOLIO_USERS_TABLE,
} from "../../src/lib/dynamodb";

export interface DynamoDbMockHarness {
  ddbDocMock: AwsClientStub<DynamoDBDocumentClient>;
  ddbMock: AwsClientStub<DynamoDBClient>;
  tables: Map<string, Map<string, Record<string, any>>>;
  getItem: (table: string, keyVal: string) => Record<string, any> | undefined;
  setItem: (table: string, keyVal: string, item: Record<string, any>) => void;
  mockConditionalCheckFailed: () => void;
  reset: () => void;
  restore: () => void;
}

export function setupDynamoDbMock(): DynamoDbMockHarness {
  const ddbMock = mockClient(ddbClient);
  const ddbDocMock = mockClient(ddbDocClient);

  // In-memory store: tableName -> primaryKeyValue -> item
  const tables = new Map<string, Map<string, Record<string, any>>>();

  function getTableMap(tableName: string): Map<string, Record<string, any>> {
    let map = tables.get(tableName);
    if (!map) {
      map = new Map<string, Record<string, any>>();
      tables.set(tableName, map);
    }
    return map;
  }

  function getItem(tableName: string, keyVal: string): Record<string, any> | undefined {
    return getTableMap(tableName).get(keyVal);
  }

  function setItem(tableName: string, keyVal: string, item: Record<string, any>): void {
    getTableMap(tableName).set(keyVal, { ...item });
  }

  function configureHandlers() {
    // In-memory simulation of GetCommand
    ddbDocMock.on(GetCommand).callsFake((input: any) => {
      const tableName = input.TableName;
      const keyObj = input.Key || {};
      const keyVal = Object.values(keyObj)[0] as string;
      const item = getItem(tableName, keyVal);
      return Promise.resolve({ Item: item });
    });

    // In-memory simulation of ScanCommand
    ddbDocMock.on(ScanCommand).callsFake((input: any) => {
      const tableName = input.TableName;
      const items = Array.from(getTableMap(tableName).values());
      return Promise.resolve({ Items: items });
    });

    // In-memory simulation of UpdateCommand (specifically usage counters and portfolio tracking)
    ddbDocMock.on(UpdateCommand).callsFake((input: any) => {
      const tableName = input.TableName;
      const keyObj = input.Key || {};
      const keyField = Object.keys(keyObj)[0];
      const keyVal = keyObj[keyField];

      const tableMap = getTableMap(tableName);
      const existing = tableMap.get(keyVal) || {};

      // If this is a usage counter conditional increment
      if (tableName === USAGE_COUNTERS_TABLE || keyField === "counterId") {
        const limit = input.ExpressionAttributeValues?.[":limit"] ?? 100;
        const inc = input.ExpressionAttributeValues?.[":inc"] ?? 1;
        const currentCount = Number(existing.count ?? 0);

        if (input.ConditionExpression && currentCount >= limit) {
          const conditionalError = new Error("The conditional request failed");
          conditionalError.name = "ConditionalCheckFailedException";
          (conditionalError as any).code = "ConditionalCheckFailedException";
          return Promise.reject(conditionalError);
        }

        const newCount = currentCount + inc;
        const updatedItem = {
          ...existing,
          [keyField]: keyVal,
          count: newCount,
          ttl: input.ExpressionAttributeValues?.[":ttl"] ?? existing.ttl,
        };
        tableMap.set(keyVal, updatedItem);

        return Promise.resolve({
          Attributes: {
            count: newCount,
            ttl: updatedItem.ttl,
          },
        });
      }

      // If this is a visitor/user interaction tracking
      if (tableName === PORTFOLIO_USERS_TABLE || keyField === "userId") {
        const sessionCount = Number(existing.sessionCount ?? 0) + 1;
        const now = input.ExpressionAttributeValues?.[":now"] ?? Date.now();
        const updatedItem = {
          ...existing,
          userId: keyVal,
          sessionCount,
          firstSeen: existing.firstSeen ?? now,
          lastSeen: now,
        };
        tableMap.set(keyVal, updatedItem);

        return Promise.resolve({
          Attributes: updatedItem,
        });
      }

      // Generic fallback update
      tableMap.set(keyVal, { ...existing, ...keyObj });
      return Promise.resolve({ Attributes: tableMap.get(keyVal) });
    });

    // In-memory simulation of PutCommand
    ddbDocMock.on(PutCommand).callsFake((input: any) => {
      const tableName = input.TableName;
      const item = input.Item || {};
      const keyField = Object.keys(item)[0];
      const keyVal = item[keyField];
      getTableMap(tableName).set(keyVal, item);
      return Promise.resolve({});
    });
  }

  const mockConditionalCheckFailed = () => {
    const conditionalError = new Error("The conditional request failed");
    conditionalError.name = "ConditionalCheckFailedException";
    (conditionalError as any).code = "ConditionalCheckFailedException";
    ddbDocMock.on(UpdateCommand).rejects(conditionalError);
  };

  configureHandlers();

  return {
    ddbDocMock,
    ddbMock,
    tables,
    getItem,
    setItem,
    mockConditionalCheckFailed,
    reset: () => {
      ddbDocMock.reset();
      ddbMock.reset();
      tables.clear();
      configureHandlers();
    },
    restore: () => {
      ddbDocMock.restore();
      ddbMock.restore();
      tables.clear();
    },
  };
}
