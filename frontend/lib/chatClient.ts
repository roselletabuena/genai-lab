import { ChatPayload, ChatMessage, toSessionHeaders } from "@genai-lab/contracts";

export interface SendChatMessageOptions {
  message?: string;
  messages?: ChatMessage[];
  visitorId?: string;
}

/**
 * Request builder for chat payloads strictly bound to the shared contract.
 * Rejection occurs at compile-time if breaking contract changes are introduced.
 */
export function buildChatRequest(options: SendChatMessageOptions): ChatPayload {
  const payload: ChatPayload = {
    ...(options.messages ? { messages: options.messages } : {}),
    ...(options.message ? { message: options.message } : {}),
    ...(options.visitorId ? { visitorId: options.visitorId } : {}),
  };
  return payload;
}

export async function sendChatMessage(options: SendChatMessageOptions) {
  const payload = buildChatRequest(options);
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...toSessionHeaders({ visitorId: options.visitorId }),
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}
