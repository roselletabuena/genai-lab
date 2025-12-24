import React, { useState, useCallback, useMemo } from 'react';
import {
    ThemeProvider,
    createTheme,
    CssBaseline,
    AppBar,
    Toolbar,
    Typography,
    IconButton,
    Container,
    Box,
    Paper,
    Button,
    Card,
    CardContent,
    Chip,
    Grid,
    LinearProgress,
    Alert,
    CircularProgress,
} from '@mui/material';
import {
    Brightness4,
    Brightness7,
    Description,
    CloudUpload,
    PictureAsPdf,
    Delete,
    CheckCircle,
    Error as ErrorIcon,
    Schedule,
    FolderOpen,
} from '@mui/icons-material';

// Types
interface Document {
    id: string;
    filename: string;
    uploadedAt: string;
    size: number;
    status: 'processing' | 'ready' | 'error';
    pageCount?: number;
}

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

// Theme configuration
const getThemeOptions = (mode: 'light' | 'dark') => ({
    palette: {
        mode,
        primary: {
            main: mode === 'light' ? '#1976d2' : '#90caf9',
        },
        secondary: {
            main: mode === 'light' ? '#9c27b0' : '#ce93d8',
        },
        background: {
            default: mode === 'light' ? '#f5f5f5' : '#121212',
            paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
        },
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h4: { fontWeight: 600 },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderRadius: 8,
                    fontWeight: 500,
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: mode === 'light'
                        ? '0 2px 8px rgba(0,0,0,0.1)'
                        : '0 2px 8px rgba(0,0,0,0.3)',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                },
            },
        },
    },
});

// Header Component
const Header = ({ mode, onToggleTheme }) => (
    <AppBar position= "fixed" elevation = { 1} >
        <Toolbar>
        <Description sx={{ mr: 2 }} />
            < Typography variant = "h6" component = "div" sx = {{ flexGrow: 1, fontWeight: 600 }}>
                AI Document Assistant
                    </Typography>
                    < IconButton color = "inherit" onClick = { onToggleTheme } aria - label="toggle theme" >
                        { mode === 'dark' ? <Brightness7 /> : <Brightness4 / >}
</IconButton>
    </Toolbar>
    </AppBar>
);

// Document Upload Component
const DocumentUpload = ({ onUpload, isUploading }) => {
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const validateFile = (file) => {
        if (file.type !== 'application/pdf') {
            return 'Only PDF files are supported';
        }
        if (file.size > 5 * 1024 * 1024) {
            return 'File size must be less than 5MB';
        }
        return null;
    };

    const handleUpload = async (file) => {
        setError(null);
        setSuccess(null);

        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            return;
        }

        // Placeholder for actual upload
        onUpload(file);
        setSuccess(`Successfully uploaded ${file.name}`);
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleUpload(e.target.files[0]);
        }
    };

    return (
        <Paper
      elevation= { 0}
    sx = {{
        p: 4,
            border: '2px dashed',
                borderColor: dragActive ? 'primary.main' : 'divider',
                    backgroundColor: dragActive ? 'action.hover' : 'background.paper',
                        transition: 'all 0.2s ease',
                            cursor: 'pointer',
      }
}
onDragEnter = { handleDrag }
onDragLeave = { handleDrag }
onDragOver = { handleDrag }
onDrop = { handleDrop }
    >
    <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 } }>
        <PictureAsPdf sx={ { fontSize: 64, color: 'primary.main', opacity: 0.6 } } />
            < Typography variant = "h6" gutterBottom >
                Upload PDF Document
                    </Typography>
                    < Typography variant = "body2" color = "text.secondary" textAlign = "center" >
                        Drag and drop your PDF here, or click to browse
                            </Typography>
                            < Button
variant = "contained"
component = "label"
startIcon = {< CloudUpload />}
disabled = { isUploading }
sx = {{ mt: 1 }}
        >
    Browse Files
        < input
type = "file"
hidden
accept = "application/pdf"
onChange = { handleFileChange }
disabled = { isUploading }
    />
    </Button>
    < Typography variant = "caption" color = "text.secondary" >
        Maximum file size: 5MB
            </Typography>
{
    isUploading && (
        <Box sx={ { width: '100%', mt: 2 } }>
            <LinearProgress />
            < Typography variant = "caption" color = "text.secondary" sx = {{ mt: 1 }
}>
    Uploading and processing document...
</Typography>
    </Box>
        )}
{
    error && (
        <Alert severity="error" sx = {{ width: '100%', mt: 2 }
}>
    { error }
    </Alert>
        )}
{
    success && (
        <Alert severity="success" sx = {{ width: '100%', mt: 2 }
}>
    { success }
    </Alert>
        )}
</Box>
    </Paper>
  );
};

