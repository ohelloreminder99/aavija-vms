import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Reusable empty state component.
 * Shows a friendly illustration + optional CTA when a list has no items.
 * Matches the dark glassmorphic Aavija design language.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'py-20 text-center border-2 border-dashed border-white/5 rounded-3xl bg-[#010a05]/60 backdrop-blur-sm flex flex-col items-center gap-4',
        className
      )}
    >
      {/* Glow ring around icon */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/5 blur-2xl scale-150" />
        <div className="relative h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Icon className="h-7 w-7 text-zinc-500" />
        </div>
      </div>

      <div className="space-y-1.5 max-w-xs">
        <p className="font-black uppercase tracking-widest text-[11px] text-zinc-300">
          {title}
        </p>
        {description && (
          <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
            {description}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <Button
          size="sm"
          onClick={onAction}
          className="mt-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-black uppercase tracking-widest text-[9px] h-9 px-6 rounded-xl transition-all"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
