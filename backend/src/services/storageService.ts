import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, DOCUMENTS_BUCKET } from '../lib/s3';
import { randomUUID } from 'crypto';

export async function uploadDocument(
  filename: string,
  buffer: Buffer,
  mimetype: string
) {
  const key = `${randomUUID()}-${filename}`;
  
  await s3Client.send(new PutObjectCommand({
    Bucket: DOCUMENTS_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }));

  return { key, filename, size: buffer.length };
}

export async function listDocuments() {
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  
  const result = await s3Client.send(new ListObjectsV2Command({
    Bucket: DOCUMENTS_BUCKET,
  }));

  return (result.Contents || []).map(item => ({
    key: item.Key,
    size: item.Size,
    lastModified: item.LastModified,
  }));
}