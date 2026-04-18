import { chat, invokeSingleTurnPrompt } from "../lib/bedrock";
import { ChatMessage } from "../types/portfolio";

export async function askPortfolioQuestion(messages: ChatMessage[]) {
  return await chat(messages);
}

export async function generateNextSuggestedPrompt(prompt: string) {
  return await invokeSingleTurnPrompt(prompt);
}
