#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-dev}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"

echo "=== Verifying CORS for environment: ${ENV} (region: ${REGION}) ==="

echo "1. Checking Lambda Function URL CORS configuration..."
aws lambda get-function-url-config \
  --function-name "my-ai-stack-stream-${ENV}" \
  --region "${REGION}" \
  --query "Cors" \
  --output json

echo "2. Checking S3 Documents Bucket CORS configuration..."
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
BUCKET_NAME="my-ai-stack-${ENV}-${ACCOUNT_ID}"
aws s3api get-bucket-cors \
  --bucket "${BUCKET_NAME}" \
  --output json

echo "CORS verification completed successfully."
