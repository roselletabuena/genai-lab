import type { FC } from 'react';
import {
    Card,
    CardContent,
    Box,
    Typography,
    Chip,
    IconButton,
    CircularProgress,
} from '@mui/material';
import {
    PictureAsPdf,
    Delete,
    CheckCircle,
    Error as ErrorIcon,
    Schedule,
} from '@mui/icons-material';
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
        if (interval > 1) return Math.floor(interval) + ' years ago';
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + ' months ago';
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + ' days ago';
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + ' hours ago';
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + ' minutes ago';
        return 'just now';
    };

    const getStatusIcon = () => {
        switch (document.status) {
            case 'ready':
                return <CheckCircle color="success" fontSize="small" />;
            case 'processing':
                return <CircularProgress size={16} />;
            case 'error':
                return <ErrorIcon color="error" fontSize="small" />;
            default:
                return <Schedule color="action" fontSize="small" />;
        }
    };

    const getStatusColor = () => {
        switch (document.status) {
            case 'ready':
                return 'success';
            case 'processing':
                return 'warning';
            case 'error':
                return 'error';
            default:
                return 'default';
        }
    };

    return (
        <Card
            onClick={() => onSelect?.(document.id)}
            sx={{
                cursor: onSelect ? 'pointer' : 'default',
                border: isSelected ? 2 : 1,
                borderColor: isSelected ? 'primary.main' : 'divider',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                },
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <PictureAsPdf color="primary" sx={{ fontSize: 40 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            variant="h6"
                            sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                mb: 0.5,
                            }}
                        >
                            {document.filename}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Chip
                                icon={getStatusIcon()}
                                label={document.status}
                                size="small"
                                color={getStatusColor() as any}
                                variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary">
                                {formatFileSize(document.size)}
                            </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                            Uploaded {formatTimeAgo(document.uploadedAt)}
                        </Typography>
                        {document.pageCount && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                                • {document.pageCount} pages
                            </Typography>
                        )}
                    </Box>
                    <IconButton
                        color="error"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(document.id);
                        }}
                        disabled={isDeleting}
                        size="small"
                    >
                        {isDeleting ? <CircularProgress size={20} /> : <Delete />}
                    </IconButton>
                </Box>
            </CardContent>
        </Card>
    );
};

export default DocumentCard;
