'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import en from './dictionaries/en.json';
import hi from './dictionaries/hi.json';
import mr from './dictionaries/mr.json';
import gu from './dictionaries/gu.json';
import bn from './dictionaries/bn.json';
import ta from './dictionaries/ta.json';
import te from './dictionaries/te.json';
import kn from './dictionaries/kn.json';
import ml from './dictionaries/ml.json';
import pa from './dictionaries/pa.json';
import ur from './dictionaries/ur.json';

const dictionaries: Record<string, any> = {
    en, hi, mr, gu, bn, ta, te, kn, ml, pa, ur
};

export const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिंदी' },
    { code: 'mr', name: 'मराठी' },
    { code: 'gu', name: 'ગુજરાતી' },
    { code: 'bn', name: 'বাংলা' },
    { code: 'ta', name: 'தமிழ்' },
    { code: 'te', name: 'తెలుగు' },
    { code: 'kn', name: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'മലയാളം' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ' },
    { code: 'ur', name: 'اردو' }
];

interface LanguageContextType {
    locale: string;
    setLocale: (locale: string) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState('en');
    const [dict, setDict] = useState<any>(en);

    useEffect(() => {
        // Read from NEXT_LOCALE cookie on mount
        const match = document.cookie.match(/(?:^|;)\s*NEXT_LOCALE=([^;]*)/);
        const savedLocale = match ? match[1] : 'en';
        if (dictionaries[savedLocale]) {
            setLocaleState(savedLocale);
            setDict(dictionaries[savedLocale]);
        }
    }, []);

    const setLocale = (newLocale: string) => {
        if (dictionaries[newLocale]) {
            setLocaleState(newLocale);
            setDict(dictionaries[newLocale]);
            document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`; // Save for 1 year
        }
    };

    const t = (key: string): string => {
        // Return translation, fallback to English, fallback to raw key
        return dict[key] || en[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within an I18nProvider');
    }
    return context;
}
