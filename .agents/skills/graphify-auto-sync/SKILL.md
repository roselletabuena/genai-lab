---
name: graphify-auto-sync
description: Automatically evaluates codebase state and triggers incremental Graphify knowledge graph syncs at feature completion boundaries, schema migrations, and before new architectural planning.
triggers:
  - "Feature branch / user story completed (all tasks in tasks.md checked off)"
  - "Structural file modifications, component creation, or route additions"
  - "Before initializing speckit-plan or architectural refactoring"
  - "When 5+ new source files or components have been created or moved"
---

# Graphify Auto-Sync Skill

## Purpose

Maintain an up-to-date Abstract Syntax Tree (AST) and component dependency graph in `.agents/knowledge-graph/` and `graphify-out/` without manual developer overhead.

---

## 🎯 When to Auto-Trigger Sync

The agent must automatically evaluate and execute this skill under the following conditions:

1. **Feature Completion Boundary**:
   - All tasks in `specs/<feature>/tasks.md` are marked complete (`[x]`).
   - Tests have passed and the feature branch is ready for review/PR.
2. **Structural & Route Modifications**:
   - Any change adding, removing, or refactoring routes (e.g. `backend/src/routes/`), services, or frontend components.
3. **Pre-Planning Phase**:
   - Before generating a new `plan.md` for a user story, ensure the knowledge graph is synchronized with recent changes.
4. **Substantial Codebase Expansion**:
   - When multiple new routes, hooks, components, or utilities have been added.

---

## ⚡ Execution Workflow

### Step 1: Run Graph Generation

Run repository AST indexing:

```bash
npm run graph:generate
```

This runs local tree-sitter AST extraction and community clustering (zero LLM token cost) and mirrors outputs to `.agents/knowledge-graph/` and `graphify-out/`.

### Step 2: Verify Output Artifacts

Confirm that artifacts exist:
- `.agents/knowledge-graph/graph.json` (Knowledge graph payload)
- `.agents/knowledge-graph/GRAPH_REPORT.md` (Human-readable architecture summary)
- `.agents/knowledge-graph/graph.html` (Interactive visual graph)

### Step 3: Query the Graph for Context

Leverage the refreshed graph for technical navigation:

```bash
npm run graph:query "<symbol-or-path>"
```

Or via Graphify CLI directly:
- `graphify query "<concept or component>"`
- `graphify path "<SourceComponent>" "<TargetService>"`
- `graphify explain "<ComponentName>"`

---

## 🛡️ Anti-Patterns (When NOT to Trigger)

- ❌ Do NOT trigger on single-line typo fixes, CSS styling tweaks, or minor text changes.
- ❌ Do NOT trigger in the middle of active task execution before code compiles.
