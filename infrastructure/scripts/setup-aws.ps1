# AI Document Assistant - Deployment Script (Windows)
param(
    [Parameter(Position=0)]
    [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 AI Document Assistant - Deployment Script" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host ""

# Validate environment
if ($Environment -notin @("dev", "staging", "prod")) {
    Write-Host "❌ Invalid environment: $Environment" -ForegroundColor Red
    Write-Host "Usage: .\scripts\deploy.ps1 [dev|staging|prod]" -ForegroundColor White
    exit 1
}

# Check if AWS CLI is installed
try {
    aws --version | Out-Null
} catch {
    Write-Host "❌ AWS CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

# Check if SAM CLI is installed
try {
    sam --version | Out-Null
} catch {
    Write-Host "❌ SAM CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

# Check AWS credentials
Write-Host "🔐 Checking AWS credentials..." -ForegroundColor Yellow
try {
    aws sts get-caller-identity | Out-Null
    Write-Host "✅ AWS credentials valid" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS credentials not configured" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Build TypeScript
Write-Host "📦 Building TypeScript..." -ForegroundColor Yellow
npm run build:ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ TypeScript build successful" -ForegroundColor Green
Write-Host ""

# SAM Validate
Write-Host "🔍 Validating SAM template..." -ForegroundColor Yellow
sam validate --lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SAM template validation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ SAM template valid" -ForegroundColor Green
Write-Host ""

# SAM Build
Write-Host "🔨 Building SAM application..." -ForegroundColor Yellow
sam build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SAM build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ SAM build successful" -ForegroundColor Green
Write-Host ""

# SAM Deploy
Write-Host "🚢 Deploying to AWS ($Environment)..." -ForegroundColor Yellow
sam deploy --config-env $Environment --no-confirm-changeset --no-fail-on-empty-changeset

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host ""

# Get outputs
Write-Host "📋 Stack Outputs:" -ForegroundColor Yellow
aws cloudformation describe-stacks --stack-name "ai-doc-assistant-$Environment" --query 'Stacks[0].Outputs' --output table

# Get API Key
Write-Host ""
Write-Host "🔑 Retrieving API Key..." -ForegroundColor Yellow
$apiKeyId = aws cloudformation describe-stacks --stack-name "ai-doc-assistant-$Environment" --query 'Stacks[0].Outputs[?OutputKey==`ApiKeyId`].OutputValue' --output text

if ($apiKeyId) {
    $apiKeyValue = aws apigateway get-api-key --api-key $apiKeyId --include-value --query 'value' --output text
    Write-Host "API Key: $apiKeyValue" -ForegroundColor Green
    Write-Host "⚠️  Save this key securely! Add it to your frontend .env file" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green