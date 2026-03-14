'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

interface DashboardActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const DashboardActionCardComponent = ({
  title,
  description,
  href,
  icon: Icon,
}: DashboardActionCardProps) => {
  return (
    <Link href={href} className="flex">
      <Card className="h-full w-full glass-card border-white/5 hover:border-primary/40 transition-all duration-300 flex flex-col group relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex-row items-center gap-4 space-y-0 p-5 relative z-10">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white/5 border border-white/10 group-hover:border-primary group-hover:bg-primary/20 transition-all shadow-inner">
            <Icon className="h-6 w-6 text-primary group-hover:scale-110 transition-all drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
          </div>
          <div>
            <CardTitle className="text-white group-hover:text-glow transition-all">{title}</CardTitle>
            <CardDescription className="text-zinc-400 group-hover:text-zinc-200 transition-colors">{description}</CardDescription>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-400 group-hover:text-primary ml-auto transition-all transform group-hover:translate-x-1" />
        </CardHeader>
      </Card>
    </Link>
  );
}

export const DashboardActionCard = React.memo(DashboardActionCardComponent);
