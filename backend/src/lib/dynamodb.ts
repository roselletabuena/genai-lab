import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

if (!process.env.LOCALSTACK_ENDPOINT) {
    require('dotenv').config();
}

const isLocal = process.env.USE_LOCALSTACK === 'true';

const client = new DynamoDBClient(
    isLocal
        ? {
            endpoint: 'http://localhost:4566',
            region: 'us-east-1',
            credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
        }
        : {
            region: process.env.AWS_REGION || 'us-east-1',
        }
);

export const dynamoClient = DynamoDBDocumentClient.from(client);
export const CHUNKS_TABLE = process.env.CHUNKS_TABLE || 'Chunks-dev';
export const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE || 'Documents-dev';
