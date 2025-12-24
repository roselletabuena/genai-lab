import { useState, useCallback, type FC, type DragEvent, type ChangeEvent } from 'react';
import { Paper, Box, Typography, Button, LinearProgress, Alert } from '@mui/material';
import { PictureAsPdf, CloudUpload } from '@mui/icons-material';

interface DocumentUploadProps {
    onUpload: (file: File) => void;
    isUploading: boolean;
}

const DocumentUpload: FC<DocumentUploadProps> = ({ onUpload, isUploading }) => {
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
                border: '2px dashed',
                borderColor: dragActive ? 'primary.main' : 'divider',
                backgroundColor: dragActive ? 'action.hover' : 'background.paper',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <PictureAsPdf sx={{ fontSize: 64, color: 'primary.main', opacity: 0.6 }} />
                <Typography variant="h6" gutterBottom>
                    Upload PDF Document
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                    Drag and drop your PDF here, or click to browse
                </Typography>
                <Button
                    variant="contained"
                    component="label"
                    startIcon={<CloudUpload />}
                    disabled={isUploading}
                    sx={{ mt: 1 }}
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
                <Typography variant="caption" color="text.secondary">
                    Maximum file size: 5MB
                </Typography>
                {isUploading && (
                    <Box sx={{ width: '100%', mt: 2 }}>
                        <LinearProgress />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                            Uploading and processing document...
                        </Typography>
                    </Box>
                )}
                {error && (
                    <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
                        {error}
                    </Alert>
                )}
                {success && (
                    <Alert severity="success" sx={{ width: '100%', mt: 2 }}>
                        {success}
                    </Alert>
                )}
            </Box>
        </Paper>
    );
};

export default DocumentUpload;
