import { FastifyPluginAsync } from "fastify";

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  // Temporarily disabled internal API key validation
  /*
  fastify.addHook("preHandler", async (req, reply) => {
    const receivedKey = Object.entries(req.headers || {}).find(
      ([key]) => key.toLowerCase() === "x-internal-api-key",
    )?.[1];

    if (receivedKey !== process.env.INTERNAL_API_KEY) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
  */
};

export default securityPlugin;
