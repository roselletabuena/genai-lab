#!/usr/bin/env node

/**
 * scripts/query-knowledge-graph.mjs
 *
 * Query helper for AST Knowledge Graph navigation.
 * Allows agents to look up symbols, files, routes, or components and discover:
 * - Dependent services, schemas, and libraries (outgoing dependencies)
 * - Inbound callers, consumers, and routes (incoming references)
 * - Community cluster assignment
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const graphPathAgents = path.join(rootDir, ".agents", "knowledge-graph", "graph.json");
const graphPathOut = path.join(rootDir, "graphify-out", "graph.json");

export function queryDependencies(targetQuery) {
  if (!targetQuery) {
    throw new Error(
      "Target query or file path is required. Example: npm run graph:query 'backend/src/routes/portfolio/index.ts'"
    );
  }

  const activeGraphPath = fs.existsSync(graphPathAgents)
    ? graphPathAgents
    : fs.existsSync(graphPathOut)
      ? graphPathOut
      : null;

  if (!activeGraphPath) {
    throw new Error("No graph.json found. Run 'npm run graph:generate' first.");
  }

  const raw = fs.readFileSync(activeGraphPath, "utf8");
  const data = JSON.parse(raw);
  const nodes = data.nodes || [];
  const links = data.links || data.edges || [];

  const queryNormalized = targetQuery.toLowerCase().replace(/\\/g, "/");

  // Find matching nodes
  const matchingNodes = nodes.filter((n) => {
    const id = (n.id || "").toLowerCase();
    const name = (n.name || "").toLowerCase();
    const file = (n.source_file || n.file || "").toLowerCase();
    return (
      id.includes(queryNormalized) ||
      name.includes(queryNormalized) ||
      file.includes(queryNormalized)
    );
  });

  if (matchingNodes.length === 0) {
    return {
      query: targetQuery,
      matchingNodes: [],
      dependencies: [],
      callers: [],
    };
  }

  const matchingIds = new Set(matchingNodes.map((n) => n.id));

  // Find outbound dependencies (source is in matchingIds)
  const outboundLinks = links.filter((l) => matchingIds.has(l.source));
  // Find inbound callers (target is in matchingIds)
  const inboundLinks = links.filter((l) => matchingIds.has(l.target));

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const formatLink = (l, isOutbound) => {
    const peerId = isOutbound ? l.target : l.source;
    const peerNode = nodeMap.get(peerId);
    return {
      symbol: peerNode?.name || peerId,
      file: peerNode?.source_file || peerNode?.file || l.source_file || "unknown",
      relation: l.relation || l.type || "references",
      context: l.context || "code",
      location: l.source_location || "N/A",
    };
  };

  const dependencies = outboundLinks.map((l) => formatLink(l, true));
  const callers = inboundLinks.map((l) => formatLink(l, false));

  return {
    query: targetQuery,
    matchingNodes: matchingNodes.map((n) => ({
      id: n.id,
      name: n.name || n.id,
      file: n.source_file || n.file,
      community: n.community,
    })),
    dependencies,
    callers,
  };
}

export function formatQueryResult(result) {
  const lines = [];
  lines.push(`================================================================`);
  lines.push(` AST Knowledge Graph Query: "${result.query}"`);
  lines.push(`================================================================`);

  if (result.matchingNodes.length === 0) {
    lines.push(`No direct AST nodes found matching "${result.query}".`);
    lines.push(`Tip: Verify that the file or symbol exists and is indexed.`);
    return lines.join("\n");
  }

  lines.push(`\nMatched Nodes (${result.matchingNodes.length}):`);
  for (const node of result.matchingNodes) {
    lines.push(`  - [${node.name}] (${node.file || "unknown"} | ${node.community || "default"})`);
  }

  lines.push(`\nDependencies & Called Services (${result.dependencies.length}):`);
  if (result.dependencies.length === 0) {
    lines.push(`  (None detected)`);
  } else {
    for (const dep of result.dependencies) {
      lines.push(`  -> [${dep.symbol}] in ${dep.file} (${dep.relation})`);
    }
  }

  lines.push(`\nCallers & Inbound Consumers (${result.callers.length}):`);
  if (result.callers.length === 0) {
    lines.push(`  (None detected)`);
  } else {
    for (const caller of result.callers) {
      lines.push(`  <- [${caller.symbol}] in ${caller.file} (${caller.relation})`);
    }
  }

  lines.push(`================================================================`);
  return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const query = process.argv[2];
  if (!query) {
    console.error("Usage: node scripts/query-knowledge-graph.mjs <symbol-or-path>");
    process.exit(1);
  }

  try {
    const res = queryDependencies(query);
    console.log(formatQueryResult(res));
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  }
}
