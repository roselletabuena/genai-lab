import React from 'react';
import { Typography, IconButton, Box } from '@mui/material';
import { Brightness4, Brightness7, AutoAwesome } from '@mui/icons-material';
import { motion } from 'framer-motion';

interface HeaderProps {
    mode: 'light' | 'dark';
    onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ mode, onToggleTheme }) => (
    <Box
        component={motion.header}
        initial={{ y: -50, opacity: 0, x: '-50%' }}
        animate={{ y: 0, opacity: 1, x: '-50%' }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 120, damping: 20 }}
        sx={{
            position: 'fixed',
            top: 12,
            left: '50%',
            width: 'auto',
            minWidth: { xs: '90%', sm: '320px', md: '420px' },
            zIndex: 1100,
            px: 2,
        }}
    >
        <Box
            className="glass"
            sx={{
                borderRadius: '100px', // Pill shape
                px: 2,
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: mode === 'light'
                    ? '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
                    : '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
                border: '1px solid',
                borderColor: mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                height: 44, // Even more compact
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)',
                        color: '#ffffff',
                    }}
                >
                    <AutoAwesome sx={{ fontSize: 16 }} />
                </Box>
                <Typography
                    variant="subtitle1"
                    sx={{
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        fontSize: '1.05rem',
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

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton
                    onClick={onToggleTheme}
                    size="small"
                    sx={{
                        borderRadius: '10px',
                        width: 36,
                        height: 36,
                        transition: 'all 0.2s',
                        '&:hover': {
                            backgroundColor: 'rgba(99, 102, 241, 0.08)',
                        }
                    }}
                >
                    {mode === 'dark' ? <Brightness7 sx={{ fontSize: 18, color: '#fbbf24' }} /> : <Brightness4 sx={{ fontSize: 18, color: '#475569' }} />}
                </IconButton>
            </Box>
        </Box>
    </Box>
);

export default Header;


