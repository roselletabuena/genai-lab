export interface VerifyKnowledgeGraphOptions {
  forceMissing?: boolean;
}

export interface VerifyKnowledgeGraphResult {
  status: "skipped" | "missing_index" | "empty" | "verified" | "invalid";
  ok: boolean;
  nodeCount?: number;
  linkCount?: number;
}

export function checkGraphifyPrerequisites(): boolean;
export function verifyKnowledgeGraph(
  options?: VerifyKnowledgeGraphOptions
): VerifyKnowledgeGraphResult;
