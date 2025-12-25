import { useMemo, useState } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Toolbar,
  Box,
  Grid,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import Header from './components/layout/Header';
import DocumentUpload from './components/documents/DocumentUpload';
import DocumentList from './components/documents/DocumentList';
import Chat from './components/chat/Chat';

// Hooks
import { useThemeMode } from './hooks/useThemeMode';
import { useDocument } from './hooks/useDocument';

// Types
import type { Message } from './types';

// Lib
import { createAppTheme } from './lib/theme';

export default function App() {
  const { mode, toggleTheme } = useThemeMode();
  const { documents, isUploading, isDeleting, handleUpload, handleDelete } = useDocument();

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const selectedDocument = useMemo(() =>
    documents.find(doc => doc.id === selectedDocumentId) || null
    , [documents, selectedDocumentId]);

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: String(Date.now()),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMessage]);

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: `I've analyzed ${selectedDocument?.filename} and I'm ready to help you with: "${content}"`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        data-theme={mode}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: 'background.default',
          position: 'relative',
        }}
      >
        <div className="mesh-bg" />

        <Header mode={mode} onToggleTheme={toggleTheme} />
        <Toolbar sx={{ minHeight: '80px !important' }} />

        <Box
          component={motion.main}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          sx={{
            flex: 1,
            overflow: 'hidden',
            p: { xs: 2, md: 3, lg: 4 },
            maxWidth: '1800px',
            width: '100%',
            mx: 'auto'
          }}
        >
          <Grid container spacing={4} sx={{ height: '100%' }}>
            {/* Left Panel: Documents */}
            <Grid
              size={{ xs: 12, md: 4, lg: 3.5 }}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 3
              }}
            >
              <DocumentUpload onUpload={handleUpload} isUploading={isUploading} />

              <Box sx={{
                flex: 1,
                overflowY: 'auto',
                pr: 1,
                mt: 1,
                '&::-webkit-scrollbar': { width: '4px' },
                '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: '4px' }
              }}>
                <DocumentList
                  documents={documents}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                  onSelect={setSelectedDocumentId}
                  selectedId={selectedDocumentId}
                />
              </Box>
            </Grid>

            {/* Right Panel: Chat */}
            <Grid
              size={{ xs: 12, md: 8, lg: 8.5 }}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <AnimatePresence mode="wait">
                <Chat
                  selectedDocument={selectedDocument}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                />
              </AnimatePresence>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

