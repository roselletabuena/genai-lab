import pdfParse from 'pdf-parse';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

type PDFParser = (dataBuffer: Buffer, options?: any) => Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
}>;

export class DocumentProcessor {
    private s3Client: S3Client;

    constructor() {
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION || 'ap-southeast-1'
        });
    }


    async extractTextFromS3(bucket: string, key: string): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: key
            });
            const pdf = pdfParse as any as PDFParser;
            const response = await this.s3Client.send(command);
            const buffer = await this.streamToBuffer(response.Body as Readable);
            const data = await pdf(buffer);

            return data.text;
        } catch (error) {
            console.error('Error extracting text from PDF:', error);
            throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async extractTextFromBuffer(buffer: Buffer): Promise<string> {
        try {
            const pdf = pdfParse as any as PDFParser;
            const data = await pdf(buffer);
            return data.text;
        } catch (error) {
            console.error('Error extracting text from buffer:', error);
            throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
        const cleanedText = text
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();


        const paragraphs = cleanedText.split(/\n\n+/).filter(p => p.trim().length > 0);

        const chunks: string[] = [];
        let currentChunk = '';

        for (const para of paragraphs) {
            const paraLength = para.length;

            if (paraLength > chunkSize) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }

                const sentences = this.splitIntoSentences(para);
                for (const sentence of sentences) {
                    if ((currentChunk + sentence).length > chunkSize && currentChunk) {
                        chunks.push(currentChunk.trim());
                        currentChunk = sentence;
                    } else {
                        currentChunk += (currentChunk ? ' ' : '') + sentence;
                    }
                }
                continue;
            }


            if ((currentChunk + '\n\n' + para).length > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim());


                const overlapText = this.getLastNChars(currentChunk, overlap);
                currentChunk = overlapText + '\n\n' + para;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + para;
            }
        }


        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks.filter(chunk => chunk.length > 50);
    }


    private async streamToBuffer(stream: Readable): Promise<Buffer> {
        const chunks: Uint8Array[] = [];

        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);
    }


    private splitIntoSentences(text: string): string[] {
        return text
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 0);
    }


    private getLastNChars(text: string, n: number): string {
        if (text.length <= n) return text;


        const lastPart = text.slice(-n);
        const sentenceMatch = lastPart.match(/[.!?]\s+/);

        if (sentenceMatch && sentenceMatch.index) {
            return lastPart.slice(sentenceMatch.index + sentenceMatch[0].length);
        }

        return lastPart;
    }


    getTextMetadata(text: string, chunks: string[]) {
        return {
            totalCharacters: text.length,
            totalWords: text.split(/\s+/).length,
            totalChunks: chunks.length,
            avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length)
        };
    }
}