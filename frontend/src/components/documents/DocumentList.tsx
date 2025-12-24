import type { FC } from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { FolderOpen } from '@mui/icons-material';
import type { Document } from '../../types';
import DocumentCard from './DocumentCard';

interface DocumentListProps {
    documents: Document[];
    onDelete: (id: string) => void;
    isDeleting: boolean;
    onSelect?: (id: string) => void;
    selectedId?: string | null;
}

const DocumentList: FC<DocumentListProps> = ({
    documents,
    onDelete,
    isDeleting,
    onSelect,
    selectedId
}) => {
    if (documents.length === 0) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 8,
                    textAlign: 'center',
                }}
            >
                <FolderOpen sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5, mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    No documents yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Upload your first PDF document to get started
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Your Documents ({documents.length})
            </Typography>
            <Grid container spacing={2}>
                {documents.map((doc) => (
                    <Grid key={doc.id} size={12}>
                        <DocumentCard
                            document={doc}
                            onDelete={onDelete}
                            isDeleting={isDeleting}
                            onSelect={onSelect}
                            isSelected={selectedId === doc.id}
                        />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default DocumentList;
