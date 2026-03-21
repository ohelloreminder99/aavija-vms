'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  title: string;
  description?: string;
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
  minHeight?: string;
}

export function ChartContainer({
  title,
  description,
  isLoading = false,
  children,
  className,
  minHeight = '280px',
}: ChartContainerProps) {
  return (
    <Card className={cn('glass-card border-white/5 shadow-2xl overflow-hidden relative', className)}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
      <CardHeader className="relative z-10 pb-2">
        <CardTitle className="text-base font-headline font-bold text-white">{title}</CardTitle>
        {description && (
          <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="relative z-10 pb-6">
        {isLoading ? (
          <div style={{ minHeight }} className="flex flex-col justify-end gap-2 pt-4">
            <div className="flex items-end gap-2 h-full">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="flex-1 bg-white/5 rounded-t-sm"
                  style={{ height: `${Math.random() * 60 + 30}%`, minHeight: '20px' }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ minHeight }}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
