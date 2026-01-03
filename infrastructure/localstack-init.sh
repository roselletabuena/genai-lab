#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
sleep 5

# Create S3 bucket
echo "Creating S3 bucket: ai-docs-bucket-local"
awslocal s3 mb s3://ai-docs-bucket-local

# Create DynamoDB Tables
echo "Creating DynamoDB table: Documents-dev"
awslocal dynamodb create-table \
    --table-name Documents-dev \
    --attribute-definitions \
        AttributeName=documentId,AttributeType=S \
        AttributeName=userId,AttributeType=S \
        AttributeName=uploadedAt,AttributeType=N \
    --key-schema \
        AttributeName=documentId,KeyType=HASH \
    --global-secondary-indexes \
        '[{
            "IndexName": "UserIdIndex",
            "KeySchema": [{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"uploadedAt","KeyType":"RANGE"}],
            "Projection": {"ProjectionType":"ALL"}
        }]' \
    --billing-mode PAY_PER_REQUEST

echo "Creating DynamoDB table: Chunks-dev"
awslocal dynamodb create-table \
    --table-name Chunks-dev \
    --attribute-definitions \
        AttributeName=chunkId,AttributeType=S \
        AttributeName=documentId,AttributeType=S \
    --key-schema \
        AttributeName=chunkId,KeyType=HASH \
    --global-secondary-indexes \
        '[{
            "IndexName": "DocumentIdIndex",
            "KeySchema": [{"AttributeName":"documentId","KeyType":"HASH"}],
            "Projection": {"ProjectionType":"ALL"}
        }]' \
    --billing-mode PAY_PER_REQUEST

echo "LocalStack initialization complete!"
