'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'dark',
    toggleTheme: () => { },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>('dark');

    // Load initial theme from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('app_theme') as Theme | null;
        if (stored === 'light' || stored === 'dark') {
            setTheme(stored);
        } else {
            // Optional: Auto detect system preference
            const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
            if (prefersLight) {
                setTheme('light');
            }
        }
    }, []);

    // Apply the active theme to the Document HTML tag
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        // We ensure we can control base color schemes 
        document.documentElement.style.colorScheme = theme;
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => {
            const next: Theme = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('app_theme', next);
            return next;
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
