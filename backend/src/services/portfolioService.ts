import { converseCommandWithContext, ChatMessage } from "../lib/bedrock";

export async function askPortfolioQuestion(
  messages: ChatMessage[],
): Promise<string> {
  return await converseCommandWithContext(messages);
}
