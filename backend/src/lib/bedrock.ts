import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { PORTFOLIO_PROMPT } from "../prompts/porfolio-prompt";

import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";

const REGION = process.env.AWS_REGION || "us-east-1";
const client = new BedrockRuntimeClient({
  region: REGION,
});

const agentClient = new BedrockAgentRuntimeClient({ region: REGION });

const MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0";
const GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID;
const GUARDRAIL_FALLBACK =
  "That's outside what I can discuss here. Ask me anything about Roselle's background or tech stack instead! 💻";
const KNOWLEDGE_BASE = process.env.KNOWLEDGE_BASE_ID;

export async function invokeClaudeWithContext(
  context: string,
  question: string,
): Promise<string> {
  const prompt = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: `You are a helpful assistant that answers questions based on the provided document context. 
Only use information from the context to answer. If the answer is not in the context, say so.

<context>
${context}
</context>

Question: ${question}`,
      },
    ],
  };

  const response = await client.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(prompt),
    }),
  );

  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content[0].text;
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function converseCommandWithContext(
  messages: ChatMessage[],
): Promise<string> {
  const lastUserMessage =
    messages.filter((m) => m.role === "user").at(-1)?.content || "";

  const cleanMessages = cleanGuardrailMessages(messages);
  const context = await retrieveContext(lastUserMessage);

  const bedrockMessages = cleanMessages.map((msg) => ({
    role: msg.role,
    content: [{ text: msg.content }],
  }));

  const response = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: PORTFOLIO_PROMPT(context) }],
      messages: bedrockMessages,
      inferenceConfig: {
        temperature: 0,
      },
      guardrailConfig: {
        guardrailIdentifier: GUARDRAIL_ID,
        guardrailVersion: "DRAFT",
      },
    }),
  );

  if (response.stopReason === "guardrail_intervened") {
    return GUARDRAIL_FALLBACK;
  }

  return response.output?.message?.content?.[0]?.text || "";
}

async function retrieveContext(query: string): Promise<string> {
  const response = await agentClient.send(
    new RetrieveCommand({
      knowledgeBaseId: KNOWLEDGE_BASE,
      retrievalQuery: { text: query },
      retrievalConfiguration: {
        vectorSearchConfiguration: { numberOfResults: 3 },
      },
    }),
  );

  return (response.retrievalResults || [])
    .map((r) => r.content?.text || "")
    .filter(Boolean)
    .join("\n\n");
}

function cleanGuardrailMessages(messages: ChatMessage[]): ChatMessage[] {
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
