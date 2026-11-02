---
trigger: always_on
description: Consult the graphify knowledge graph at .agents/knowledge-graph/ and graphify-out/ for codebase and architecture questions.
---

## graphify

This repository maintains an Abstract Syntax Tree (AST) knowledge graph at `.agents/knowledge-graph/` and `graphify-out/`.

Rules:

- For codebase, dependency, or architecture inquiries, when `graph.json` exists in `.agents/knowledge-graph/` or `graphify-out/`, use `npm run graph:query "<target>"` or `graphify query "<question>"`.
- Use `graphify path "<A>" "<B>"` for dependency paths and `graphify explain "<concept>"` for focused symbol understanding.
- Read `.agents/knowledge-graph/GRAPH_REPORT.md` (or `graphify-out/GRAPH_REPORT.md`) for broader structural review, component boundaries, and module clustering.
- **Freshness Guideline**: After completing a structural refactor, moving/adding files, or creating new route handlers/services, regenerate the index with `npm run graph:generate`.
- Before formulating technical implementation plans (`plan.md`) or performing major refactorings, consult the graph to trace dependencies and inbound callers in a single lookup.
