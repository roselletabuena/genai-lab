import { ConverseCommand, ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { buildAssistantPrompt } from "../../prompts/portfolio.prompt";
import { ChatMessage } from "../../types/portfolio";
import { bedrockClient, MODEL_ID, FAST_MODEL_ID, GUARDRAIL_ID, GUARDRAIL_VERSION } from "./client";
import { retrieveKnowledgeBaseContext } from "./knowledgeBase";
import { collectStreamTurn, StreamChunk, StreamTurnResult } from "./streamCollector";
import { TOOL_CONFIG, resolveToolCalls } from "./toolHandler";
import {
  checkAndIncrementDailyChatCap,
  DAILY_CAP_MESSAGE,
} from "../../services/usageCounterService";

export { DAILY_CAP_MESSAGE };

const MAX_TURNS = 5;

export const GUARDRAIL_FALLBACK =
  "Woof! That's outside what I can sniff out or discuss here. Ask me anything about Roselle's background or tech stack instead! 🐾";

export interface ChatResult {
  answer: string;
  uiWidget?: {
    type: "calendar";
    url: string;
  };
}

function toBedrockMessages(messages: ChatMessage[]): any[] {
  return messages.map((m) => ({ role: m.role, content: [{ text: m.content }] }));
}

function stripGuardrailTurns(messages: ChatMessage[]): ChatMessage[] {
  return messages.reduce<ChatMessage[]>((clean, msg) => {
    const isGuardrail =
      msg.role === "assistant" && msg.content.trim() === GUARDRAIL_FALLBACK.trim();

    if (isGuardrail) {
      if (clean.at(-1)?.role === "user") clean.pop();
      return clean;
    }

    clean.push(msg);
    return clean;
  }, []);
}

export async function invokeSingleTurnPrompt(prompt: string): Promise<string> {
  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId: FAST_MODEL_ID,
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 150, temperature: 0.2 },
    })
  );

  return response.output?.message?.content?.[0]?.text ?? "";
}

export async function* chatStream(messages: ChatMessage[]): AsyncGenerator<StreamChunk> {
  const capCheck = await checkAndIncrementDailyChatCap();
  if (!capCheck.allowed) {
    yield { type: "token", text: DAILY_CAP_MESSAGE };
    yield { type: "done" };
    return;
  }

  const lastUserMessage = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const bedrockMessages = toBedrockMessages(stripGuardrailTurns(messages));
  const context = await retrieveKnowledgeBaseContext(lastUserMessage);
  const system = [{ text: buildAssistantPrompt(context) }];
  let calendarUrlUsed: string | undefined;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await bedrockClient.send(
      new ConverseStreamCommand({
        modelId: MODEL_ID,
        system,
        messages: bedrockMessages,
        inferenceConfig: { temperature: 0, maxTokens: 300 },
        guardrailConfig: {
          guardrailIdentifier: GUARDRAIL_ID,
          guardrailVersion: GUARDRAIL_VERSION,
          trace: "enabled",
        },
        toolConfig: TOOL_CONFIG,
      })
    );

    if (!response.stream) {
      yield { type: "error", message: "No stream returned from Bedrock" };
      return;
    }

    const turnGen = collectStreamTurn(response.stream);
    let next = await turnGen.next();
    while (!next.done) {
      yield next.value as StreamChunk;
      next = await turnGen.next();
    }
    const { accumulatedContent, stopReason } = next.value as StreamTurnResult;

    if (stopReason === "guardrail_intervened") {
      yield { type: "guardrail" };
      yield { type: "done" };
      return;
    }

    if (stopReason === "tool_use") {
      bedrockMessages.push({ role: "assistant", content: accumulatedContent });
      const { toolResultsContent, calendarUrl } = resolveToolCalls(accumulatedContent);
      if (calendarUrl) calendarUrlUsed = calendarUrl;
      bedrockMessages.push({ role: "user", content: toolResultsContent });
    } else {
      yield {
        type: "done",
        uiWidget: calendarUrlUsed ? { type: "calendar", url: calendarUrlUsed } : undefined,
      };
      return;
    }
  }

  yield { type: "error", message: "Max turns exceeded without a final answer" };
}

export async function chat(messages: ChatMessage[]): Promise<ChatResult> {
  const capCheck = await checkAndIncrementDailyChatCap();
  if (!capCheck.allowed) {
    return { answer: DAILY_CAP_MESSAGE };
  }

  const lastUserMessage = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const bedrockMessages = toBedrockMessages(stripGuardrailTurns(messages));
  const context = await retrieveKnowledgeBaseContext(lastUserMessage);
  const system = [{ text: buildAssistantPrompt(context) }];
  let calendarUrlUsed: string | undefined;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system,
        messages: bedrockMessages,
        inferenceConfig: { temperature: 0, maxTokens: 300 },
        guardrailConfig: {
          guardrailIdentifier: GUARDRAIL_ID,
          guardrailVersion: GUARDRAIL_VERSION,
          trace: "enabled",
        },
        toolConfig: TOOL_CONFIG,
      })
    );

    if (response.stopReason === "guardrail_intervened") {
      console.log("Guardrail trace:", JSON.stringify(response.output?.message, null, 2));
      const trace = (response as any).trace;
      if (trace) console.log("Guardrail full trace:", JSON.stringify(trace, null, 2));
      return { answer: GUARDRAIL_FALLBACK };
    }

    const outputMessage = response.output?.message;
    if (!outputMessage) break;

    bedrockMessages.push(outputMessage);

    if (response.stopReason === "tool_use") {
      const toolRequests = outputMessage.content?.filter((c) => "toolUse" in c) ?? [];
      if (toolRequests.length === 0) break;

      const { toolResultsContent, calendarUrl } = resolveToolCalls(toolRequests);
      if (calendarUrl) calendarUrlUsed = calendarUrl;
      bedrockMessages.push({ role: "user", content: toolResultsContent });
    } else {
      const rawAnswer = outputMessage.content?.[0]?.text ?? "";
      const answer = calendarUrlUsed
        ? rawAnswer.split(calendarUrlUsed).join("").replace(/\s+/g, " ").trim()
        : rawAnswer;
      return {
        answer,
        uiWidget: calendarUrlUsed ? { type: "calendar", url: calendarUrlUsed } : undefined,
      };
    }
  }

  return { answer: "I'm sorry, I couldn't complete your request at this time. Please try again." };
}
