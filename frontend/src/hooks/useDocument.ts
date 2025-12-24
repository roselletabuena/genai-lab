import { useState, useCallback } from 'react';
import type { Document } from '../types';
// Mock data
const mockDocuments: Document[] = [
    {
        id: '1',
        filename: 'Annual_Report_2024.pdf',
        uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        size: 2458624,
        status: 'ready',
        pageCount: 45,
    },
    {
        id: '2',
        filename: 'Project_Proposal.pdf',
        uploadedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        size: 1234567,
        status: 'processing',
        pageCount: 12,
    },
    {
        id: '3',
        filename: 'Technical_Documentation.pdf',
        uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        size: 5242880,
        status: 'ready',
        pageCount: 128,
    },
];

export const useDocument = () => {
    const [documents, setDocuments] = useState<Document[]>(mockDocuments);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleUpload = useCallback((file: File) => {
        setIsUploading(true);
        // Simulate upload delay
        setTimeout(() => {
            const newDoc: Document = {
                id: String(Date.now()),
                filename: file.name,
                uploadedAt: new Date().toISOString(),
                size: file.size,
                status: 'processing' as const,
            };
            setDocuments((prev) => [newDoc, ...prev]);
            setIsUploading(false);
        }, 1500);
    }, []);

    const handleDelete = useCallback((id: string) => {
        setIsDeleting(true);
        // Simulate delete delay
        setTimeout(() => {
            setDocuments((prev) => prev.filter((doc) => doc.id !== id));
            setIsDeleting(false);
        }, 1000);
    }, []);

    return {
        documents,
        isUploading,
        isDeleting,
        handleUpload,
        handleDelete,
    };
};
