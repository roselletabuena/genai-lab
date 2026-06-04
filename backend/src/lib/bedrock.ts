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
const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const FAST_MODEL_ID = "us.amazon.nova-micro-v1:0";

const GUARDRAIL_FALLBACK =
  "Woof! That's outside what I can sniff out or discuss here. Ask me anything about Roselle's background or tech stack instead! 🐾";

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

export interface ChatResult {
  answer: string;
  uiWidget?: {
    type: "calendar";
    url: string;
  };
}

export async function chat(messages: ChatMessage[]): Promise<ChatResult> {
  const lastUserMessage =
    messages.filter((m) => m.role === "user").at(-1)?.content || "";

  const sanitizedMessages = stripGuardrailTurns(messages);
  const context = await retrieveKnowledgeBaseContext(lastUserMessage);

  const bedrockMessages: any[] = sanitizedMessages.map((message) => ({
    role: message.role,
    content: [{ text: message.content }],
  }));

  const system = [{ text: buildAssistantPrompt(context) }];

  const toolConfig = {
    tools: [
      {
        toolSpec: {
          name: "get_calendar_link",
          description:
            "Retrieves the Cal.com scheduling page URL for booking a meeting or scheduling an interview with Roselle Tabuena.",
          inputSchema: {
            json: {
              type: "object",
              properties: {},
            },
          },
        },
      },
    ],
  };

  let loop = true;
  let turns = 0;
  const maxTurns = 5;
  let calendarUrlUsed: string | undefined = undefined;

  while (loop && turns < maxTurns) {
    turns++;
    const response = await client.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system,
        messages: bedrockMessages,
        inferenceConfig: {
          temperature: 0,
          maxTokens: 300,
        },
        guardrailConfig: {
          guardrailIdentifier: GUARDRAIL_ID,
          guardrailVersion: "DRAFT",
          trace: "disabled",
        },
        toolConfig,
      }),
    );

    if (response.stopReason === "guardrail_intervened") {
      return { answer: GUARDRAIL_FALLBACK };
    }

    const outputMessage = response.output?.message;
    if (!outputMessage) {
      break;
    }

    bedrockMessages.push(outputMessage);

    if (response.stopReason === "tool_use") {
      const toolRequests = outputMessage.content?.filter((c) => "toolUse" in c);
      if (toolRequests && toolRequests.length > 0) {
        const resultsContent: any[] = [];
        for (const req of toolRequests) {
          const toolUse = req.toolUse;
          if (!toolUse) continue;

          let toolResultData: any = {};
          if (toolUse.name === "get_calendar_link") {
            const calendarUrl =
              process.env.CALENDAR_URL ||
              "https://cal.com/roselle-tabuena/30min";
            calendarUrlUsed = calendarUrl;
            toolResultData = {
              message:
                "A calendar widget is available for booking a meeting with Roselle.",
            };
          }

          resultsContent.push({
            toolResult: {
              toolUseId: toolUse.toolUseId,
              status: "success",
              content: [
                {
                  json: toolResultData,
                },
              ],
            },
          });
        }

        bedrockMessages.push({
          role: "user",
          content: resultsContent,
        });
      } else {
        loop = false;
      }
    } else {
      loop = false;
      const answer = outputMessage.content?.[0]?.text || "";
      const sanitizedAnswer = calendarUrlUsed
        ? answer.split(calendarUrlUsed).join("").replace(/\s+/g, " ").trim()
        : answer;
      return {
        answer: sanitizedAnswer,
        uiWidget: calendarUrlUsed
          ? { type: "calendar", url: calendarUrlUsed }
          : undefined,
      };
    }
  }

  return {
    answer:
      "I'm sorry, I couldn't complete your request at this time. Please try again.",
  };
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
