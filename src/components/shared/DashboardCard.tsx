'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

const cardVariants = cva(
  "h-full w-full hover:bg-accent hover:text-accent-foreground transition-colors duration-200 ease-in-out flex flex-col",
  {
    variants: {
      variant: {
        default: "",
        stat: "justify-center",
        group: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface DashboardCardProps extends VariantProps<typeof cardVariants> {
  title: string;
  href?: string;
  icon: LucideIcon;
  value?: string | number;
  isLoading?: boolean;
  links?: { title: string; href: string }[];
  description?: string;
}

const DashboardCardComponent = ({
  title,
  href,
  icon: Icon,
  value,
  isLoading,
  variant,
  links,
  description,
}: DashboardCardProps) => {
  const cardContent = (
    <Card className={cn("glass-card border-zinc-200/60 shadow-xl overflow-hidden relative group/card h-full transition-all duration-500", cardVariants({ variant }))}>
      <div className="absolute inset-0 mesh-porcelain opacity-40 pointer-events-none group-hover/card:opacity-60 transition-opacity" />
      <CardHeader className="relative z-10 flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover/card:text-primary transition-colors">{title}</CardTitle>
          {description && <CardDescription className="text-[10px] text-zinc-700 font-semibold uppercase tracking-tight line-clamp-1">{description}</CardDescription>}
        </div>
        <div className="h-8 w-8 rounded-lg bg-zinc-200/40 border border-zinc-200/60 flex items-center justify-center group-hover/card:border-primary/30 transition-all">
          <Icon className="h-4 w-4 text-zinc-600 group-hover/card:text-primary transition-colors drop-shadow-[0_0_8px_rgba(59,130,246,0)] group-hover/card:drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]" />
        </div>
      </CardHeader>
      {value !== undefined && (
        <CardContent className="relative z-10 pt-0 pb-6">
          {isLoading ? (
            <Skeleton className="h-8 w-24 bg-zinc-200/20" />
          ) : (
            <div className="text-3xl font-headline font-bold text-zinc-900 tracking-tight transform group-hover/card:translate-x-1 transition-transform">{value}</div>
          )}
        </CardContent>
      )}
      {links && (
        <CardContent className="relative z-10 flex-grow flex flex-col justify-center pt-2 gap-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="flex items-center justify-between p-3 rounded-xl bg-zinc-200/20 border border-zinc-200/40 hover:bg-zinc-200/40 hover:border-zinc-300 transition-all group/link shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700 group-hover/link:text-zinc-900">{link.title}</span>
              <ChevronRight className="h-3 w-3 text-zinc-400 group-hover/link:text-primary transition-colors" />
            </Link>
          ))}
        </CardContent>
      )}
      {href && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary transform scale-x-0 group-hover/card:scale-x-100 transition-transform origin-left" />
      )}
    </Card>
  );

  if (href) {
    return <Link href={href} className="flex h-full w-full">{cardContent}</Link>;
  }
  return cardContent;
}

export const DashboardCard = React.memo(DashboardCardComponent);
