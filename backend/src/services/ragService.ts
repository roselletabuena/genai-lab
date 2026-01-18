import { getChunksByDocumentId } from "./chunkStorage";
import { invokeClaudeWithContext } from "../lib/bedrock";

const MAX_CONTEXT_CHARS = 50000; // ~12K tokens, safe for Claude

export async function askQuestion(
  documentId: string,
  question: string,
): Promise<{ answer: string; chunksUsed: number }> {
  const chunks = await getChunksByDocumentId(documentId);

  if (chunks.length === 0) {
    return { answer: "No document content found.", chunksUsed: 0 };
  }

  // Build context from chunks (limit to max chars)
  let context = "";
  let chunksUsed = 0;

  for (const chunk of chunks) {
    if (context.length + chunk.content.length > MAX_CONTEXT_CHARS) break;
    context += chunk.content + "\n\n";
    chunksUsed++;
  }

  const answer = await invokeClaudeWithContext(context.trim(), question);

  return { answer, chunksUsed };
}