// Document Card Component
const DocumentCard = ({ document, onDelete, isDeleting }) => {
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatTimeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
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
                return <CheckCircle color="success" fontSize = "small" />;
            case 'processing':
                return <CircularProgress size={ 16 } />;
            case 'error':
                return <ErrorIcon color="error" fontSize = "small" />;
            default:
                return <Schedule color="action" fontSize = "small" />;
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
      sx= {{
        transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
            transform: 'translateY(-4px)',
                boxShadow: 4,
        },
    }
}
    >
    <CardContent>
    <Box sx={ { display: 'flex', alignItems: 'flex-start', gap: 2 } }>
        <PictureAsPdf color="primary" sx = {{ fontSize: 40 }} />
            < Box sx = {{ flex: 1, minWidth: 0 }}>
                <Typography
              variant="h6"
sx = {{
    overflow: 'hidden',
        textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
                mb: 0.5,
              }}
            >
    { document.filename }
    </Typography>
    < Box sx = {{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Chip
                icon={ getStatusIcon() }
label = { document.status }
size = "small"
color = { getStatusColor() }
variant = "outlined"
    />
    <Typography variant="caption" color = "text.secondary" >
        { formatFileSize(document.size) }
        </Typography>
        </Box>
        < Typography variant = "caption" color = "text.secondary" >
            Uploaded { formatTimeAgo(document.uploadedAt) }
</Typography>
{
    document.pageCount && (
        <Typography variant="caption" color = "text.secondary" sx = {{ ml: 2 }
}>
                • { document.pageCount } pages
    </Typography>
            )}
</Box>
    < IconButton
color = "error"
onClick = {() => onDelete(document.id)}
disabled = { isDeleting }
size = "small"
    >
    { isDeleting?<CircularProgress size = { 20 } /> : <Delete />}
</IconButton>
    </Box>
    </CardContent>
    </Card>
  );
};

// Document List Component
const DocumentList = ({ documents, onDelete, isDeleting }) => {
    if (documents.length === 0) {
        return (
            <Box
        sx= {{
            display: 'flex',
                flexDirection: 'column',
                    alignItems: 'center',
                        justifyContent: 'center',
                            py: 8,
                                textAlign: 'center',
        }
    }
      >
        <FolderOpen sx={ { fontSize: 64, color: 'text.secondary', opacity: 0.5, mb: 2 } } />
            < Typography variant = "h6" color = "text.secondary" gutterBottom >
                No documents yet
                    </Typography>
                    < Typography variant = "body2" color = "text.secondary" >
                        Upload your first PDF document to get started
                            </Typography>
                            </Box>
    );
  }

return (
    <Box>
    <Typography variant= "h5" gutterBottom sx = {{ mb: 3 }}>
        Your Documents({ documents.length })
            </Typography>
            < Grid container spacing = { 2} >
            {
                documents.map((doc) => (
                    <Grid item xs = { 12} key = { doc.id } >
                    <DocumentCard
              document={ doc }
              onDelete = { onDelete }
              isDeleting = { isDeleting }
                    />
                    </Grid>
                ))
            }
                </Grid>
                </Box>
  );
};

// Main App Component
export default function App() {
    const [mode, setMode] = useState('light');
    const [documents, setDocuments] = useState(mockDocuments);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const theme = useMemo(() => createTheme(getThemeOptions(mode)), [mode]);

    const toggleMode = () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
    };

    const handleUpload = (file) => {
        console.log('Upload placeholder - File:', file.name);
        setIsUploading(true);

        // Simulate upload delay
        setTimeout(() => {
            const newDoc = {
                id: String(Date.now()),
                filename: file.name,
                uploadedAt: new Date().toISOString(),
                size: file.size,
                status: 'processing',
            };
            setDocuments((prev) => [newDoc, ...prev]);
            setIsUploading(false);
        }, 1500);
    };

    const handleDelete = (id) => {
        console.log('Delete placeholder - Document ID:', id);
        setIsDeleting(true);

        // Simulate delete delay
        setTimeout(() => {
            setDocuments((prev) => prev.filter((doc) => doc.id !== id));
            setIsDeleting(false);
        }, 1000);
    };

    return (
        <ThemeProvider theme= { theme } >
        <CssBaseline />
        < Box sx = {{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }
}>
    <Header mode={ mode } onToggleTheme = { toggleMode } />
        <Toolbar />
        < Container maxWidth = "lg" sx = {{ mt: 4, mb: 4, flex: 1 }}>
            <Box sx={ { display: 'flex', flexDirection: 'column', gap: 4 } }>
                <DocumentUpload onUpload={ handleUpload } isUploading = { isUploading } />
                    <DocumentList 
              documents={ documents }
onDelete = { handleDelete }
isDeleting = { isDeleting }
    />
    </Box>
    </Container>
    < Box
component = "footer"
sx = {{
    py: 3,
        px: 2,
            mt: 'auto',
                textAlign: 'center',
                    borderTop: 1,
                        borderColor: 'divider',
                            color: 'text.secondary',
          }}
        >
          © { new Date().getFullYear() } AI Document Assistant.Built with AWS & React.
        </Box>
</Box>
</ThemeProvider>
);
}