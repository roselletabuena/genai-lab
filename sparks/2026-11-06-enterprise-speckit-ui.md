<!-- Recommended filename: sparks/2026-11-06-enterprise-speckit-ui.md -->

# Enterprise SpecKit UI: The "Living Spec" Platform

> **Quick Summary**: A centralized, visual web application that treats software specifications as modular, role-owned blocks (PO, TA, UI/UX, Dev) with an invisible two-way Git synchronization bridge.

---

## 📌 Metadata

| Field                | Details                                                                                           |
| :------------------- | :------------------------------------------------------------------------------------------------ |
| **Date**             | 2026-11-06                                                                                        |
| **Author**           | @product-engineering                                                                              |
| **Source / Trigger** | Fragmented tooling (Jira, Confluence, Swagger, Figma, GitHub) and alignment friction in R&D scrum |
| **Stage**            | `🌱 Seedling`                                                                                     |
| **Domain / Tags**    | `speckit`, `workflow`, `developer-experience`, `frontend`, `git-sync`                             |

---

## 🎯 1. Source & Context

- In standard R&D scrum teams, product owners, architects, designers, and developers all work in isolated silos with disjointed tools.
- Non-technical stakeholders (POs) are effectively locked out of code-repository specification tools, while engineers lose context jumping across Jira, Confluence, Swagger, Figma, and Storybook.

---

## 🛑 2. The Friction (Problem Statement)

- **Current State & Pain**:
  - **Tooling Fragmentation**:
    - **POs** live in Jira & Confluence (business logic).
    - **TAs** live in Swagger, Backstage, or architecture markdown (API contracts & schemas).
    - **UI/UX** live in Figma or Zeplin (visual states & tokens).
    - **Devs** live in GitHub, Storybook, and their IDE (code implementation).
  - Developers are forced to mentally piece together a single feature across 4+ disconnected tools.
- **Impact of NOT Solving**:
  - Constant context-switching slows velocity.
  - Specs drift immediately out of sync with actual code.
  - Misalignment leads to rework when code diverges from product intent.

---

## 💡 3. The Proposal

### Core Concept

A visual "Living Spec" platform where specifications are not flat static files, but composite, modular objects with strict role-based block ownership. Non-technical users interact via a rich-text UI, while the system automatically serializes and syncs changes to Git under the hood.

### Modular Block Ownership

- **Block A (Business) — Owned by PO**: Notion-style rich-text editor for User Stories and Acceptance Criteria. Once approved, locked for the sprint.
- **Block B (Architecture) — Owned by TA**: API contracts (OpenAPI/Swagger) and database schemas.
- **Block C (Design) — Owned by UI/UX**: Component mapping, Figma links, and visual states.
- **Block D (Implementation) — Owned by Devs**: Technical notes, change requests, and implementation status tracking.

### The Git Bridge (Invisible Two-Way Sync)

- When a PO hits **"Approve"** in the UI, the backend serializes the rich-text blocks into a standard format (`speckit.json`, Markdown, or schema).
- Automatically commits changes or opens a Pull Request directly against a designated `specs` branch in GitHub via GitHub REST API / App integration.

### Technical Stack & Architecture

- **Frontend**: Next.js (App Router), Tailwind CSS v4, shadcn/ui for an enterprise-ready component-first dashboard.
- **Data & Permissions**: PostgreSQL + Prisma managing relational drafts, comment threads, and block-level RBAC.
- **Integration Engine**: Node.js backend orchestrating GitHub REST API/webhooks, Jira sync, and extensible MCP (Model Context Protocol) server bridges.

### Phase 1 MVP Scope

Focus strictly on the **PO-to-Developer handoff**:

1. **PO Interface**: Rich-text editor to author and approve business requirements (Block A).
2. **Dev Interface**: Read-only view of the PO block with inline commenting/change requests.
3. **Two-Way Git Sync ("The Magic")**: Approval triggers programmatic generation of underlying JSON/Markdown and commits it to a dedicated branch in GitHub.

---

## ⚖️ 4. Quick Gut-Check (Value vs. Effort)

| Dimension                         |    Rating    | Notes                                                                              |
| :-------------------------------- | :----------: | :--------------------------------------------------------------------------------- |
| **Potential Value / Impact**      |   **High**   | Eliminates spec drift, unifies PO/Dev alignment, single source of truth            |
| **Estimated Effort / Complexity** |  **Medium**  | Phase 1 MVP is tightly scoped around GitHub API commit serialization and rich-text |
| **Reversibility**                 | Two-way door | Can run alongside existing workflows without breaking repository code              |

---

## ❓ 5. Open Questions & Unknowns

- [ ] What rich-text editor library offers the cleanest Markdown/JSON AST export (e.g., Tiptap / Lexical / Novel)?
- [ ] How will Git merge conflicts be resolved if specs are edited concurrently in both Git and the UI?
- [ ] Will Git auth use a GitHub App bot token or individual user OAuth?
- [ ] How should spec approvals map to sprint/branch lifecycles (e.g., `main` vs. feature branches)?

---

## 🚀 6. Next Steps

- [ ] Review and validate Phase 1 MVP scope with stakeholders
- [ ] Research Tiptap / Lexical for block-based modular editing with JSON export
- [ ] Create a prototype spike demonstrating: UI rich-text edit &rarr; GitHub API commit to `specs/`
- [ ] Promote to formal architectural Spec (`specs/003-enterprise-speckit-ui/`) when ready
