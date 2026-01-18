import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export const useDocument = () => {
    const queryClient = useQueryClient();

    const { data: documents = [], isLoading, error: fetchError } = useQuery({
        queryKey: ['documents'],
        queryFn: () => api.fetchDocuments(),
        select: (response) => {
            return response.documents.map(doc => {
                const parts = doc.key.split('-');
                const filename = doc.filename || (parts.length > 5 ? parts.slice(5).join('-') : doc.key);

                return {
                    id: doc.key,
                    filename: filename,
                    uploadedAt: doc.lastModified || new Date().toISOString(),
                    size: doc.size || 0,
                    status: 'ready' as const,
                };
            });
        }
    });

    const uploadMutation = useMutation({
        mutationFn: (file: File) => api.uploadDocument(file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteDocument(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        }
    });

    return {
        documents,
        isUploading: uploadMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isLoading,
        error: (fetchError || uploadMutation.error || deleteMutation.error)?.message || null,
        handleUpload: uploadMutation.mutateAsync,
        handleDelete: deleteMutation.mutateAsync,
        refreshDocuments: () => queryClient.invalidateQueries({ queryKey: ['documents'] })
    };
};

