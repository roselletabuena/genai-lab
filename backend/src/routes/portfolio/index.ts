import { FastifyPluginAsync } from "fastify";
import { askPortfolioQuestion } from "../../services/portfolioService";

interface PortfolioBody {
  question: string;
}

const portfolio: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: PortfolioBody }>("/", async (request, reply) => {
    const { question } = request.body;

    if (!question) {
      return reply.code(400).send({ error: "question is required" });
    }

    try {
      const answer = await askPortfolioQuestion(question);
      return { answer };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: "Failed to process portfolio question",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
};

export default portfolio;
