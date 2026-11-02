import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

if (!process.env.LOCALSTACK_ENDPOINT) {
  require("dotenv").config();
}

const isLocal = process.env.USE_LOCALSTACK === "true";

export const ddbClient = new DynamoDBClient(
  isLocal
    ? {
        endpoint: "http://localhost:4566",
        region: "us-east-1",
        credentials: { accessKeyId: "test", secretAccessKey: "test" },
      }
    : {
        region: process.env.AWS_REGION || "us-east-1",
      }
);

export const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const PORTFOLIO_USERS_TABLE = process.env.PORTFOLIO_USERS_TABLE || "PortfolioUsers-dev";
export const USAGE_COUNTERS_TABLE = process.env.USAGE_COUNTERS_TABLE || "UsageCounters-dev";
