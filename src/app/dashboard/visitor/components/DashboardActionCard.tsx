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
      <Card className="h-full w-full glass-card hover:bg-white hover:border-primary/20 transition-all duration-300 flex flex-col group">
        <CardHeader className="flex-row items-center gap-4 space-y-0 p-5">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/5 border border-primary/10 group-hover:border-primary/30 group-hover:bg-primary/10 transition-all">
            <Icon className="h-6 w-6 text-primary group-hover:scale-110 transition-all" />
          </div>
          <div>
            <CardTitle className="text-zinc-900 group-hover:text-primary transition-all">{title}</CardTitle>
            <CardDescription className="text-zinc-500 group-hover:text-zinc-600 transition-colors">{description}</CardDescription>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-300 group-hover:text-primary ml-auto transition-all transform group-hover:translate-x-1" />
        </CardHeader>
      </Card>
    </Link>
  );
}

export const DashboardActionCard = React.memo(DashboardActionCardComponent);
