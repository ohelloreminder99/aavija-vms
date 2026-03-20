
'use client';

import {
  Activity,
  Megaphone,
  Users,
  Building,
  Coins,
  History,
  Map,
  Shapes,
  MessageCircle,
  UserCog,
  Trash2,
  BookText,
  FileSpreadsheet,
  QrCode,
  Scale,
  ShieldAlert,
  Palette,
  Box,
} from 'lucide-react';
import * as React from 'react';
import { DashboardCard } from '@/components/shared/DashboardCard';
import { useSettings } from '@/services/settings-service';

const locationLinks = [
  { title: 'States', href: '/dashboard/admin/states' },
  { title: 'Districts', href: '/dashboard/admin/districts' },
  { title: 'Cities', href: '/dashboard/admin/cities' },
];

export function AdminDashboard() {
  const { data: settings } = useSettings();
  const dashboardItems: {
    title: string;
    href?: string;
    icon: any;
    variant?: 'default' | 'stat' | 'group';
    links?: { title: string; href: string }[];
  }[] = [
    {
      title: 'Sales Agents',
      href: '/dashboard/admin/referrals',
      icon: Users,
    },
    {
      title: 'Announcement',
      href: '/dashboard/admin/announcements',
      icon: Megaphone,
    },
    {
      title: 'Audit Log',
      href: '/dashboard/admin/logs',
      icon: BookText,
    },
    {
      title: 'Bills & GST',
      href: '/dashboard/admin/bills',
      icon: FileSpreadsheet,
    },
    {
      title: 'Authentication Cleanup',
      href: '/dashboard/admin/cleanup-auth',
      icon: Trash2,
    },
    {
      title: 'Log Cleanup',
      href: '/dashboard/admin/cleanup-logs',
      icon: Trash2,
    },
    {
      title: 'QR Token Cleanup',
      href: '/dashboard/admin/cleanup-tokens',
      icon: QrCode,
    },
    {
      title: 'Contact Submissions',
      href: '/dashboard/admin/contact-submissions',
      icon: MessageCircle,
    },
    {
      title: 'History Setting',
      href: '/dashboard/admin/history-settings',
      icon: History,
    },
    {
      title: 'Landing Page Setting',
      href: '/dashboard/admin/landing-settings',
      icon: Shapes,
    },
    {
      title: 'Legal Setting',
      href: '/dashboard/admin/legal-settings',
      icon: Scale,
    },
    {
      title: 'Locations',
      icon: Map,
      variant: 'group' as const,
      links: locationLinks,
    },
    {
      title: 'Manage All Users',
      href: '/dashboard/admin/all-users',
      icon: Users,
    },
    {
      title: 'Manage Staff',
      href: '/dashboard/admin/staff',
      icon: UserCog,
    },
    {
      title: `Property Balance ${settings?.hide_token_economy ? '(Hidden)' : ''}`,
      href: '/dashboard/admin/owner-tokens',
      icon: Coins,
    },
    {
      title: 'Property Types',
      href: '/dashboard/admin/premise-categories',
      icon: Shapes,
    },
    {
      title: 'Token Setting',
      href: '/dashboard/admin/token-settings',
      icon: Coins,
    },
    {
      title: 'Production & Security',
      href: '/dashboard/admin/production-settings',
      icon: ShieldAlert,
    },
    {
      title: 'All Properties',
      href: '/dashboard/admin/premises',
      icon: Building,
    },
    {
      title: 'All Visitors',
      href: '/dashboard/admin/visitors',
      icon: Users,
    },
    {
      title: `Visitor Balance ${settings?.hide_token_economy ? '(Hidden)' : ''}`,
      href: '/dashboard/admin/visitor-tokens',
      icon: Coins,
    },
    {
      title: 'Brand Identity',
      href: '/dashboard/admin/branding-settings',
      icon: Palette,
    },
    {
      title: 'Service Config',
      href: '/dashboard/admin/service-settings',
      icon: Box,
    },
    {
      title: 'System Health',
      href: '/dashboard/admin/health',
      icon: Activity,
    },
  ].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {dashboardItems.map((item) => (
        <DashboardCard
          key={item.title}
          title={item.title}
          href={item.href}
          icon={item.icon}
          variant={item.variant}
          links={item.links}
        />
      ))}
    </div>
  );
}
