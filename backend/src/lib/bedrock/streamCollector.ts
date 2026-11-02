import { ChatResult } from "./chatOrchestrator";

// Discriminated union of SSE events yielded by chatStream()
export type StreamChunk =
  | { type: "token"; text: string }
  | { type: "guardrail" } // client should discard buffered tokens and show fallback
  | { type: "done"; uiWidget?: ChatResult["uiWidget"] }
  | { type: "error"; message: string };

export interface StreamTurnResult {
  accumulatedContent: any[];
  stopReason: string | undefined;
}

/**
 * Consumes one Bedrock streaming response.
 * Yields text tokens to the caller and accumulates the full assistant turn
 * (text + tool-use blocks) so the tool-use loop can replay it.
 */
export async function* collectStreamTurn(
  stream: AsyncIterable<any>
): AsyncGenerator<StreamChunk, StreamTurnResult> {
  const accumulatedContent: any[] = [];
  let currentTextBlock = "";
  let currentToolUseBlock: { toolUse: any; _inputStr?: string } | null = null;
  let stopReason: string | undefined;

  for await (const event of stream) {
    if (event.contentBlockStart) {
      const start = event.contentBlockStart.start;
      if (start?.toolUse) {
        currentToolUseBlock = {
          toolUse: { toolUseId: start.toolUse.toolUseId, name: start.toolUse.name, input: {} },
        };
      }
    } else if (event.contentBlockDelta) {
      const delta = event.contentBlockDelta.delta;
      if (delta?.text) {
        currentTextBlock += delta.text;
        yield { type: "token", text: delta.text };
      } else if (delta?.toolUse?.input && currentToolUseBlock) {
        currentToolUseBlock._inputStr = (currentToolUseBlock._inputStr ?? "") + delta.toolUse.input;
      }
    } else if (event.contentBlockStop) {
      if (currentTextBlock) {
        accumulatedContent.push({ text: currentTextBlock });
        currentTextBlock = "";
      }
      if (currentToolUseBlock) {
        try {
          currentToolUseBlock.toolUse.input = JSON.parse(currentToolUseBlock._inputStr ?? "{}");
        } catch {
          currentToolUseBlock.toolUse.input = {};
        }
        const { _inputStr: _discarded, ...blockToStore } = currentToolUseBlock;
        accumulatedContent.push(blockToStore);
        currentToolUseBlock = null;
      }
    } else if (event.messageStop) {
      stopReason = event.messageStop.stopReason as string | undefined;
    }
  }

  return { accumulatedContent, stopReason };
}
