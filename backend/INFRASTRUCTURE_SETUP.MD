# Infrastructure Setup Guide

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] AWS Account created
- [ ] AWS CLI installed and configured
- [ ] SAM CLI installed
- [ ] Docker Desktop installed and running
- [ ] Node.js 20+ installed
- [ ] Git installed

---

## 🚀 Quick Start (30 minutes)

### Step 1: File Structure Setup (5 minutes)

Create the following folders and files in your `backend/` directory:

```bash
cd backend

# Create folders
mkdir -p environments scripts

# Make scripts executable
chmod +x scripts/*.sh
```

Add these files:
- ✅ `template.yaml` (root of backend/)
- ✅ `samconfig.toml` (root of backend/)
- ✅ `environments/dev.json`
- ✅ `environments/prod.json`
- ✅ `environments/local-env.json`
- ✅ `scripts/deploy.sh`
- ✅ `scripts/local-test.sh`
- ✅ `scripts/setup-aws.sh`

### Step 2: Verify AWS Setup (5 minutes)

```bash
# Run the setup verification script
./scripts/setup-aws.sh
```

This will check:
- ✅ AWS CLI installed
- ✅ SAM CLI installed
- ✅ Docker running
- ✅ AWS credentials configured
- ✅ Bedrock access enabled

**Fix any ❌ errors before proceeding!**

### Step 3: Request Bedrock Access (2 minutes, wait 1-2 days)

