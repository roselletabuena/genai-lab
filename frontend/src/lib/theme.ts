import { createTheme, type ThemeOptions } from '@mui/material/styles';

const getThemeOptions = (mode: 'light' | 'dark'): ThemeOptions => ({
    palette: {
        mode,
        primary: {
            main: mode === 'light' ? '#4f46e5' : '#818cf8',
            light: mode === 'light' ? '#818cf8' : '#a5b4fc',
            dark: mode === 'light' ? '#3730a3' : '#6366f1',
        },
        secondary: {
            main: mode === 'light' ? '#0ea5e9' : '#38bdf8',
        },
        background: {
            default: mode === 'light' ? '#f8fafc' : '#020617',
            paper: mode === 'light' ? '#ffffff' : '#0f172a',
        },
        text: {
            primary: mode === 'light' ? '#0f172a' : '#f8fafc',
            secondary: mode === 'light' ? '#475569' : '#94a3b8',
        },
        divider: mode === 'light' ? 'rgba(15, 23, 42, 0.06)' : 'rgba(241, 245, 249, 0.06)',
    },
    typography: {
        fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
        h1: { fontFamily: '"Outfit", sans-serif', fontWeight: 700 },
        h2: { fontFamily: '"Outfit", sans-serif', fontWeight: 700 },
        h3: { fontFamily: '"Outfit", sans-serif', fontWeight: 700 },
        h4: {
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            letterSpacing: '-0.02em',
        },
        h5: {
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            letterSpacing: '-0.01em',
        },
        h6: {
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 600,
            letterSpacing: '-0.01em',
        },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        button: {
            fontWeight: 600,
            textTransform: 'none',
            letterSpacing: '0.01em',
        },
    },
    shape: {
        borderRadius: 12,
    },
    shadows: [
        'none',
        '0px 1px 2px rgba(0, 0, 0, 0.05)',
        '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)',
        '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.05)',
        '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)',
        ...Array(20).fill('none'), // Basic filling for higher levels
    ] as any,
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    padding: '10px 20px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        transform: 'translateY(-1px)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                    },
                },
                contained: {
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 20,
                    border: mode === 'light'
                        ? '1px solid rgba(15, 23, 42, 0.06)'
                        : '1px solid rgba(241, 245, 249, 0.06)',
                    boxShadow: mode === 'light'
                        ? '0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -2px rgb(0 0 0 / 0.02)'
                        : '0 20px 25px -5px rgb(0 0 0 / 0.2), 0 10px 10px -5px rgb(0 0 0 / 0.1)',
                    backgroundImage: 'none',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    backgroundImage: 'none',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(2, 6, 23, 0.8)',
                    backdropFilter: 'blur(12px)',
                    color: mode === 'light' ? '#0f172a' : '#f8fafc',
                    boxShadow: 'none',
                    borderBottom: mode === 'light'
                        ? '1px solid rgba(15, 23, 42, 0.06)'
                        : '1px solid rgba(241, 245, 249, 0.06)',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 12,
                        transition: 'all 0.2s ease',
                        '&:hover fieldset': {
                            borderColor: mode === 'light' ? '#6366f1' : '#818cf8',
                        },
                    },
                },
            },
        },
    },
});

export const createAppTheme = (mode: 'light' | 'dark') =>
    createTheme(getThemeOptions(mode));
