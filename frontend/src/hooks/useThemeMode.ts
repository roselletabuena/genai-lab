import { useState, useCallback } from 'react';

export const useThemeMode = () => {
    const [mode, setMode] = useState<'light' | 'dark'>('light');

    const toggleTheme = useCallback(() => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
    }, []);

    return { mode, toggleTheme };
};
