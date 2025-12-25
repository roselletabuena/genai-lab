import { type FC } from 'react';
import {
    Card,
    CardContent,
    Box,
    Typography,
    Chip,
    IconButton,
    CircularProgress,
    useTheme,
} from '@mui/material';
import {
    PictureAsPdf,
    Delete,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import type { Document } from '../../types';

interface DocumentCardProps {
    document: Document;
    onDelete: (id: string) => void;
    isDeleting: boolean;
    onSelect?: (id: string) => void;
    isSelected?: boolean;
}

const DocumentCard: FC<DocumentCardProps> = ({
    document,
    onDelete,
    isDeleting,
    onSelect,
    isSelected
}) => {
    const theme = useTheme();
    const mode = theme.palette.mode;

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const formatTimeAgo = (date: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + 'y ago';
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + 'mo ago';
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + 'd ago';
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + 'h ago';
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + 'm ago';
        return 'just now';
    };

    const getStatusStyles = () => {
        switch (document.status) {
            case 'ready':
                return { color: 'success', label: 'Ready' };
            case 'processing':
                return { color: 'warning', label: 'Processing' };
            case 'error':
                return { color: 'error', label: 'Error' };
            default:
                return { color: 'default', label: document.status };
        }
    };

    const status = getStatusStyles();

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
        >
            <Card
                onClick={() => onSelect?.(document.id)}
                sx={{
                    cursor: onSelect ? 'pointer' : 'default',
                    position: 'relative',
                    overflow: 'visible',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    borderWidth: '1.5px',
                    borderStyle: 'solid',
                    borderColor: isSelected
                        ? 'primary.main'
                        : 'divider',
                    background: isSelected
                        ? (mode === 'light' ? 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)' : 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)')
                        : 'background.paper',
                    boxShadow: isSelected
                        ? (mode === 'light' ? '0 20px 25px -5px rgba(99, 102, 241, 0.1)' : '0 20px 25px -5px rgba(0, 0, 0, 0.3)')
                        : 'theme.shadows[2]',
                    '&:hover': {
                        borderColor: isSelected ? 'primary.main' : 'primary.light',
                    },
                }}
            >
                <CardContent sx={{ p: '16px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                            sx={{
                                width: 44,
                                height: 52,
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                background: mode === 'light'
                                    ? 'linear-gradient(135deg, #6366f1 0%, #a5b4fc 100%)'
                                    : 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)',
                                color: '#fff',
                                boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)',
                                '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    width: '12px',
                                    height: '12px',
                                    background: mode === 'light' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                                    borderRadius: '0 10px 0 10px',
                                }
                            }}
                        >
                            <PictureAsPdf sx={{ fontSize: 22 }} />
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontWeight: 700,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    color: isSelected ? 'primary.main' : 'text.primary',
                                    fontSize: '0.925rem',
                                    mb: 0.25
                                }}
                            >
                                {document.filename}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                    {formatFileSize(document.size)}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'divider' }}>
                                    •
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                    {formatTimeAgo(document.uploadedAt)}
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                            <IconButton
                                color="error"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(document.id);
                                }}
                                disabled={isDeleting}
                                size="small"
                                sx={{
                                    p: 0.5,
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    '.MuiCard-root:hover &': { opacity: 0.6 },
                                    '&:hover': { opacity: '1 !important', backgroundColor: 'rgba(239, 68, 68, 0.1)' }
                                }}
                            >
                                {isDeleting ? <CircularProgress size={14} /> : <Delete sx={{ fontSize: 16 }} />}
                            </IconButton>
                            <Chip
                                label={status.label}
                                size="small"
                                color={status.color as any}
                                variant={isSelected ? "filled" : "outlined"}
                                sx={{
                                    height: 18,
                                    fontSize: '0.6rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    borderRadius: '4px',
                                    borderWidth: '1.5px'
                                }}
                            />
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default DocumentCard;

