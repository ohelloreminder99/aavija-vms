'use client';

import React, { type ReactNode } from 'react';
import { SupabaseProvider } from '@/supabase/provider';

interface SupabaseClientProviderProps {
  children: ReactNode;
}

export function SupabaseClientProvider({ children }: SupabaseClientProviderProps) {
  return (
    <SupabaseProvider>
      {children}
    </SupabaseProvider>
  );
}

