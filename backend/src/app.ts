import { join } from 'node:path'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import fastifyEnv from '@fastify/env';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {

}

const options: AppOptions = {
}

const appPlugin: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {

  await fastify.register(fastifyEnv, {
    dotenv: true,
    schema: {
      type: 'object',
      required: [],
      properties: {
        LOCALSTACK_ENDPOINT: { type: 'string' },
        AWS_REGION: { type: 'string' },
        DOCUMENTS_BUCKET: { type: 'string' },
        NODE_ENV: { type: 'string' },
      }
    }
  })

  await fastify.register(multipart);

  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts
  })

  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts
  })
}

// Create the Fastify instance
export const app = Fastify(options);
app.register(appPlugin);

export default appPlugin;
export { options };