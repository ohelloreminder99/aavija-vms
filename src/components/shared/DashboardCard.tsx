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
        default: "min-h-[100px]",
        stat: "justify-center min-h-[80px]",
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
    <Card className={cn("glass-card border-white/10 shadow-xl overflow-hidden relative group/card h-full transition-all duration-500", cardVariants({ variant }))}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 pointer-events-none group-hover/card:opacity-100 transition-opacity duration-500" />
      <CardHeader className={cn(
        "relative z-10 flex flex-row items-start justify-between space-y-0 pb-3 px-5 pt-5",
        variant === 'stat' && value === undefined && "pb-5"
      )}>
        <div className="space-y-1">
          <CardTitle className="text-base font-bold text-white group-hover/card:text-glow transition-all leading-tight">{title}</CardTitle>
          {description && <CardDescription className="text-sm text-zinc-400 group-hover/card:text-zinc-200 transition-colors leading-relaxed line-clamp-2">{description}</CardDescription>}
        </div>
        <div className="h-10 w-10 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover/card:border-primary/30 group-hover/card:bg-primary/10 transition-all duration-300 ml-4">
          <Icon className="h-5 w-5 text-primary group-hover/card:scale-110 transition-all duration-300 drop-shadow-[0_0_8px_rgba(16,185,129,0)] group-hover/card:drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]" />
        </div>
      </CardHeader>
      {value !== undefined && (
        <CardContent className="relative z-10 pt-0 pb-5 px-5">
          {isLoading ? (
            <Skeleton className="h-7 w-20 bg-white/5 rounded-md" />
          ) : (
            <div className="text-2xl font-headline font-bold text-white tracking-tight transform group-hover/card:translate-x-1 group-hover/card:text-glow transition-all duration-300">{value}</div>
          )}
        </CardContent>
      )}
      {links && (
        <CardContent className="relative z-10 flex-grow flex flex-col justify-center pt-1 pb-4 px-4 gap-1.5">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 group/link shadow-sm hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 group-hover/link:text-white transition-colors">{link.title}</span>
              <ChevronRight className="h-3 w-3 text-zinc-500 group-hover/link:text-primary transition-all duration-300 group-hover/link:translate-x-1" />
            </Link>
          ))}
        </CardContent>
      )}
      {href && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary/50 transform scale-x-0 group-hover/card:scale-x-100 transition-transform origin-left duration-500" />
      )}
    </Card>
  );

  if (href) {
    return <Link href={href} className="flex h-full w-full">{cardContent}</Link>;
  }
  return cardContent;
}

export const DashboardCard = React.memo(DashboardCardComponent);
