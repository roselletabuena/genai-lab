import { FastifyPluginAsync } from "fastify";
import {
  uploadDocument,
  listDocuments,
  deleteDocument,
} from "../../services/storageService";
import { DocumentProcessor } from "../../services/documentProcessor";
import {
  storeChunks,
  deleteChunksByDocumentId,
} from "../../services/chunkStorage";

const documents: FastifyPluginAsync = async (fastify, _): Promise<void> => {
  fastify.get("/", async function () {
    const documents = await listDocuments();

    return {
      count: documents.length,
      documents,
    };
  });

  fastify.post("/upload", async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    const processor = new DocumentProcessor();

    try {
      const buffer = await data.toBuffer();

      // Debug: Check if buffer contains valid PDF signature
      const pdfSignature = buffer.slice(0, 4).toString("utf8");
      request.log.info(
        `Buffer size: ${buffer.length}, First 4 bytes: ${pdfSignature}, Expected: %PDF`,
      );

      if (pdfSignature !== "%PDF") {
        request.log.error(
          `Invalid PDF signature. Got: ${pdfSignature}. Buffer may be base64 encoded or corrupted.`,
        );
        // Try to decode if it looks like base64
        const bufferAsString = buffer.toString("utf8").slice(0, 100);
        request.log.error(`First 100 chars of buffer: ${bufferAsString}`);
      }

      const result = await uploadDocument(data.filename, buffer, data.mimetype);

      request.log.info(`Document uploaded: ${result.key}`);
      request.log.info("Extracting text from PDF...");

      const text = await processor.extractTextFromBuffer(buffer);

      if (!text || text.trim().length === 0) {
        throw new Error("No text could be extracted from PDF");
      }

      request.log.info("Chunking text...");
      const chunks = processor.chunkText(text);

      if (chunks.length === 0) {
        throw new Error("Failed to create chunks from text");
      }

      request.log.info("Storing chunks to DynamoDB...");
      const storedCount = await storeChunks(result.key, chunks);
      request.log.info(`Stored ${storedCount} chunks`);

      return {
        message: "Upload successful",
        document: result,
        chunks: storedCount,
      };
    } catch (err) {
      request.log.error(err);
      return reply
        .code(500)
        .send({
          error: "Failed to upload document",
          details: err instanceof Error ? err.message : "Unknown error",
        });
    }
  });

  fastify.delete("/:key", async (request, reply) => {
    const { key } = request.params as { key: string };

    if (!key) {
      return reply.code(400).send({ error: "No key provided" });
    }

    const deletedChunks = await deleteChunksByDocumentId(key);
    const result = await deleteDocument(key);

    return { ...result, chunksDeleted: deletedChunks };
  });
};

export default documents;
