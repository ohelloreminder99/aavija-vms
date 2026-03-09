'use client';

import { AdminDashboard } from './components/AdminDashboard';

export default function AdminDashboardPage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8">Admin Dashboard</h1>
      <AdminDashboard />
    </div>
  );
}
