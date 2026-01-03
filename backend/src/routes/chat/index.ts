import { FastifyPluginAsync } from 'fastify';
import { askQuestion } from '../../services/ragService';

interface ChatBody {
    documentId: string;
    question: string;
}

const chat: FastifyPluginAsync = async (fastify): Promise<void> => {
    fastify.post<{ Body: ChatBody }>('/', async (request, reply) => {
        const { documentId, question } = request.body;

        if (!documentId || !question) {
            return reply.code(400).send({ error: 'documentId and question are required' });
        }

        try {
            const result = await askQuestion(documentId, question);
            return result;
        } catch (err) {
            request.log.error(err);
            return reply.code(500).send({
                error: 'Failed to process question',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });
};

export default chat;
