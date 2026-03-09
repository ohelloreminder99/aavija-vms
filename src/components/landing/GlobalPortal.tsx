'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Globe, ArrowRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const regions = [
    {
        id: 'india',
        name: 'India',
        domain: 'india.aavija.com',
        status: 'Operational',
        flag: '🇮🇳',
        description: 'Premier Visitor Management for the Indian subcontinent.',
    },
    {
        id: 'gulf',
        name: 'Gulf Regions',
        domain: '#',
        status: 'Coming Soon',
        flag: '🇦🇪',
        description: 'Securing premises across the GCC.',
    },
    {
        id: 'sea',
        name: 'South East Asia',
        domain: '#',
        status: 'Coming Soon',
        flag: '🇸🇬',
        description: 'Next-gen VMS for the Asian business hubs.',
    },
];

export function GlobalPortal() {
    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 overflow-hidden relative">
            {/* Background Ambient Glow */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="z-10 text-center mb-12"
            >
                <div className="flex items-center justify-center mb-6">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="p-3 bg-white/5 rounded-full border border-white/10 backdrop-blur-xl"
                    >
                        <Globe className="w-12 h-12 text-blue-400" />
                    </motion.div>
                </div>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                    Aavija
                </h1>
                <p className="text-gray-400 text-lg md:text-xl max-w-md mx-auto font-light">
                    Securing premises across the globe. Select your region to begin.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl z-10 px-4">
                {regions.map((region, index) => (
                    <motion.div
                        key={region.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                    >
                        <Link
                            href={region.domain === '#' ? '#' : `https://${region.domain}`}
                            className={`group block p-6 rounded-2xl border bg-white/5 backdrop-blur-md transition-all duration-300 ${region.status === 'Operational'
                                    ? 'border-white/10 hover:border-blue-500/50 hover:bg-white/10'
                                    : 'border-white/5 opacity-60 cursor-not-allowed'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-4xl">{region.flag}</span>
                                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${region.status === 'Operational'
                                        ? 'border-green-500/30 text-green-400 bg-green-500/10'
                                        : 'border-white/20 text-gray-400'
                                    }`}>
                                    {region.status}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold mb-2 flex items-center group-hover:text-blue-400 transition-colors">
                                {region.name}
                                {region.status === 'Operational' && (
                                    <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                )}
                            </h3>
                            <p className="text-sm text-gray-400 font-light leading-relaxed">
                                {region.description}
                            </p>
                        </Link>
                    </motion.div>
                ))}
            </div>

            <motion.footer
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="mt-20 text-gray-500 text-sm font-light z-10"
            >
                © {new Date().getFullYear()} Aavija Technology Group. All rights reserved.
            </motion.footer>

            {/* Decorative Grid */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />
        </div>
    );
}
