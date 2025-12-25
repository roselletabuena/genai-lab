import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Container } from '@mui/material';
import { Brightness4, Brightness7, AutoAwesome } from '@mui/icons-material';

interface HeaderProps {
    mode: 'light' | 'dark';
    onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ mode, onToggleTheme }) => (
    <AppBar position="fixed" elevation={0} className="glass">
        <Container maxWidth="xl">
            <Toolbar sx={{ justifyContent: 'space-between', px: '0 !important', height: 80 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                        sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)',
                            color: '#ffffff',
                            boxShadow: '0 4px 12px -2px rgba(79, 70, 229, 0.4)',
                        }}
                    >
                        <AutoAwesome sx={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 800,
                                lineHeight: 1,
                                letterSpacing: '-0.03em',
                                fontSize: '1.4rem',
                                background: mode === 'light'
                                    ? 'linear-gradient(45deg, #1e293b 30%, #475569 90%)'
                                    : 'linear-gradient(45deg, #f8fafc 30%, #cbd5e1 90%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                            }}
                        >
                            DocuWise <Typography component="span" sx={{ color: 'primary.main', fontWeight: 800, fontSize: 'inherit', WebkitTextFillColor: 'initial' }}>AI</Typography>
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton
                        onClick={onToggleTheme}
                        sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '12px',
                            width: 42,
                            height: 42,
                            transition: 'all 0.2s',
                            '&:hover': {
                                backgroundColor: 'rgba(99, 102, 241, 0.05)',
                                borderColor: 'primary.light',
                                transform: 'rotate(15deg)',
                            }
                        }}
                        aria-label="toggle theme"
                    >
                        {mode === 'dark' ? <Brightness7 sx={{ fontSize: 22, color: '#fbbf24' }} /> : <Brightness4 sx={{ fontSize: 22, color: '#475569' }} />}
                    </IconButton>
                </Box>
            </Toolbar>
        </Container>
    </AppBar>
);

export default Header;

