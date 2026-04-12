import { FastifyPluginAsync } from "fastify";
import {
  askPortfolioQuestion,
  generateNextSuggestedPrompt,
} from "../../services/portfolioService";
import { buildSuggestedPrompt } from "../../prompts/portfolio.prompt";
import { ChatMessage } from "../../types/portfolio";

const CONVERSATION_LIMIT = 10;

interface chatBody {
  messages: ChatMessage[];
}

const schema = {
  body: {
    type: "object",
    required: ["messages"],
    properties: {
      messages: {
        type: "array",
        items: {
          type: "object",
          required: ["role", "content"],
          properties: {
            role: { type: "string", enum: ["user", "assistant"] },
            content: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
};

const portfolio: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: chatBody }>(
    "/chat",
    { schema },
    async (request, reply) => {
      const { messages } = request.body;

      try {
        const truncatedMessages = messages.slice(-CONVERSATION_LIMIT);

        const answer = await askPortfolioQuestion(truncatedMessages);
        return { answer };
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({
          error: "Failed to process portfolio question",
          details: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
  );

  fastify.post<{
    Body: { conversation: ChatMessage[]; lastMessage: string };
  }>("/suggested-prompts", {}, async (request, reply) => {
    const { conversation, lastMessage } = request.body;

    const prompt = buildSuggestedPrompt(conversation, lastMessage);
    const raw = await generateNextSuggestedPrompt(prompt);

    let parsedOutput;

    try {
      parsedOutput = JSON.parse(raw);
    } catch (err) {
      return reply.code(500).send({
        error: "Invalid model response",
        raw,
      });
    }

    return reply.send(parsedOutput);
  });
};

export default portfolio;
