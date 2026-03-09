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
    const content = (
        <Card className={cn(cardVariants({ variant }))}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              {description && <CardDescription className="text-xs mt-1">{description}</CardDescription>}
            </div>
            <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </CardHeader>
        {value !== undefined && (
            <CardContent>
                {isLoading ? (
                <Skeleton className="h-8 w-1/2" />
                ) : (
                <div className="text-2xl font-bold">{value}</div>
                )}
            </CardContent>
        )}
        {links && (
            <CardContent className="flex-grow flex flex-col justify-center pt-2 gap-1">
            {links.map((link) => (
                <Link key={link.href} href={link.href} className="flex items-center justify-between p-2 -mx-2 rounded-md hover:bg-muted">
                    <span>{link.title}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
            ))}
          </CardContent>
        )}
        </Card>
    );

  if (href) {
    return <Link href={href} className="flex">{content}</Link>;
  }
  return content;
}

export const DashboardCard = React.memo(DashboardCardComponent);
