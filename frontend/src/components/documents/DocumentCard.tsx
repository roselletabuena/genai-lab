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
                position: 'relative',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: isSelected
                    ? '2px solid #6366f1'
                    : '1px solid transparent',
                backgroundColor: isSelected
                    ? (theme.palette.mode === 'light' ? 'rgba(99, 102, 241, 0.04)' : 'rgba(129, 140, 248, 0.08)')
                    : 'background.paper',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.palette.mode === 'light'
                        ? '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
                        : '0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                },
            }}
        >
            <CardContent sx={{ p: '16px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: mode === 'light' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(129, 140, 248, 0.1)',
                            color: 'primary.main',
                        }}
                    >
                        <PictureAsPdf sx={{ fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: isSelected ? 'primary.main' : 'text.primary',
                            }}
                        >
                            {document.filename}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                {formatFileSize(document.size)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                •
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {formatTimeAgo(document.uploadedAt)}
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Chip
                            label={document.status}
                            size="small"
                            color={getStatusColor() as any}
                            variant="outlined"
                            sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                borderRadius: '6px'
                            }}
                        />
                        <IconButton
                            color="error"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(document.id);
                            }}
                            disabled={isDeleting}
                            size="small"
                            sx={{
                                opacity: 0.5,
                                '&:hover': { opacity: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)' }
                            }}
                        >
                            {isDeleting ? <CircularProgress size={16} /> : <Delete sx={{ fontSize: 18 }} />}
                        </IconButton>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

export default DocumentCard;