1. Go to [AWS Console](https://console.aws.amazon.com/) → Bedrock
2. Click "Model access" in left sidebar
3. Click "Manage model access"
4. Select **Anthropic → Claude Sonnet 4**
5. Click "Request model access"
6. Wait for approval email (usually instant, sometimes 1-2 days)

### Step 4: Update package.json (2 minutes)

Add these scripts to your `backend/package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "deploy:dev": "./scripts/deploy.sh dev",
    "deploy:prod": "./scripts/deploy.sh prod",
    "local": "./scripts/local-test.sh",
    "setup": "./scripts/setup-aws.sh"
  }
}
```

### Step 5: First Deployment (15 minutes)

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to dev environment
npm run deploy:dev
```

**Expected output:**
```
✅ TypeScript build successful
✅ SAM template valid
✅ SAM build successful
✅ Deployment successful!

📋 Stack Outputs:
ApiUrl: https://xxx.execute-api.ap-southeast-1.amazonaws.com/dev
ApiKeyId: xxx
DocumentsBucketName: ai-doc-assistant-dev-123456789
```

**Save your API Key!** You'll need it for the frontend.

---

## 🔍 Verify Deployment

### Check CloudFormation Stack

```bash
aws cloudformation describe-stacks \
  --stack-name ai-doc-assistant-dev \
  --query 'Stacks[0].StackStatus'
```

Should return: `"CREATE_COMPLETE"`

### Test API Gateway

```bash
# Get your API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name ai-doc-assistant-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Get your API Key
API_KEY_ID=$(aws cloudformation describe-stacks \
  --stack-name ai-doc-assistant-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiKeyId`].OutputValue' \
  --output text)

API_KEY=$(aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --query 'value' \
  --output text)

# Test GET /documents endpoint
curl -X GET "${API_URL}/documents" \
  -H "x-api-key: ${API_KEY}"
```

Expected response: `{"documents": []}`

---

## 📊 Cost Monitoring Setup (10 minutes)

### Set Up Budget Alerts

1. Go to [AWS Billing Console](https://console.aws.amazon.com/billing/)
2. Click "Budgets" → "Create budget"
3. Choose "Cost budget"
4. Set budget amount: **₱1,000/month**
5. Add alerts at:
   - 50% (₱500) → Email notification
   - 80% (₱800) → Email notification
   - 100% (₱1,000) → Email notification

### Enable Cost Explorer (optional)

1. AWS Console → Cost Management → Cost Explorer
2. Click "Enable Cost Explorer"
3. Wait 24 hours for data to populate

---

## 🧪 Local Testing (Optional)

To test Lambda functions locally without deploying:

```bash
# Start local API
npm run local

# In another terminal, test endpoints
curl http://localhost:3000/documents
```

**Note:** You'll need Docker running for this to work.

---

## 🔧 Troubleshooting

### Issue: "Template validation failed"

**Solution:** Check YAML syntax in `template.yaml`
```bash
sam validate --lint
```

### Issue: "No Bedrock access"

**Solution:** 
1. Wait 1-2 days for approval
2. Check email for approval notification
3. Verify in Console → Bedrock → Model access

### Issue: "Rate exceeded" during deployment

**Solution:** CloudFormation limits - wait 1 minute and retry
```bash
npm run deploy:dev
```

### Issue: "Docker not running"

**Solution:** Start Docker Desktop and wait for it to fully load

### Issue: "AWS credentials not found"

**Solution:** Configure AWS CLI
```bash
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: ap-southeast-1
# - Default output format: json
```

---

## 📁 What Got Created in AWS?

After successful deployment, you'll have:

### S3 Bucket
- Name: `ai-doc-assistant-dev-{your-account-id}`
- Purpose: Store uploaded PDF files
- Features: Versioning enabled, CORS configured

### DynamoDB Tables
1. **Documents-dev**
   - Stores document metadata (name, uploadedAt, status)
   - On-demand billing

2. **Chunks-dev**
   - Stores text chunks for RAG
   - Indexed by documentId

### Lambda Functions
1. `ai-doc-assistant-upload-dev` - Handle uploads
2. `ai-doc-assistant-list-dev` - List documents
3. `ai-doc-assistant-delete-dev` - Delete documents
4. `ai-doc-assistant-process-dev` - Extract and chunk text
5. `ai-doc-assistant-query-dev` - RAG queries with Bedrock

### API Gateway
- REST API with 5 endpoints
- API Key authentication
- CORS enabled
- Rate limiting: 10 req/sec, 10,000/month

### CloudWatch Log Groups
- One per Lambda function
- 7-day retention (to save costs)

---

## 🎯 Next Steps

Now that infrastructure is deployed:

1. **Save your API credentials** (add to `.env` file)
   ```
   VITE_API_URL=https://xxx.execute-api.ap-southeast-1.amazonaws.com/dev
   VITE_API_KEY=your-api-key-here
   ```

2. **Start building Lambda handlers** (Week 2)
   - Begin with `uploadDocument.ts`
   - Test locally with SAM

3. **Connect frontend** (Week 1-2)
   - Update API client with real endpoints
   - Test file upload flow

---

## 💰 Expected Costs (First Month)

| Service | Cost Estimate |
|---------|--------------|
| Lambda | ₱0-50 (mostly free tier) |
| API Gateway | ₱20-50 |
| S3 | ₱50-100 |
| DynamoDB | ₱0-50 (on-demand) |
| Bedrock | ₱300-500 (main cost) |
| CloudWatch | ₱20-50 |
| **Total** | **₱500-800/month** |

**Free tier coverage:**
- Lambda: 1M requests/month free
- DynamoDB: 25GB storage free
- S3: 5GB storage free
- API Gateway: 1M requests free (first 12 months)

---

## 🔒 Security Best Practices

✅ API Key authentication enabled
✅ S3 bucket is private (no public access)
✅ IAM roles follow least-privilege principle
✅ CloudWatch logging enabled for auditing
✅ CORS configured (update in prod!)

**Before going to production:**
- [ ] Change `AllowedOrigins` from `*` to your domain
- [ ] Enable AWS WAF (optional, costs extra)
- [ ] Set up CloudWatch alarms
- [ ] Enable S3 bucket encryption
- [ ] Review IAM policies

---

## 📞 Getting Help

If stuck:
1. Check CloudWatch logs for Lambda errors
2. Validate SAM template: `sam validate --lint`
3. Check CloudFormation events in AWS Console
4. Review this guide's troubleshooting section

**Common commands:**
```bash
# View deployment logs
sam logs -n UploadDocumentFunction --stack-name ai-doc-assistant-dev --tail

# Delete stack (careful!)
aws cloudformation delete-stack --stack-name ai-doc-assistant-dev

# Update existing deployment
npm run deploy:dev
```

---

## ✅ Deployment Checklist

Before marking this phase complete:

- [ ] All 8 files created in backend/
- [ ] `setup-aws.sh` runs without errors
- [ ] Bedrock access approved
- [ ] First deployment successful
- [ ] API Gateway responds to test requests
- [ ] Budget alerts configured
- [ ] API Key saved to `.env` file
- [ ] Git commit with message: "feat: AWS infrastructure setup complete"

**Time spent:** ~30-60 minutes
**Budget used:** ~₱0 (free tier)