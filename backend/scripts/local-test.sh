#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 AI Document Assistant - Local Testing${NC}"
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Build TypeScript
echo -e "${YELLOW}📦 Building TypeScript...${NC}"
npm run build
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Build SAM
echo -e "${YELLOW}🔨 Building SAM application...${NC}"
sam build
echo -e "${GREEN}✅ SAM build complete${NC}"
echo ""

# Start local API
echo -e "${GREEN}🚀 Starting local API on http://localhost:3000${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Set environment variables for local testing
export ENVIRONMENT=local
export DOCUMENTS_TABLE=Documents-local
export CHUNKS_TABLE=Chunks-local
export DOCUMENTS_BUCKET=ai-doc-assistant-local
export AWS_REGION=ap-southeast-1

sam local start-api \
    --port 3000 \
    --warm-containers EAGER \
    --env-vars environments/local-env.json