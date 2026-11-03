import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { queryDependencies } from "../../scripts/query-knowledge-graph.mjs";
import { verifyKnowledgeGraph } from "../../scripts/verify-knowledge-graph.mjs";

describe("AST Knowledge Graph Integration & Verification (GL-51)", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const knowledgeGraphJson = path.join(rootDir, ".agents", "knowledge-graph", "graph.json");
  const agentsMdPath = path.join(rootDir, "AGENTS.md");

  describe("TC-1.6-01: Graphify indexing script and configuration (AC1)", () => {
    it("creates valid graph index files with nodes, edges, and report", (t) => {
      if (!fs.existsSync(knowledgeGraphJson)) {
        t.skip("Knowledge graph index not generated in this environment");
        return;
      }

      assert.strictEqual(
        fs.existsSync(knowledgeGraphJson),
        true,
        "Expected .agents/knowledge-graph/graph.json to exist"
      );

      const raw = fs.readFileSync(knowledgeGraphJson, "utf8");
      const graph = JSON.parse(raw);

      assert.strictEqual(Array.isArray(graph.nodes), true, "Graph should have nodes array");
      assert.strictEqual(graph.nodes.length > 50, true, "Graph should have extracted code nodes");

      const links = graph.links || graph.edges;
      assert.strictEqual(Array.isArray(links), true, "Graph should have links/edges array");
      assert.strictEqual(links.length > 50, true, "Graph should have relationships");

      const reportPath = path.join(rootDir, ".agents", "knowledge-graph", "GRAPH_REPORT.md");
      assert.strictEqual(fs.existsSync(reportPath), true, "GRAPH_REPORT.md should exist");
    });
  });

  describe("TC-1.6-02: Navigation query capability (AC2)", () => {
    it("traces backend/src/routes/portfolio/index.ts to dependent services and imports in a single lookup", (t) => {
      if (!fs.existsSync(knowledgeGraphJson)) {
        t.skip("Knowledge graph index not generated in this environment");
        return;
      }

      const result = queryDependencies("backend/src/routes/portfolio/index.ts");

      assert.strictEqual(result.matchingNodes.length > 0, true, "Should match route nodes");

      // Verify link to portfolioService.ts
      const portfolioServiceDep = result.dependencies.some(
        (dep: { file: string; symbol: string }) =>
          dep.file.includes("portfolioService") || dep.symbol.includes("portfolioService")
      );
      assert.strictEqual(
        portfolioServiceDep,
        true,
        "Query result must reveal link to portfolioService.ts"
      );

      // Verify link to auth or schema dependencies
      const authDep = result.dependencies.some((dep: { file: string }) =>
        dep.file.includes("auth.ts")
      );
      assert.strictEqual(authDep, true, "Query result must reveal link to auth.ts");
    });
  });

  describe("TC-1.6-03: Freshness instruction in AGENTS.md (AC3)", () => {
    it("specifies when and how to regenerate graph index in AGENTS.md", () => {
      assert.strictEqual(fs.existsSync(agentsMdPath), true, "AGENTS.md should exist");
      const content = fs.readFileSync(agentsMdPath, "utf8");

      assert.match(
        content,
        /npm run graph:generate/,
        "AGENTS.md must document npm run graph:generate"
      );
      assert.match(content, /npm run graph:query/, "AGENTS.md must document npm run graph:query");
      assert.match(
        content,
        /Structural Refactoring/i,
        "AGENTS.md must specify structural refactoring triggers"
      );
      assert.match(
        content,
        /Knowledge Graph Freshness Guidelines & Update Triggers/i,
        "AGENTS.md must contain freshness guidelines and update triggers"
      );
    });
  });

  describe("TC-1.6-04: Non-breaking fallback (AC4)", () => {
    it("verification passes gracefully with non-blocking warning when graphify prerequisites are absent", () => {
      const res = verifyKnowledgeGraph({ forceMissing: true });

      assert.strictEqual(res.ok, true, "Verification must succeed (exit 0 / ok: true)");
      assert.strictEqual(
        res.status,
        "skipped",
        "Verification status should be skipped when dependencies are missing"
      );
    });

    it("verifies knowledge graph correctly when present", (t) => {
      const res = verifyKnowledgeGraph({ forceMissing: false });

      assert.strictEqual(res.ok, true, "Verification must succeed");
      if (res.status === "skipped" || res.status === "missing_index") {
        t.skip("Graphify CLI or knowledge graph index absent in current environment");
        return;
      }
      assert.strictEqual(res.status, "verified", "Verification status should be verified");
      assert.strictEqual(typeof res.nodeCount, "number");
      assert.strictEqual((res.nodeCount ?? 0) > 0, true);
    });
  });
});
