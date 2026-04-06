import { FastifyPluginAsync } from "fastify";
import { askPortfolioQuestion } from "../../services/portfolioService";
import { ChatMessage } from "../../lib/bedrock";

const CONVERSATION_LIMIT = 10;

interface PortfolioBody {
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
  fastify.post<{ Body: PortfolioBody }>(
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
};

export default portfolio;
