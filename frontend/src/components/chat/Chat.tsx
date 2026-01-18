import { type FC, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    Box,
    Paper,
    Typography,
    TextField,
    IconButton,
    Avatar,
    useTheme
} from '@mui/material';
import { Send, SmartToy, Person, Description } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import type { Document, Message } from '../../types';

interface ChatProps {
    selectedDocument: Document | null;
    messages: Message[];
    onSendMessage: (content: string) => void;
}

const Chat: FC<ChatProps> = ({ selectedDocument, messages, onSendMessage }) => {
    const theme = useTheme();
    const mode = theme.palette.mode;
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const content = formData.get('message') as string;
        if (content.trim()) {
            onSendMessage(content);
            (e.currentTarget.elements.namedItem('message') as HTMLInputElement).value = '';
        }
    };

    if (!selectedDocument) {
        return (
            <Box
                component={motion.div}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    opacity: 0.8,
                }}
            >
                <Box
                    sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: mode === 'light' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(129, 140, 248, 0.05)',
                        color: 'primary.main',
                        border: '1.5px dashed',
                        borderColor: 'primary.light',
                    }}
                >
                    <Description sx={{ fontSize: 40 }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    Select a document to begin
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 300, textAlign: 'center' }}>
                    Choose a file from the sidebar to start asking questions about its content.
                </Typography>
            </Box>
        );
    }

    return (
        <Paper
            className="glass"
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: 'none',
                boxShadow: theme.shadows[4],
            }}
        >
            {/* Chat Header */}
            <Box sx={{ p: 2, px: 3, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Avatar
                    sx={{
                        bgcolor: 'primary.main',
                        width: 40,
                        height: 40,
                        boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3)'
                    }}
                >
                    <Description fontSize="small" />
                </Avatar>
                <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {selectedDocument.filename}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
                        Active Analysis
                    </Typography>
                </Box>
            </Box>

            {/* Messages Area */}
            <Box sx={{
                flex: 1,
                overflowY: 'auto',
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
                background: mode === 'light' ? 'rgba(248, 250, 252, 0.3)' : 'rgba(2, 6, 23, 0.3)',
                '&::-webkit-scrollbar': { width: '4px' },
                '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: '4px' }
            }}>
                <AnimatePresence initial={false}>
                    {messages.length === 0 ? (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                            <Typography variant="body2" color="text.secondary">
                                No messages yet. Try asking: "What is this document about?"
                            </Typography>
                        </Box>
                    ) : (
                        messages.map((message) => (
                            <Box
                                component={motion.div}
                                initial={{ opacity: 0, x: message.role === 'user' ? 20 : -20, y: 10 }}
                                animate={{ opacity: 1, x: 0, y: 0 }}
                                transition={{ duration: 0.3 }}
                                key={message.id}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                                }}
                            >
                                <Box sx={{
                                    display: 'flex',
                                    gap: 1.5,
                                    maxWidth: '85%',
                                    flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
                                }}>
                                    <Avatar
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            bgcolor: message.role === 'user' ? 'secondary.main' : 'primary.main',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {message.role === 'user' ? <Person sx={{ fontSize: 18 }} /> : <SmartToy sx={{ fontSize: 18 }} />}
                                    </Avatar>
                                    <Box>
                                        <Paper
                                            elevation={0}
                                            sx={{
                                                p: 2,
                                                borderRadius: message.role === 'user' ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                                                bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                                                color: message.role === 'user' ? '#fff' : 'text.primary',
                                                border: message.role === 'user' ? 'none' : '1px solid',
                                                borderColor: 'divider',
                                                boxShadow: message.role === 'user'
                                                    ? '0 10px 15px -3px rgba(79, 70, 229, 0.2)'
                                                    : '0 4px 6px -1px rgba(0,0,0,0.05)',
                                            }}
                                        >
                                            <Box sx={{
                                                '& p': { m: 0, mb: 1, lineHeight: 1.6, '&:last-child': { mb: 0 } },
                                                '& a': { color: 'inherit', textDecoration: 'underline' },
                                                '& pre': { m: 0, mb: 1.5, borderRadius: 1, overflow: 'hidden' },
                                                '& ul, & ol': { m: 0, mb: 1, pl: 3 },
                                                '& li': { mb: 0.5 }
                                            }}>
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code(props) {
                                                            const { children, className, node, ...rest } = props
                                                            const match = /language-(\w+)/.exec(className || '')
                                                            return match ? (
                                                                // @ts-ignore
                                                                <SyntaxHighlighter
                                                                    {...rest}
                                                                    PreTag="div"
                                                                    children={String(children).replace(/\n$/, '')}
                                                                    language={match[1]}
                                                                    style={vscDarkPlus}
                                                                    customStyle={{ margin: 0 }}
                                                                />
                                                            ) : (
                                                                <code {...rest} className={className} style={{
                                                                    background: 'rgba(0,0,0,0.2)',
                                                                    padding: '2px 4px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.875em',
                                                                    fontFamily: 'monospace'
                                                                }}>
                                                                    {children}
                                                                </code>
                                                            )
                                                        }
                                                    }}
                                                >
                                                    {message.content}
                                                </ReactMarkdown>
                                            </Box>
                                        </Paper>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                mt: 0.5,
                                                display: 'block',
                                                px: 1,
                                                textAlign: message.role === 'user' ? 'right' : 'left',
                                                opacity: 0.6
                                            }}
                                        >
                                            {message.role === 'user' ? 'You' : 'Assistant'} • {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        ))
                    )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </Box>

            {/* Input Area */}
            <Box sx={{ p: 3, background: 'transparent' }}>
                <form onSubmit={handleSend}>
                    <Box sx={{
                        display: 'flex',
                        gap: 1.5,
                        p: 1,
                        borderRadius: '20px',
                        background: mode === 'light' ? '#fff' : 'rgba(15, 23, 42, 0.6)',
                        border: '1.5px solid',
                        borderColor: 'divider',
                        transition: 'all 0.2s',
                        '&:focus-within': {
                            borderColor: 'primary.main',
                            boxShadow: mode === 'light' ? '0 0 0 4px rgba(99, 102, 241, 0.1)' : '0 0 0 4px rgba(129, 140, 248, 0.1)',
                        }
                    }}>
                        <TextField
                            fullWidth
                            name="message"
                            placeholder="Type your question about the document..."
                            variant="standard"
                            autoComplete="off"
                            InputProps={{
                                disableUnderline: true,
                                sx: { px: 2, py: 1, fontSize: '0.95rem' }
                            }}
                        />
                        <IconButton
                            type="submit"
                            color="primary"
                            sx={{
                                bgcolor: 'primary.main',
                                color: '#fff',
                                width: 42,
                                height: 42,
                                '&:hover': {
                                    bgcolor: 'primary.dark',
                                    transform: 'scale(1.05)',
                                },
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        >
                            <Send sx={{ fontSize: 20 }} />
                        </IconButton>
                    </Box>
                </form>
            </Box>
        </Paper>
    );
};

export default Chat;
