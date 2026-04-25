import { join } from "node:path";
import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import { FastifyPluginAsync, FastifyServerOptions } from "fastify";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import Fastify from "fastify";

export interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}

const options: AppOptions = {
  routerOptions: {
    ignoreTrailingSlash: true,
  },
};

const appPlugin: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts,
): Promise<void> => {
  await fastify.register(multipart);
  await fastify.register(cors, {
    origin: [
      "https://ai-document-assistant-six.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
      "https://ai.roselle.dev",
      "https://roselle.dev",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Api-Key"],
  });

  void fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options: opts,
  });

  void fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: opts,
  });
};

// Create the Fastify instance
export const app = Fastify(options);
app.register(appPlugin);

export default appPlugin;
export { options };
