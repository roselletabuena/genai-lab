import { FastifyPluginAsync } from 'fastify'
import { uploadDocument, listDocuments, deleteDocument } from '../../services/storageService';

const documents: FastifyPluginAsync = async (fastify, _): Promise<void> => {
  fastify.get('/', async function () {
    const documents = await listDocuments();

    return {
      count: documents.length,
      documents
    };
  })

  fastify.post('/upload', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    const result = await uploadDocument(data.filename, buffer, data.mimetype);

    return { message: 'Upload successful', document: result };
  });

  fastify.delete('/:key', async (request, reply) => {
    const { key } = request.params as { key: string };

    if (!key) {
      return reply.code(400).send({ error: 'No key provided' });
    }

    const result = await deleteDocument(key);
    return result;
  });

}


export default documents;
