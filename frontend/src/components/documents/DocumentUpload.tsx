import { useState, useCallback, type FC, type DragEvent, type ChangeEvent } from 'react';
import { Paper, Box, Typography, Button, LinearProgress, Alert, useTheme } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentUploadProps {
    onUpload: (file: File) => void;
    isUploading: boolean;
}

const DocumentUpload: FC<DocumentUploadProps> = ({ onUpload, isUploading }) => {
    const theme = useTheme();
    const mode = theme.palette.mode;
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleDrag = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const validateFile = (file: File) => {
        if (file.type !== 'application/pdf') {
            return 'Only PDF files are supported';
        }
        if (file.size > 5 * 1024 * 1024) {
            return 'File size must be less than 5MB';
        }
        return null;
    };

    const handleUpload = async (file: File) => {
        setError(null);
        setSuccess(null);

        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            return;
        }

        onUpload(file);
        setSuccess(`Successfully uploaded ${file.name}`);
    };

    const handleDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleUpload(e.target.files[0]);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
        >
            <Paper
                elevation={0}
                sx={{
                    p: 4,
                    border: '2px dashed',
                    borderColor: dragActive ? 'primary.main' : 'divider',
                    backgroundColor: dragActive
                        ? (mode === 'light' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(129, 140, 248, 0.08)')
                        : 'background.paper',
                    borderRadius: '24px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: mode === 'light' ? 'rgba(99, 102, 241, 0.04)' : 'rgba(129, 140, 248, 0.04)',
                        transform: 'translateY(-2px)',
                        boxShadow: theme.shadows[3],
                    },
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, position: 'relative', zIndex: 1 }}>
                    <Box
                        sx={{
                            width: 72,
                            height: 72,
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: mode === 'light'
                                ? 'linear-gradient(135deg, #6366f1 0%, #a5b4fc 100%)'
                                : 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)',
                            color: '#fff',
                            mb: 1,
                            boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)',
                        }}
                    >
                        <CloudUpload sx={{ fontSize: 36 }} />
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                            Upload PDF Document
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
                            Ask AI anything about your files. Max 5MB per PDF.
                        </Typography>
                    </Box>

                    <Button
                        variant="contained"
                        component="label"
                        startIcon={<CloudUpload />}
                        disabled={isUploading}
                        sx={{
                            mt: 1,
                            px: 5,
                            py: 1.25,
                            borderRadius: '12px',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            boxShadow: mode === 'light'
                                ? '0 10px 15px -3px rgba(99, 102, 241, 0.4)'
                                : '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
                        }}
                    >
                        Browse Files
                        <input
                            type="file"
                            hidden
                            accept="application/pdf"
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                    </Button>

                    <AnimatePresence>
                        {isUploading && (
                            <Box
                                component={motion.div}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                sx={{ width: '100%', mt: 2 }}
                            >
                                <LinearProgress
                                    sx={{
                                        borderRadius: 4,
                                        height: 8,
                                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                        '& .MuiLinearProgress-bar': {
                                            borderRadius: 4,
                                            background: 'linear-gradient(90deg, #6366f1, #a5b4fc)',
                                        }
                                    }}
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', textAlign: 'center', fontWeight: 600 }}>
                                    Crunching data with AI...
                                </Typography>
                            </Box>
                        )}

                        {(error || success) && (
                            <Box
                                component={motion.div}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                sx={{ width: '100%', mt: 1 }}
                            >
                                {error && (
                                    <Alert severity="error" sx={{ width: '100%', borderRadius: 3, fontWeight: 500 }}>
                                        {error}
                                    </Alert>
                                )}
                                {success && (
                                    <Alert severity="success" sx={{ width: '100%', borderRadius: 3, fontWeight: 500 }}>
                                        {success}
                                    </Alert>
                                )}
                            </Box>
                        )}
                    </AnimatePresence>
                </Box>
            </Paper>
        </motion.div>
    );
};

export default DocumentUpload;

