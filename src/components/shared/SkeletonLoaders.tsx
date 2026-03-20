import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';

interface SkeletonTableRowsProps {
  /** How many skeleton rows to show (default: 5) */
  rows?: number;
  /** How many columns the table has */
  cols?: number;
}

/**
 * Drop-in skeleton replacement for table body content while data is loading.
 * Replace the real `<TableBody>` with this during isLoading state.
 */
export function SkeletonTableRows({ rows = 5, cols = 7 }: SkeletonTableRowsProps) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i} className="border-white/5 hover:bg-transparent">
          {/* First col: icon + text pair */}
          <TableCell className="pl-8 py-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg bg-white/5" />
              <Skeleton className="h-3 w-32 bg-white/5" />
            </div>
          </TableCell>
          {/* Middle cols: badge-sized pills */}
          {Array.from({ length: cols - 2 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton
                className="h-4 bg-white/5 rounded-lg"
                style={{ width: `${48 + (j % 3) * 20}px` }}
              />
            </TableCell>
          ))}
          {/* Last col: action buttons */}
          <TableCell className="text-right pr-8">
            <div className="flex items-center justify-end gap-2">
              <Skeleton className="h-9 w-9 rounded-lg bg-white/5" />
              <Skeleton className="h-9 w-9 rounded-lg bg-white/5" />
              <Skeleton className="h-9 w-9 rounded-lg bg-white/5" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

/**
 * Full-width card skeleton — used for application cards, stat cards, etc.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-white/5 p-6 space-y-4 ${className ?? ''}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 bg-white/5 rounded-lg" />
          <Skeleton className="h-3 w-28 bg-white/5 rounded-lg" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full bg-white/5" />
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-full bg-white/5 rounded-lg" />
        <Skeleton className="h-3 w-3/4 bg-white/5 rounded-lg" />
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-24 rounded-xl bg-white/5" />
        <Skeleton className="h-9 w-24 rounded-xl bg-white/5" />
      </div>
    </div>
  );
}

/**
 * Inline stat skeleton — small horizontal pill
 */
export function SkeletonStat() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-8 w-8 rounded-lg bg-white/5" />
      <div className="space-y-1">
        <Skeleton className="h-3 w-16 bg-white/5 rounded" />
        <Skeleton className="h-2 w-10 bg-white/5 rounded" />
      </div>
    </div>
  );
}
