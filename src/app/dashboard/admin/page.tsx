'use client';

import { AdminDashboard } from './components/AdminDashboard';
import { Shield } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div className="container py-10 max-w-7xl">
      <div className="mb-10 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>
          <h1 className="text-4xl font-headline font-bold tracking-tight text-zinc-900">Admin <span className="text-primary/80">Dashboard</span></h1>
        </div>
        <p className="text-zinc-600 text-[11px] font-semibold uppercase tracking-[0.2em] max-w-2xl leading-relaxed ml-1">
          Manage your properties, users, and system settings. Monitor revenue, payments, and GST compliance from one place.
        </p>
      </div>

      <div className="relative group/grid">
        <div className="absolute -inset-10 bg-primary/5 blur-[100px] opacity-0 group-hover/grid:opacity-100 transition-opacity pointer-events-none" />
        <AdminDashboard />
      </div>
    </div>
  );
}
