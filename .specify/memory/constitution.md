<!--
Sync Impact Report:
- Version change: Uninitialized Template → 1.0.0
- Ratification Date: 2026-11-02
- Principles Defined:
  1. Test-Driven Development (TDD) at Public Seams (NON-NEGOTIABLE)
  2. Isolated Worktrees & Zero Main Contamination
  3. Strict Schema Validation & Contract Boundaries
  4. Atomic Commits & Jira Traceability
  5. Cloud-Native & LocalStack Parity
- Added Sections:
  - Technology Stack & Architectural Constraints
  - Development Workflow & Verification Gates
- Follow-up TODOs: None
-->

# genai-lab Constitution

## Core Principles

### I. Test-Driven Development (TDD) at Public Seams (NON-NEGOTIABLE)
Development MUST follow the Red-Green-Refactor loop. Tests are written against public interfaces (seams) before implementation begins, never coupled to internal implementation details or private methods.
- Every acceptance criterion MUST have at least one test case traced to it.
- Mocks are restricted to external boundary collaborators (AWS Bedrock, DynamoDB, S3) and MUST NOT mock internal module collaborators.
- No code is committed without passing the test suite and maintaining zero regressions.
*Rationale: Decoupling tests from internals ensures refactorability without breaking suites, and tracer-bullet testing guarantees that code satisfies genuine user requirements.*

### II. Isolated Worktrees & Zero Main Contamination
Agents and developers MUST NOT implement features or bugfixes directly on dirty working trees or long-lived shared branches.
- Implementation MUST occur within an isolated git worktree (`.worktrees/<branch-name>` or `../genai-lab-wt-<key>`) branched off latest `origin/main`.
- Branch names MUST follow `<type>/<JIRA-KEY>-<kebab-case-slug>` (e.g., `feat/GL-22-daily-request-caps-and-throttling`).
- Worktrees MUST be cleaned up after PR submission and merge.
*Rationale: Prevents partial state leakage, cross-task branch contamination, and accidental overwriting of uncommitted local changes.*

### III. Strict Schema Validation & Contract Boundaries
All system inputs, API routes, and agent payloads MUST be explicitly validated at entry boundaries using Zod schemas.
- Fastify routes MUST validate incoming request headers, queries, and bodies before delegating to domain services.
- AWS Bedrock streaming responses and DynamoDB items MUST be deserialized into typed domain models.
- Failures at validation boundaries MUST return structured, machine-readable error responses with appropriate HTTP status codes (e.g., 400 for bad payloads, 401/403 for unauthorized access, 429 for rate limit breaches).
*Rationale: Strong runtime typing prevents malformed inputs and prompt injection vulnerabilities from penetrating core business logic.*

### IV. Atomic Commits & Jira Traceability
Changes MUST be organized into bisectable, single-logical-unit commits following Conventional Commits.
- Each commit MUST address one concern (formatting, refactoring, feature logic, and test additions MUST NOT be combined in a single commit).
- Commit message format: `<type>(<scope>): [<JIRA-KEY>] <imperative subject>`.
- Every commit MUST independently compile and pass linting/typechecking.
*Rationale: Preserves clear git history, simplifies cherry-picking and rollback debugging, and provides complete traceability back to Jira requirements.*

### V. Cloud-Native & LocalStack Parity
Features relying on AWS cloud infrastructure (Lambda, DynamoDB, S3, Bedrock) MUST be deployable via AWS SAM and testable locally.
- Local environments MUST operate against LocalStack and Docker Compose services (`infra/docker-compose.yml`) without requiring live cloud credentials for basic integration runs.
- CloudFormation/SAM templates in `infra/template.yaml` serve as the infrastructure source of truth; manual cloud console provisioning is prohibited.
*Rationale: Guarantees reproducible developer environments and deterministic CI/CD deployments via GitHub Actions.*

## Technology Stack & Architectural Constraints

1. **Backend**:
   - Runtime: Node.js 20+ with Fastify 5 and TypeScript (ESM modules).
   - Serverless: `@fastify/aws-lambda` packaged via AWS SAM for Lambda execution.
   - AWS SDK: `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-bedrock-agent-runtime`, `@aws-sdk/client-dynamodb`, `@aws-sdk/client-s3`.
   - Security: Constant-time comparison (`crypto.timingSafeEqual`) for API keys and authorizers.

2. **Frontend**:
   - Framework: Next.js 16 (App Router) + React 19.
   - Styling: Tailwind CSS v4 with Shadcn/Radix UI component primitives.
   - Architecture: Clean separation of Server and Client Components.

3. **Infrastructure**:
   - AWS SAM (`infra/template.yaml`, `infra/samconfig.toml`).
   - LocalStack containerization for DynamoDB and S3 local emulation.

## Development Workflow & Verification Gates

Before any commit or pull request is finalized, changes MUST satisfy the local Quality Verification Gate:

| Gate | Check Command | Requirement |
| :--- | :--- | :--- |
| **Type Safety** | `npm run build:ts` (backend) / `npx tsc --noEmit` | 0 errors |
| **Formatting** | `npm run format:check` or `npx prettier --check .` | Clean formatting |
| **Linting** | `npm run lint` or `npx eslint .` | 0 errors |
| **Unit & Integration Tests** | `npm test` | All tests pass, zero regressions |

- Pull requests MUST be rebased cleanly onto latest `origin/main` before submission.
- PR descriptions MUST link the corresponding Jira issue key and parent epic.

## Governance

1. **Supremacy**: This Constitution represents the governing architectural agreement for `genai-lab`. All feature specifications (`spec.md`), technical blueprints (`plan.md`), task decompositions (`tasks.md`), and automated agent implementations MUST comply with its principles.
2. **Amendments**: Amendments require an explicit proposal describing the motivation, architectural trade-offs, and affected modules. Amendments increment the Constitution version according to SemVer rules.
3. **Compliance Review**: All automated PR reviews and manual approvals must verify adherence to the principles defined herein.

**Version**: 1.0.0 | **Ratified**: 2026-11-02 | **Last Amended**: 2026-11-02
