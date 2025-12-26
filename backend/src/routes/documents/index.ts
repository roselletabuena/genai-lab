import { FastifyPluginAsync } from 'fastify'
import { uploadDocument, listDocuments, deleteDocument } from '../../services/storageService';
import { DocumentProcessor } from '../../services/documentProcessor';

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

    const processor = new DocumentProcessor();

    try {
      const buffer = await data.toBuffer();
      const result = await uploadDocument(data.filename, buffer, data.mimetype);

      request.log.info(`Document uploaded: ${result.key}`);
      request.log.info('Extracting text from PDF...');

      const text = await processor.extractTextFromBuffer(buffer);

      if (!text || text.trim().length === 0) {
        throw new Error('No text could be extracted from PDF');
      }

      request.log.info('Chunking text...');
      const chunks = processor.chunkText(text);

      console.log('Text chunked into', chunks.length, 'chunks');

      if (chunks.length === 0) {
        throw new Error('Failed to create chunks from text');
      }


      return { message: 'Upload successful', document: result };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to upload document', details: err instanceof Error ? err.message : 'Unknown error' });
    }
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
