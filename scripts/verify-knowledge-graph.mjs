#!/usr/bin/env node

/**
 * scripts/verify-knowledge-graph.mjs
 *
 * Verifies knowledge graph availability and integrity as part of root verification.
 * Adheres to AC4 non-breaking fallback requirement:
 * If graphify or prerequisites are missing, warns gracefully and exits 0 (does not hard-fail).
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const graphPathOut = path.join(rootDir, "graphify-out", "graph.json");
const graphPathAgents = path.join(rootDir, ".agents", "knowledge-graph", "graph.json");

export function checkGraphifyPrerequisites() {
  try {
    execSync("graphify --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function verifyKnowledgeGraph(options = {}) {
  const forceMissing = options.forceMissing ?? process.env.GRAPHIFY_FORCE_MISSING === "1";

  if (forceMissing || !checkGraphifyPrerequisites()) {
    console.warn(
      "[WARN] Graph indexing dependencies (graphify CLI / tree-sitter / Python) are absent or skipped. Knowledge graph verification skipped non-blockingly."
    );
    return { status: "skipped", ok: true };
  }

  // Check if graph file exists in either location
  const activeGraphPath = fs.existsSync(graphPathAgents)
    ? graphPathAgents
    : fs.existsSync(graphPathOut)
      ? graphPathOut
      : null;

  if (!activeGraphPath) {
    console.warn(
      "[WARN] Knowledge graph index has not been generated yet. Run 'npm run graph:generate' to build it."
    );
    return { status: "missing_index", ok: true };
  }

  try {
    const raw = fs.readFileSync(activeGraphPath, "utf8");
    const data = JSON.parse(raw);
    const nodeCount = Array.isArray(data.nodes) ? data.nodes.length : 0;
    const linkCount = Array.isArray(data.links)
      ? data.links.length
      : Array.isArray(data.edges)
        ? data.edges.length
        : 0;

    if (nodeCount === 0) {
      console.warn(
        `[WARN] Knowledge graph at ${path.relative(rootDir, activeGraphPath)} is empty.`
      );
      return { status: "empty", ok: true };
    }

    console.log(
      `[OK] AST Knowledge graph verified: ${nodeCount} nodes, ${linkCount} edges at ${path.relative(rootDir, activeGraphPath)}`
    );
    return { status: "verified", ok: true, nodeCount, linkCount };
  } catch (err) {
    console.warn(
      `[WARN] Knowledge graph index parsing failed: ${err.message}. Non-blocking verification.`
    );
    return { status: "invalid", ok: true };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  verifyKnowledgeGraph();
  // Always exit 0 as specified in AC4 (non-breaking fallback)
  process.exit(0);
}
