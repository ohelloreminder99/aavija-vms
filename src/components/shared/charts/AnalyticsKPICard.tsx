'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AnalyticsKPICardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  isLoading?: boolean;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  color?: 'emerald' | 'amber' | 'cyan' | 'violet' | 'rose';
  formatter?: (val: number | string) => string;
}

const colorMap = {
  emerald: {
    icon: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    glow: 'drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]',
    trend: 'text-emerald-400',
  },
  amber: {
    icon: 'text-amber-400',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    glow: 'drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]',
    trend: 'text-amber-400',
  },
  cyan: {
    icon: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    glow: 'drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]',
    trend: 'text-cyan-400',
  },
  violet: {
    icon: 'text-violet-400',
    iconBg: 'bg-violet-500/10 border-violet-500/20',
    glow: 'drop-shadow-[0_0_12px_rgba(139,92,246,0.5)]',
    trend: 'text-violet-400',
  },
  rose: {
    icon: 'text-rose-400',
    iconBg: 'bg-rose-500/10 border-rose-500/20',
    glow: 'drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]',
    trend: 'text-rose-400',
  },
};

export function AnalyticsKPICard({
  title,
  value,
  subtext,
  icon: Icon,
  isLoading = false,
  trend,
  trendLabel,
  color = 'emerald',
  formatter,
}: AnalyticsKPICardProps) {
  const c = colorMap[color];
  const displayValue = formatter ? formatter(value) : value;

  if (isLoading) {
    return (
      <Card className="glass-card border-white/5 shadow-2xl overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-4 w-24 bg-white/5" />
              <Skeleton className="h-8 w-32 bg-white/5" />
              <Skeleton className="h-3 w-20 bg-white/5" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl bg-white/5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="glass-card border-white/5 shadow-2xl overflow-hidden relative group/kpi transition-all duration-500 hover:border-white/10 hover:scale-[1.02]">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        <CardContent className="p-6 relative z-10">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                {title}
              </p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={String(value)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="text-3xl font-headline font-bold text-white tracking-tight truncate group-hover/kpi:text-glow transition-all duration-300"
                >
                  {displayValue}
                </motion.p>
              </AnimatePresence>
              {(subtext || (trend && trendLabel)) && (
                <div className="flex items-center gap-2 pt-1">
                  {trend && trendLabel && (
                    <span className={cn('flex items-center gap-1 text-[11px] font-bold', c.trend)}>
                      <TrendIcon className="h-3 w-3" />
                      {trendLabel}
                    </span>
                  )}
                  {subtext && (
                    <span className="text-[11px] text-zinc-500 font-medium">{subtext}</span>
                  )}
                </div>
              )}
            </div>
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all duration-500 ml-4',
                c.iconBg
              )}
            >
              <Icon className={cn('h-5 w-5 transition-all duration-500', c.icon, 'group-hover/kpi:' + c.glow)} />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
