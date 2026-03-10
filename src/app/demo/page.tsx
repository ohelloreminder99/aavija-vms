'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Shield, Zap, Globe, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AavijaLogo } from '@/components/icons';

const features = [
    "Paperless QR-based Entry",
    "Real-time WhatsApp Alerts",
    "Automated Token Economy",
    "Multi-Role Dashboards",
    "Bank-Level Security",
    "Digital Audit Trails"
];

export default function DemoPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
            {/* Background Ambient Glow */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[120px] rounded-full" />
            </div>

            <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
                <div className="container max-w-7xl h-20 flex items-center justify-between px-6">
                    <Link href="/">
                        <AavijaLogo />
                    </Link>
                    <Button asChild className="bg-white text-black hover:bg-white/90 rounded-full px-6">
                        <Link href="/signup">Get Started</Link>
                    </Button>
                </div>
            </header>

            <main className="relative z-10 pt-32 pb-20">
                <section className="container max-w-7xl px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-semibold mb-8">
                            <Play className="w-3 h-3 fill-current" />
                            <span>Interactive Product Tour</span>
                        </div>

                        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6">
                            Experience the Future of <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-600">Access Management.</span>
                        </h1>

                        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-12 font-light">
                            See how Aavija simplifies security for thousands of premises. From the gate to the host, every step is seamless.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="relative aspect-video max-w-5xl mx-auto rounded-3xl border border-white/10 bg-black/40 overflow-hidden shadow-2xl group"
                    >
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 group-hover:bg-black/40 transition-all cursor-pointer">
                            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.6)] group-hover:scale-110 transition-transform">
                                <Play className="w-8 h-8 fill-white text-white ml-1" />
                            </div>
                        </div>
                        {/* Replace with actual video link if available later, for now a premium placeholder image */}
                        <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-20 opacity-50">
                            <Shield className="w-40 h-40 text-white/5" />
                        </div>
                    </motion.div>

                    <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
                        {features.map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-center gap-3 p-4 rounded-2xl border border-white/5 bg-white/5"
                            >
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                                <span className="font-medium">{feature}</span>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-32 p-12 rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/10 to-transparent">
                        <h2 className="text-3xl font-bold mb-4 text-white">Still have questions?</h2>
                        <p className="text-gray-400 mb-8 max-w-md mx-auto">Talk to a security expert and see how Aavija can fit into your housing society or industrial park.</p>
                        <Button size="lg" className="rounded-full px-10 h-14 bg-blue-600 hover:bg-blue-500 font-bold">
                            Book a Direct Consultation <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </div>
                </section>
            </main>

            <footer className="border-t border-white/5 py-12">
                <div className="container max-w-7xl px-6 flex justify-between items-center">
                    <span className="text-gray-500 text-sm">© {new Date().getFullYear()} Aavija Global</span>
                    <div className="flex gap-6 text-sm text-gray-500">
                        <Link href="/privacy-policy" className="hover:text-white">Privacy</Link>
                        <Link href="/terms-and-conditions" className="hover:text-white">Terms</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
