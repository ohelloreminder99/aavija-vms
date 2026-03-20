'use client';

/**
 * AAVIJA VMS — Apply for a New Premise Page
 * Route: /dashboard/visitor/apply
 */

import * as React from 'react';
import { useUser } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useCities } from '@/services/city-service';
import { usePremiseCategories } from '@/services/premise-category-service';
import { ApplyForPremiseForm } from '../../admin/premises/components/ApplyForPremiseForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ApplyPage() {
  const { user } = useUser();
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id);
  const { data: cities, isLoading: citiesLoading } = useCities();
  const { data: categories, isLoading: categoriesLoading } = usePremiseCategories();

  const isLoading = profileLoading || citiesLoading || categoriesLoading;

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-2xl px-4">
      <div className="mb-8">
        <Button asChild variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 mb-6 group">
          <Link href="/dashboard/visitor">
            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
          </Link>
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-4xl font-headline font-bold text-white tracking-tight">Apply for <span className="text-primary/80">Premise</span></h1>
        </div>
        <p className="text-zinc-500 text-sm font-medium tracking-wide">
          Submit details for a new property you want to manage. Admin will review and approve.
        </p>
      </div>

      <Card className="glass-card border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 mesh-obsidian opacity-20 pointer-events-none" />
        <CardHeader className="relative z-10 border-b border-white/5 pb-8">
          <CardTitle className="text-xl font-bold text-white">Property Registration</CardTitle>
          <CardDescription className="text-zinc-400 text-xs">
            Enter the details of the premise and the existing owner's email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 pt-8">
          <ApplyForPremiseForm
            agentName={profile?.name || ''}
            agentEmail={profile?.email || ''}
            cities={cities || []}
            categories={categories || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
