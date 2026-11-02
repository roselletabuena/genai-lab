#!/usr/bin/env node

/**
 * scripts/generate-knowledge-graph.mjs
 *
 * Generates an AST knowledge graph of the repository using Graphify.
 * Maps components, routes, imports, and calls across frontend and backend.
 *
 * Produces artifacts in:
 * - graphify-out/
 * - .agents/knowledge-graph/ (mirrored for agent discovery)
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const graphifyOutDir = path.join(rootDir, "graphify-out");
const knowledgeGraphDir = path.join(rootDir, ".agents", "knowledge-graph");

export function isGraphifyAvailable() {
  try {
    execSync("graphify --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function copyArtifacts(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const filesToCopy = [
    "graph.json",
    "GRAPH_REPORT.md",
    "graph.html",
    "manifest.json",
    ".graphify_analysis.json",
  ];

  for (const file of filesToCopy) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
    }
  }
}

export function generateKnowledgeGraph() {
  console.log("Generating AST knowledge graph with Graphify...");

  if (!isGraphifyAvailable()) {
    console.warn(
      "[WARN] Graphify CLI is not detected in PATH. Please install Graphify (e.g., via pip/uv or graphify binary) to generate code AST knowledge graphs."
    );
    return false;
  }

  try {
    // 1. Run local AST extraction on code without external LLM keys
    console.log("[1/2] Running AST code extraction...");
    execSync("graphify . --code-only", {
      cwd: rootDir,
      stdio: "inherit",
    });

    // 2. Run clustering and report generation without requiring external labeling keys
    console.log("[2/2] Generating report and community clusters...");
    execSync("graphify cluster-only . --no-label", {
      cwd: rootDir,
      stdio: "inherit",
    });

    // 3. Mirror artifacts into .agents/knowledge-graph/
    copyArtifacts(graphifyOutDir, knowledgeGraphDir);

    console.log(
      `\n[SUCCESS] AST Knowledge graph successfully generated:` +
        `\n  - ${path.relative(rootDir, graphifyOutDir)}/graph.json` +
        `\n  - ${path.relative(rootDir, knowledgeGraphDir)}/graph.json` +
        `\n  - ${path.relative(rootDir, knowledgeGraphDir)}/GRAPH_REPORT.md`
    );
    return true;
  } catch (error) {
    console.error("[ERROR] Failed to generate AST knowledge graph:", error.message);
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  try {
    const success = generateKnowledgeGraph();
    process.exit(success ? 0 : 1);
  } catch {
    process.exit(1);
  }
}
