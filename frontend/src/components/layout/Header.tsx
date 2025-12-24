import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box } from '@mui/material';
import { Description, Brightness4, Brightness7 } from '@mui/icons-material';

interface HeaderProps {
    mode: 'light' | 'dark';
    onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ mode, onToggleTheme }) => (
    <AppBar position="fixed" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                    sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'primary.main',
                        color: '#ffffff',
                        mr: 1.5
                    }}
                >
                    <Description sx={{ fontSize: 20 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(45deg, #6366f1 30%, #a5b4fc 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    DocuWise AI
                </Typography>
            </Box>
            <IconButton
                onClick={onToggleTheme}
                sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '10px',
                    p: 1
                }}
                aria-label="toggle theme"
            >
                {mode === 'dark' ? <Brightness7 sx={{ fontSize: 20 }} /> : <Brightness4 sx={{ fontSize: 20, color: '#475569' }} />}
            </IconButton>
        </Toolbar>
    </AppBar>
);

export default Header;
