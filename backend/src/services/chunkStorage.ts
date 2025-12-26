import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

interface Chunk {
    documentId: string;
    chunkId: string;
    content: string;
    chunkIndex: number;
    createdAt: string;
}

export class ChunkStorage {
    private docClient: DynamoDBDocumentClient;
    private tableName: string;

    constructor() {
        const client = new DynamoDBClient({ region: process.env.AWS_REGION });
        this.docClient = DynamoDBDocumentClient.from(client);
        this.tableName = process.env.CHUNKS_TABLE_NAME || 'DocumentChunks';
    }

    async storeChunks(documentId: string, chunks: string[]): Promise<void> {
        const putPromises = chunks.map((content, index) =>
            this.docClient.send(new PutCommand({
                TableName: this.tableName,
                Item: {
                    documentId,
                    chunkId: uuidv4(),
                    content,
                    chunkIndex: index,
                    createdAt: new Date().toISOString()
                }
            }))
        );

        await Promise.all(putPromises);
    }

    async getChunks(documentId: string): Promise<Chunk[]> {
        const result = await this.docClient.send(new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'documentId = :docId',
            ExpressionAttributeValues: {
                ':docId': documentId
            }
        }));

        return (result.Items || []) as Chunk[];
    }
}