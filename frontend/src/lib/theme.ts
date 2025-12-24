import { createTheme, type ThemeOptions } from '@mui/material/styles';

const getThemeOptions = (mode: 'light' | 'dark'): ThemeOptions => ({
    palette: {
        mode,
        primary: {
            main: mode === 'light' ? '#6366f1' : '#818cf8',
            light: mode === 'light' ? '#818cf8' : '#a5b4fc',
            dark: mode === 'light' ? '#4f46e5' : '#6366f1',
        },
        secondary: {
            main: mode === 'light' ? '#06b6d4' : '#22d3ee',
        },
        background: {
            default: mode === 'light' ? '#f8fafc' : '#020617',
            paper: mode === 'light' ? '#ffffff' : '#0f172a',
        },
        text: {
            primary: mode === 'light' ? '#0f172a' : '#f1f5f9',
            secondary: mode === 'light' ? '#475569' : '#94a3b8',
        },
        divider: mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(241, 245, 249, 0.08)',
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h4: {
            fontWeight: 700,
            letterSpacing: '-0.02em',
        },
        h5: {
            fontWeight: 700,
            letterSpacing: '-0.01em',
        },
        h6: {
            fontWeight: 600,
            letterSpacing: '-0.01em',
        },
        button: {
            fontWeight: 600,
            textTransform: 'none',
        },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '8px 16px',
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: 'none',
                    },
                },
                containedPrimary: {
                    '&:hover': {
                        backgroundColor: mode === 'light' ? '#4f46e5' : '#6366f1',
                    },
                },
            } as const,
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    border: mode === 'light'
                        ? '1px solid rgba(15, 23, 42, 0.08)'
                        : '1px solid rgba(241, 245, 249, 0.08)',
                    boxShadow: mode === 'light'
                        ? '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
                        : '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(2, 6, 23, 0.8)',
                    backdropFilter: 'blur(8px)',
                    color: mode === 'light' ? '#0f172a' : '#f1f5f9',
                    boxShadow: 'none',
                    borderBottom: mode === 'light'
                        ? '1px solid rgba(15, 23, 42, 0.08)'
                        : '1px solid rgba(241, 245, 249, 0.08)',
                },
            },
        },
    },
});

export const createAppTheme = (mode: 'light' | 'dark') =>
    createTheme(getThemeOptions(mode));