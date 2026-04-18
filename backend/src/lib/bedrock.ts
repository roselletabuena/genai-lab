import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { buildAssistantPrompt } from "../prompts/portfolio.prompt";
import { ChatMessage } from "../types/portfolio";

import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";

const GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID;
const KNOWLEDGE_BASE = process.env.KNOWLEDGE_BASE_ID;
const REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0";
const FAST_MODEL_ID = "us.amazon.nova-micro-v1:0";

const GUARDRAIL_FALLBACK =
  "That's outside what I can discuss here. Ask me anything about Roselle's background or tech stack instead! 💻";

const client = new BedrockRuntimeClient({ region: REGION });
const agentClient = new BedrockAgentRuntimeClient({ region: REGION });

export async function invokeSingleTurnPrompt(prompt: string): Promise<string> {
  const response = await client.send(
    new ConverseCommand({
      modelId: FAST_MODEL_ID,
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 150,
        temperature: 0.2,
      },
    }),
  );

  return response.output?.message?.content?.[0]?.text ?? "";
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  const lastUserMessage =
    messages.filter((m) => m.role === "user").at(-1)?.content || "";

  const sanitizedMessages = stripGuardrailTurns(messages);
  const context = await retrieveKnowledgeBaseContext(lastUserMessage);

  const bedrockMessages = sanitizedMessages.map((message) => ({
    role: message.role,
    content: [{ text: message.content }],
  }));

  const response = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: buildAssistantPrompt(context) }],
      messages: bedrockMessages,
      inferenceConfig: {
        temperature: 0,
      },
      guardrailConfig: {
        guardrailIdentifier: GUARDRAIL_ID,
        guardrailVersion: "DRAFT",
        trace: "enabled",
      },
    }),
  );

  if (response.stopReason === "guardrail_intervened") {
    return GUARDRAIL_FALLBACK;
  }

  return response.output?.message?.content?.[0]?.text || "";
}

async function retrieveKnowledgeBaseContext(query: string): Promise<string> {
  const response = await agentClient.send(
    new RetrieveCommand({
      knowledgeBaseId: KNOWLEDGE_BASE,
      retrievalQuery: { text: query },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: 5,
        },
      },
    }),
  );

  return (response.retrievalResults || [])
    .filter((r) => (r.score ?? 0) > 0.4)
    .map((r) => r.content?.text || "")
    .filter(Boolean)
    .join("\n\n");
}

function stripGuardrailTurns(messages: ChatMessage[]): ChatMessage[] {
  return messages.reduce<ChatMessage[]>((clean, msg) => {
    const isGuardrail =
      msg.role === "assistant" &&
      msg.content.trim() === GUARDRAIL_FALLBACK.trim();

    if (isGuardrail) {
      if (clean.at(-1)?.role === "user") {
        clean.pop();
      }
      return clean;
    }

    clean.push(msg);
    return clean;
  }, []);
}
