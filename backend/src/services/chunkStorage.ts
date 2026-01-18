import { QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient, CHUNKS_TABLE } from "../lib/dynamodb";
import { v4 as uuidv4 } from "uuid";

export interface Chunk {
  chunkId: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  createdAt: string;
}

export async function storeChunks(
  documentId: string,
  chunks: string[],
): Promise<number> {
  const items = chunks.map((content, index) => ({
    chunkId: uuidv4(),
    documentId,
    content,
    chunkIndex: index,
    createdAt: new Date().toISOString(),
  }));

  // DynamoDB BatchWrite supports max 25 items per request
  const batchSize = 25;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await dynamoClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [CHUNKS_TABLE]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      }),
    );
  }

  return items.length;
}

export async function getChunksByDocumentId(
  documentId: string,
): Promise<Chunk[]> {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: CHUNKS_TABLE,
      IndexName: "DocumentIdIndex",
      KeyConditionExpression: "documentId = :docId",
      ExpressionAttributeValues: {
        ":docId": documentId,
      },
    }),
  );

  const chunks = (result.Items || []) as Chunk[];
  return chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

export async function deleteChunksByDocumentId(
  documentId: string,
): Promise<number> {
  const chunks = await getChunksByDocumentId(documentId);

  if (chunks.length === 0) return 0;

  // Delete in batches of 25
  const batchSize = 25;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    await dynamoClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [CHUNKS_TABLE]: batch.map((chunk) => ({
            DeleteRequest: { Key: { chunkId: chunk.chunkId } },
          })),
        },
      }),
    );
  }

  return chunks.length;
}
