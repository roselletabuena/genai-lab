import { useState, useCallback, type FC, type DragEvent, type ChangeEvent } from 'react';
import { Paper, Box, Typography, Button, LinearProgress, Alert, useTheme } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

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
        <Paper
            elevation={0}
            sx={{
                p: 4,
                border: '1px dashed',
                borderColor: dragActive ? 'primary.main' : 'divider',
                backgroundColor: dragActive ? (mode === 'light' ? 'rgba(99, 102, 241, 0.04)' : 'rgba(129, 140, 248, 0.04)') : 'background.paper',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: mode === 'light' ? 'rgba(99, 102, 241, 0.02)' : 'rgba(129, 140, 248, 0.02)',
                },
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Box
                    sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: mode === 'light' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(129, 140, 248, 0.1)',
                        color: 'primary.main',
                        mb: 1
                    }}
                >
                    <CloudUpload sx={{ fontSize: 32 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Upload PDF Document
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 250 }}>
                    Drag and drop your PDF here, or click the button below
                </Typography>
                <Button
                    variant="contained"
                    component="label"
                    startIcon={<CloudUpload />}
                    disabled={isUploading}
                    sx={{
                        mt: 1,
                        px: 4,
                        py: 1,
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
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
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1 }}>
                    Max size: 5MB • PDF only
                </Typography>
                {isUploading && (
                    <Box sx={{ width: '100%', mt: 2 }}>
                        <LinearProgress sx={{ borderRadius: 4, height: 6 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                            Analyzing document structure...
                        </Typography>
                    </Box>
                )}
                {error && (
                    <Alert severity="error" sx={{ width: '100%', mt: 2, borderRadius: 2 }}>
                        {error}
                    </Alert>
                )}
                {success && (
                    <Alert severity="success" sx={{ width: '100%', mt: 2, borderRadius: 2 }}>
                        {success}
                    </Alert>
                )}
            </Box>
        </Paper>
    );
};

export default DocumentUpload;
