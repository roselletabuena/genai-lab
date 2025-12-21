#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
sleep 5

# Create S3 bucket
echo "Creating S3 bucket: ai-docs-bucket-local"
awslocal s3 mb s3://ai-docs-bucket-local

echo "LocalStack initialization complete!"
