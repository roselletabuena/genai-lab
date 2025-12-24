import { useState, type FC, useRef, useEffect } from 'react';
import {
    Box,
    Paper,
    TextField,
    IconButton,
    Typography,
    Divider,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import type { Message, Document } from '../../types';

interface ChatProps {
    selectedDocument: Document | null;
    messages: Message[];
    onSendMessage: (content: string) => void;
}

const Chat: FC<ChatProps> = ({ selectedDocument, messages, onSendMessage }) => {
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
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" noWrap>
                    Chatting about: {selectedDocument.filename}
                </Typography>
            </Box>

            {/* Messages Area */}
            <Box
                sx={{
                    flex: 1,
                    overflowY: 'auto',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                }}
            >
                {messages.map((message) => (
                    <Box
                        key={message.id}
                        sx={{
                            display: 'flex',
                            justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                        }}
                    >
                        <Box
                            sx={{
                                maxWidth: '80%',
                                p: 1.5,
                                borderRadius: 1,
                                border: 1,
                                borderColor: 'divider',
                            }}
                        >
                            <Typography variant="body1">{message.content}</Typography>
                        </Box>
                    </Box>
                ))}
                <div ref={messagesEndRef} />
            </Box>

            <Divider />

            {/* Input Area */}
            <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        placeholder="Ask a question about this document..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        variant="outlined"
                        size="small"
                        multiline
                        maxRows={4}
                    />
                    <IconButton
                        color="primary"
                        onClick={handleSend}
                        disabled={!input.trim()}
                        sx={{ alignSelf: 'flex-end' }}
                    >
                        <Send />
                    </IconButton>
                </Box>
            </Box>
        </Paper>
    );
};

export default Chat;
