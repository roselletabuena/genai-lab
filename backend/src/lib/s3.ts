import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.LOCALSTACK_ENDPOINT) {
  require("dotenv").config();
}

const isLocal = process.env.USE_LOCALSTACK === "true";

export const s3Client = new S3Client(
  isLocal
    ? {
        endpoint: "http://localhost:4566",
        region: "us-east-1",
        credentials: { accessKeyId: "test", secretAccessKey: "test" },
        forcePathStyle: true,
      }
    : {
        region: process.env.AWS_REGION || "us-east-1",
      },
);

export const DOCUMENTS_BUCKET =
  process.env.DOCUMENTS_BUCKET || "ai-docs-bucket-local";
