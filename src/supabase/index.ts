'use client';

// Export the new Supabase-backed hooks
export * from './firestore/use-collection';
export * from './firestore/use-static-collection';
export * from './firestore/use-rpc';
// WithId is exported primarily from use-collection now to avoid conflicts
export * from './firestore/use-doc';

// Keep stubs for these to prevent widespread import errors right away, 
// we will update them or remove them as we migrate components
export * from './provider';
export * from './client-provider';
export * from './error-emitter';

// Provide a dummy useFirestore hook since it won't be needed with Supabase client
export function useFirestore() {
  return null; // The new hooks instantiate `createClient` internally
}

export function useMemoSupabase<T>(factory: () => T, deps: React.DependencyList): T & { __memo: boolean } {
  const result = React.useMemo(factory, deps) as T & { __memo: boolean };
  if (result && typeof result === 'object') {
    result.__memo = true;
  }
  return result;
}

import * as React from 'react';


