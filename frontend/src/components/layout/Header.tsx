import React from 'react';
import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import { Description, Brightness4, Brightness7 } from '@mui/icons-material';

interface HeaderProps {
    mode: 'light' | 'dark';
    onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ mode, onToggleTheme }) => (
    <AppBar position="fixed" elevation={1}>
        <Toolbar>
            <Description sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
                AI Document Assistant
            </Typography>
            <IconButton color="inherit" onClick={onToggleTheme} aria-label="toggle theme">
                {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
        </Toolbar>
    </AppBar>
);

export default Header;
