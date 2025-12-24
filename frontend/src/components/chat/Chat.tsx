import { useState, type FC, useRef, useEffect } from 'react';
import {
    Box,
    Paper,
    TextField,
    IconButton,
    Typography,
    Divider,
    useTheme,
} from '@mui/material';
import { Send, Description } from '@mui/icons-material';
import type { Message, Document } from '../../types';

interface ChatProps {
    selectedDocument: Document | null;
    messages: Message[];
    onSendMessage: (content: string) => void;
}

const Chat: FC<ChatProps> = ({ selectedDocument, messages, onSendMessage }) => {
    const theme = useTheme();
    const mode = theme.palette.mode;
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!selectedDocument) {
        return (
            <Paper
                sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.default',
                    border: '1px dashed',
                    borderColor: 'divider',
                }}
            >
                <Typography color="text.secondary">
                    Select a document to start chatting
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper
            elevation={0}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
            }}
        >
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: mode === 'light' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(129, 140, 248, 0.1)',
                        color: 'primary.main',
                    }}
                >
                    <Description />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                    {selectedDocument.filename}
                </Typography>
            </Box>

            {/* Messages Area */}
            <Box
                sx={{
                    flex: 1,
                    overflowY: 'auto',
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    backgroundColor: mode === 'light' ? '#fcfdfe' : '#03081a',
                }}
            >
                {messages.length === 0 ? (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                        <Typography variant="body2">No messages yet. Ask something about this document!</Typography>
                    </Box>
                ) : (
                    messages.map((message) => (
                        <Box
                            key={message.id}
                            sx={{
                                display: 'flex',
                                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                            }}
                        >
                            <Box
                                sx={{
                                    maxWidth: '85%',
                                    p: 2,
                                    borderRadius: message.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                    backgroundColor: message.role === 'user' ? 'primary.main' : 'background.paper',
                                    color: message.role === 'user' ? '#ffffff' : 'text.primary',
                                    boxShadow: message.role === 'user'
                                        ? '0 4px 12px -2px rgba(99, 102, 241, 0.3)'
                                        : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                                    border: message.role === 'assistant' ? '1px solid' : 'none',
                                    borderColor: 'divider',
                                }}
                            >
                                <Typography variant="body1" sx={{ lineHeight: 1.6 }}>{message.content}</Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        display: 'block',
                                        mt: 1,
                                        opacity: 0.7,
                                        textAlign: message.role === 'user' ? 'right' : 'left',
                                        fontSize: '0.7rem'
                                    }}
                                >
                                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                            </Box>
                        </Box>
                    ))
                )}
                <div ref={messagesEndRef} />
            </Box>

            <Divider />

            {/* Input Area */}
            <Box sx={{ p: 2.5, backgroundColor: 'background.paper' }}>
                <Box sx={{
                    display: 'flex',
                    gap: 1.5,
                    alignItems: 'center',
                    backgroundColor: mode === 'light' ? '#f1f5f9' : '#1e293b',
                    borderRadius: '12px',
                    p: 0.5,
                    border: '1px solid transparent',
                    '&:focus-within': {
                        borderColor: 'primary.main',
                        backgroundColor: mode === 'light' ? '#ffffff' : '#0f172a',
                    },
                    transition: 'all 0.2s'
                }}>
                    <TextField
                        fullWidth
                        placeholder="Type your question..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        variant="standard"
                        InputProps={{ disableUnderline: true }}
                        sx={{ px: 2 }}
                        multiline
                        maxRows={4}
                    />
                    <IconButton
                        color="primary"
                        onClick={handleSend}
                        disabled={!input.trim()}
                        sx={{
                            backgroundColor: 'primary.main',
                            color: '#ffffff',
                            width: 40,
                            height: 40,
                            '&:hover': { backgroundColor: 'primary.dark' },
                            '&.Mui-disabled': { backgroundColor: 'action.disabledBackground' }
                        }}
                    >
                        <Send sx={{ fontSize: 20 }} />
                    </IconButton>
                </Box>
            </Box>
        </Paper>
    );
};

export default Chat;
