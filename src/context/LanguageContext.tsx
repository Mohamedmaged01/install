'use client';

import { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode } from 'react';

type Lang = 'en' | 'ar';

interface LanguageContextType {
    lang: Lang;
    toggleLang: () => void;
    t: (en: string, ar: string) => string;
    dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType>({
    lang: 'en',
    toggleLang: () => { },
    t: (en) => en,
    dir: 'ltr',
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLang] = useState<Lang>('en');

    useLayoutEffect(() => {
        const stored = localStorage.getItem('app_lang') as Lang | null;
        if (stored === 'ar' || stored === 'en') {
            setLang(stored);
        }
    }, []);

    useEffect(() => {
        const dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('dir', dir);
        document.documentElement.setAttribute('lang', lang);
    }, [lang]);

    const toggleLang = () => {
        setLang(prev => {
            const next: Lang = prev === 'en' ? 'ar' : 'en';
            localStorage.setItem('app_lang', next);
            return next;
        });
    };

    const t = (en: string, ar: string) => lang === 'ar' ? ar : en;
    const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';

    return (
        <LanguageContext.Provider value={{ lang, toggleLang, t, dir }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLang() {
    return useContext(LanguageContext);
}
