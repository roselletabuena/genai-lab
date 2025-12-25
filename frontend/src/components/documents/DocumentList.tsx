import type { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { FolderOpen } from '@mui/icons-material';
import { motion } from 'framer-motion';
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
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
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
                    <FolderOpen sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.2, mb: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>
                        No documents yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200 }}>
                        Upload your first PDF document to get started
                    </Typography>
                </Box>
            </motion.div>
        );
    }

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, x: -20 },
        show: { opacity: 1, x: 0 }
    };

    return (
        <Box>
            <Typography variant="h6" sx={{ mb: 2.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                Your Library
                <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: '6px', bgcolor: 'primary.main', color: '#fff', fontSize: '0.75rem', verticalAlign: 'middle' }}>
                    {documents.length}
                </Box>
            </Typography>
            <Box
                component={motion.div}
                variants={container}
                initial="hidden"
                animate="show"
                sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
                {documents.map((doc) => (
                    <motion.div key={doc.id} variants={item}>
                        <DocumentCard
                            document={doc}
                            onDelete={onDelete}
                            isDeleting={isDeleting}
                            onSelect={onSelect}
                            isSelected={selectedId === doc.id}
                        />
                    </motion.div>
                ))}
            </Box>
        </Box>
    );
};

export default DocumentList;

