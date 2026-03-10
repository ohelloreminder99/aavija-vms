'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, ArrowRight, Zap, Building2, ShieldCheck, Users, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Premise } from '@/services/premise-service';

interface OnboardingChecklistProps {
    premise?: any;
    isLoading?: boolean;
}

export function OnboardingChecklist({ premise, isLoading }: OnboardingChecklistProps) {
    if (isLoading) return null;

    const steps = [
        {
            id: 'premise',
            title: 'Create your Premise',
            description: 'Define your building or community location.',
            completed: !!premise,
            href: '/dashboard/owner/gst-details'
        },
        {
            id: 'gatekeeper',
            title: 'Add a Gatekeeper',
            description: 'Create accounts for your security staff.',
            completed: (premise?.gatekeeper_count ?? 0) > 0,
            href: `/dashboard/owner/gatekeepers?premiseId=${premise?.id}`
        },
        {
            id: 'hosts',
            title: 'Invite Hosts',
            description: 'Add residents or employees who receive visitors.',
            completed: (premise?.host_count ?? 0) > 0,
            href: `/dashboard/owner/hosts?premiseId=${premise?.id}`
        },
        {
            id: 'tokens',
            title: 'Verify Token Balance',
            description: 'Ensure you have tokens for visitor history exports.',
            completed: (premise?.token_balance ?? 0) > 0,
            href: `/dashboard/owner/token-history?premiseId=${premise?.id}`
        }
    ];

    const completedCount = steps.filter(s => s.completed).length;
    const isAllCompleted = completedCount === steps.length;

    if (isAllCompleted) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-3xl p-8 mb-8 overflow-hidden group"
        >
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <Zap className="w-32 h-32" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                        Get Started with Aavija
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">Setup Guide</span>
                    </h2>
                    <p className="text-gray-400 text-sm">Follow these steps to fully activate your premise security.</p>
                </div>
                <div className="flex items-center gap-4 bg-black/20 rounded-2xl px-4 py-2 border border-white/5">
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-gray-500">Progress</p>
                        <p className="text-lg font-bold text-blue-400 leading-none">{completedCount}/{steps.length}</p>
                    </div>
                    <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${(completedCount / steps.length) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {steps.map((step, i) => (
                    <Link
                        key={step.id}
                        href={step.completed ? '#' : step.href}
                        className={`p-4 rounded-2xl border transition-all ${step.completed
                            ? 'bg-green-500/5 border-green-500/20 opacity-60 grayscale'
                            : 'bg-white/5 border-white/10 hover:border-blue-500/30 hover:bg-white/10'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            {step.completed ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : (
                                <Circle className="w-5 h-5 text-gray-600" />
                            )}
                            <span className="text-[10px] font-bold text-gray-600">STEP {i + 1}</span>
                        </div>
                        <h3 className="font-bold text-sm mb-1">{step.title}</h3>
                        <p className="text-[10px] text-gray-500 leading-relaxed">{step.description}</p>
                    </Link>
                ))}
            </div>
        </motion.div>
    );
}
