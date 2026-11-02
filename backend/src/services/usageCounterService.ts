import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, USAGE_COUNTERS_TABLE } from "../lib/dynamodb";

export const DAILY_CAP_MESSAGE =
  "Woof! Grizz has reached today's chat limit to keep AWS costs under control. Please come back tomorrow or reach out directly to Roselle! 🐾";

export interface CapCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
}

export interface CapCheckOptions {
  limit?: number;
  tableName?: string;
  dateKey?: string;
  client?: { send: (command: any) => Promise<any> };
}

/**
 * Returns the UTC date formatted as YYYY-MM-DD.
 */
export function getUtcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Atomically checks and increments the daily chat request counter.
 *
 * Uses DynamoDB conditional write:
 * - Condition: `attribute_not_exists(#count) OR #count < :limit`
 * - Update: `SET #ttl = if_not_exists(#ttl, :ttl) ADD #count :inc`
 *
 * If the daily limit has already been reached, DynamoDB throws ConditionalCheckFailedException,
 * and this function returns `{ allowed: false }`.
 * Old counters automatically expire after 48 hours via DynamoDB TTL.
 */
export async function checkAndIncrementDailyChatCap(
  options: CapCheckOptions = {}
): Promise<CapCheckResult> {
  const limit = options.limit ?? parseInt(process.env.DAILY_CHAT_REQUEST_CAP || "100", 10);
  const tableName = options.tableName ?? USAGE_COUNTERS_TABLE;
  const dateKey = options.dateKey ?? getUtcDateString();
  const counterId = `chat_daily#${dateKey}`;
  const ttl = Math.floor(Date.now() / 1000) + 48 * 3600; // 48-hour TTL
  const client = options.client ?? ddbDocClient;

  try {
    const command = new UpdateCommand({
      TableName: tableName,
      Key: { counterId },
      UpdateExpression: "SET #ttl = if_not_exists(#ttl, :ttl) ADD #count :inc",
      ExpressionAttributeNames: {
        "#count": "count",
        "#ttl": "ttl",
      },
      ExpressionAttributeValues: {
        ":inc": 1,
        ":ttl": ttl,
        ":limit": limit,
      },
      ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
      ReturnValues: "UPDATED_NEW",
    });

    const response = await client.send(command);
    const updatedCount = Number(response.Attributes?.count ?? 1);

    return {
      allowed: true,
      currentCount: updatedCount,
      limit,
    };
  } catch (error: any) {
    if (
      error.name === "ConditionalCheckFailedException" ||
      error.code === "ConditionalCheckFailedException"
    ) {
      return {
        allowed: false,
        currentCount: limit,
        limit,
      };
    }

    console.error("Failed to check/increment daily chat cap:", error);
    // On unexpected DynamoDB error, fail open with warning to avoid breaking user chats,
    // while logging error for operational monitoring.
    return {
      allowed: true,
      currentCount: -1,
      limit,
    };
  }
}

/**
 * Retrieves the current daily chat usage without incrementing.
 */
export async function getDailyChatUsage(
  options: CapCheckOptions = {}
): Promise<{ count: number; limit: number }> {
  const limit = options.limit ?? parseInt(process.env.DAILY_CHAT_REQUEST_CAP || "100", 10);
  const tableName = options.tableName ?? USAGE_COUNTERS_TABLE;
  const dateKey = options.dateKey ?? getUtcDateString();
  const counterId = `chat_daily#${dateKey}`;
  const client = options.client ?? ddbDocClient;

  try {
    const response = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { counterId },
      })
    );

    return {
      count: Number(response.Item?.count ?? 0),
      limit,
    };
  } catch (error) {
    console.error("Failed to retrieve daily chat usage:", error);
    return { count: 0, limit };
  }
}
