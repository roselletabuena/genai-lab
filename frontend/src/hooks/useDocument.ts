import { useState, useCallback, useEffect } from 'react';
import type { Document } from '../types';
import { api } from '../lib/api';

export const useDocument = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshDocuments = useCallback(async () => {
        try {
            const response = await api.fetchDocuments();
            const docs: Document[] = response.documents.map(doc => {
                // S3 key format: randomUUID()-filename.ext
                // UUID v4 format has 4 dashes: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                // So the filename starts after the 5th part (4th dash of UUID + 1 separator dash)
                const parts = doc.key.split('-');
                const filename = doc.filename || (parts.length > 5 ? parts.slice(5).join('-') : doc.key);

                return {
                    id: doc.key,
                    filename: filename,
                    uploadedAt: doc.lastModified || new Date().toISOString(),
                    size: doc.size || 0,
                    status: 'ready',
                };
            });
            setDocuments(docs);
        } catch (err) {
            console.error('Failed to fetch documents:', err);
            setError('Failed to load documents');
        }
    }, []);

    useEffect(() => {
        refreshDocuments();
    }, [refreshDocuments]);

    const handleUpload = useCallback(async (file: File) => {
        setIsUploading(true);
        setError(null);
        try {
            await api.uploadDocument(file);
            await refreshDocuments();
        } catch (err) {
            console.error('Upload failed:', err);
            setError('Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    }, [refreshDocuments]);

    const handleDelete = useCallback(async (id: string) => {
        setIsDeleting(true);
        setError(null);
        try {
            await api.deleteDocument(id);
            setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        } catch (err) {
            console.error('Delete failed:', err);
            setError('Delete failed');
        } finally {
            setIsDeleting(false);
        }
    }, []);

    return {
        documents,
        isUploading,
        isDeleting,
        error,
        handleUpload,
        handleDelete,
        refreshDocuments
    };
};

