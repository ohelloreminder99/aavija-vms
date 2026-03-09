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
      <Card className="h-full w-full hover:bg-accent/50 transition-colors duration-200 ease-in-out flex flex-col">
        <CardHeader className="flex-row items-center gap-4 space-y-0">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
        </CardHeader>
      </Card>
    </Link>
  );
}

export const DashboardActionCard = React.memo(DashboardActionCardComponent);
