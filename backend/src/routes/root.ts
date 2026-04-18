import { FastifyPluginAsync } from "fastify";

const root: FastifyPluginAsync = async (fastify, _): Promise<void> => {
  fastify.get("/", async function () {
    return {
      service: "AI Document Assistant API",
      status: "healthy",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    };
  });
};

export default root;
