'use client';

import * as React from 'react';
import { useTranslation, languages } from '@/i18n/LanguageContext';
import { useSettings } from '@/services/settings-service';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
    const { data: settings, isLoading } = useSettings();
    const { locale, setLocale } = useTranslation();

    // If loading or the kill switch is disabled, return nothing.
    if (isLoading || settings?.enable_multilingual === false) {
        return null;
    }

    const currentLanguageName = languages.find(l => l.code === locale)?.name || 'English';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex px-2">
                    <Globe className="h-4 w-4 mr-2" />
                    <span className="text-sm">{currentLanguageName}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {languages.map((lang) => (
                    <DropdownMenuItem
                        key={lang.code}
                        onClick={() => setLocale(lang.code)}
                        className={locale === lang.code ? 'bg-accent/50' : ''}
                    >
                        {lang.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
