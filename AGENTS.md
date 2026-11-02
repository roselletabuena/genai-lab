# AGENTS.md — Repository Architecture & Agent Guidelines

Welcome to `genai-lab`! This document is the single source of truth for AI coding agents and human developers pair-programming in this repository. Follow these guidelines to maintain architectural integrity, consistent code conventions, and high test confidence.

---

## 1. System Architecture Overview

`genai-lab` is a modern AI-native monorepo structured into three distinct layers:

```mermaid
graph TD
    Client["Frontend (Next.js 16 UI)\nPort 3000"]
    API["Backend (Fastify 5 API / Lambda)\nPort 3001"]
    Infra["Infra (AWS SAM / LocalStack)"]
    Bedrock["AWS Bedrock / DynamoDB / S3"]

    Client -->|"HTTP / SSE (x-internal-api-key)"| API
    API -->|"AWS SDK v3"| Bedrock
    Infra -.->|"Provisions & Orchestrates"| API
```

### 1.1 `backend/` — Fastify 5 REST API & Lambda Handler
- **Framework**: Fastify 5 with TypeScript (`fastify-cli`, `@fastify/autoload`).
- **Deployment Targets**: Runs standalone locally (`port 3001`) and in AWS Lambda via `@fastify/aws-lambda` (`backend/src/lambda.ts`).
- **Core Capabilities**:
  - Bedrock converse and streaming chat orchestrator with tool-calling capabilities (`backend/src/lib/bedrock/`).
  - DynamoDB-backed daily chat usage cap and visitor rate limiting (`backend/src/services/usageCounterService.ts`).
  - Strict header-based internal authorization (`backend/src/utils/auth.ts`, `backend/src/authorizer.ts`) validating `x-internal-api-key`.
- **Testing**: Native Node.js test runner (`node --test`) with `c8` code coverage and `ts-node/register`.

### 1.2 `frontend/` — Next.js 16 UI
- **Framework**: Next.js 16 (App Router) with React 19.
- **Styling & UI**: Tailwind CSS v4, shadcn/radix-ui primitives, Lucide React icons, and Motion (`motion`) animations.
- **Agent Note**: Read [frontend/AGENTS.md](file:///frontend/AGENTS.md) for breaking changes and conventions in Next.js 16.
- **Communication**: Interacts with the backend via fetch calls and SSE streams, passing the required authorization headers.

### 1.3 `infra/` — AWS SAM Infrastructure
- **Tooling**: AWS Serverless Application Model (SAM) with `template.yaml` and `samconfig.toml`.
- **Local Emulation**: Docker Compose and LocalStack (`infra/localstack-init.sh`) simulating API Gateway, Lambda, DynamoDB, and S3.
- **Environments**: Parameterized environment configurations in `infra/environments/`.

---

## 2. Non-Negotiable Coding & Verification Conventions

1. **Strict TypeScript**:
   - Zero tolerance for unresolved type errors. Always run typechecking before proposing or committing changes.
   - Avoid `any`. Prefer explicit interfaces, generics, and discriminated unions (e.g., `StreamChunk`).
2. **Prettier Code Formatting**:
   - All code must conform to the root [.prettierrc](file:///.prettierrc).
   - Use `npm run format:check` to check compliance and `npm run format` to automatically apply fixes.
3. **Frontend Linting**:
   - Frontend must pass `npm run lint` (ESLint) with zero errors.
4. **Zero Committed Secrets**:
   - Never commit `.env`, `.env.local`, or secret tokens.
   - Use [.env.example](file:///backend/.env.example) to document newly required environment variables.
   - All internal endpoints fail closed when `INTERNAL_API_KEY` is not configured.
5. **Atomic Conventional Commits**:
   - Group changes into single-purpose, bisectable commits following the Conventional Commits specification:
     ```text
     <type>(<scope>): [<JIRA-KEY>] <imperative description>
     ```
   - Examples:
     - `feat(verify): [GL-46] add root verification scripts and agent guidelines`
     - `fix(format): [GL-46] resolve prettier formatting in bedrock stream collector`
6. **Isolated Git Worktrees**:
   - AI agents and automated tools must work in isolated git worktrees (`.worktrees/<branch-name>`) created off latest `origin/main` to avoid contaminating active development branches.

---

## 3. Standard Development Commands

### 3.1 Repository Root Commands (Monorepo Workspaces)

| Command | Action | Scope / Notes |
| :--- | :--- | :--- |
| `npm run verify` | Runs format check, lint, and typecheck across all workspaces | **Primary Quality Gate**: must exit `0` |
| `npm run typecheck` | Strict TypeScript validation across packages | Runs `tsc --noEmit` on backend and frontend |
| `npm run format:check` | Checks Prettier formatting across workspaces | Non-destructive check |
| `npm run format` | Automatically formats files across workspaces | Runs Prettier with write |
| `npm run lint` | Runs linters across workspaces | Runs ESLint on frontend |
| `npm run test` | Runs test suites across workspaces | Runs backend test suite |
| `npm run build` | Compiles backend TypeScript and builds frontend | Workspace-wide build |

### 3.2 Backend Package Commands (`backend/`)

```bash
cd backend
npm run dev           # Start TypeScript compilation watcher + Fastify server (port 3001)
npm run build:ts      # Compile TypeScript files into dist/
npm test              # Run unit and integration tests with coverage report
npm run typecheck     # Typecheck src/ and test/ suites without emitting code
npm run format:check  # Check formatting of backend files
npm run format        # Format backend files with Prettier
```

### 3.3 Frontend Package Commands (`frontend/`)

```bash
cd frontend
npm run dev           # Start Next.js local development server (port 3000)
npm run build         # Build production Next.js bundle
npm run lint          # Run ESLint validation
npm run typecheck     # Typecheck frontend app and components
npm run format:check  # Check formatting of frontend files
npm run format        # Format frontend files with Prettier
```

### 3.4 Infrastructure Commands (`infra/`)

```bash
# Start LocalStack and dependencies via Docker Compose (from root)
docker-compose up -d

# Build SAM application
sam build --template infra/template.yaml

# Run local API Gateway emulation
sam local start-api -t infra/template.yaml -p 3001
```
