'use client';

import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
    QrCode,
    ShieldCheck,
    Zap,
    Smartphone,
    Building2,
    ArrowRight,
    ChevronRight,
    Star,
    MessageSquareText,
    LayoutDashboard,
    ClipboardCheck,
    Coins
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { AavijaLogo } from '@/components/icons';
import { useSettings } from '@/services/settings-service';

const defaultFeatures = [
    {
        title: 'Seamless Check-in',
        description: 'Visitors generate a secure QR code for instant, paperless entry. Gatekeepers scan and verify in seconds.',
        icon: 'QrCode',
    },
    {
        title: 'WhatsApp Notifications',
        description: 'Hosts are immediately notified via WhatsApp the moment their visitor arrives at the gate.',
        icon: 'MessageSquareText',
    },
    {
        title: 'Sovereign Security',
        description: 'Military-grade encryption and regional data proxying ensure your records are always safe and accessible.',
        icon: 'ShieldCheck',
    },
    {
        title: 'Token Economy',
        description: 'Pay-as-you-use efficiency. Ideal for everything from single-gate shops to multi-gate industrial parks.',
        icon: 'Coins',
    },
    {
        title: 'Privacy-First QR',
        description: 'Anonymous QR tokens protect PII. No names or phone numbers are exposed until authorized.',
        icon: 'QrCode',
    },
    {
        title: 'Immutable Audit Trail',
        description: 'Once a visitor is checked in, the log is permanent and unchangeable. Full accountability at your fingertips.',
        icon: 'ClipboardCheck',
    }
];


const pricingTiers = [
    {
        name: "Professional",
        price: "Pay as you use",
        description: "Zero monthly commitment. Everything unlimited. Only pay for what you actually use.",
        features: [
            "Unlimited QR Generations",
            "Unlimited Gatekeepers",
            "Unlimited Resident Profiles",
            "Everything Unlimited",
            "WhatsApp Alerts Included",
            "Advanced Analytics & Exports",
            "Military-grade Security"
        ],
        cta: "Start Your Free Setup",
        highlight: true
    }
];

const GlowingCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div className={`relative group ${className}`}>
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
        <div className="relative bg-black border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
            {children}
        </div>
    </div>
);

export function RegionalHomepageV2() {
    const { data: settings, isLoading } = useSettings();
    const { scrollYProgress } = useScroll();
    const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

    const heroTitle = settings?.landing_hero_title || 'Simple, Safe & Secure Access.';
    const heroSubtitle = settings?.landing_hero_subtitle || 'Eliminate paper logs. Aavija provides a seamless, smart way to manage visitors, owners, and staff with real-time verification and military-grade security.';
    const ctaPrimary = settings?.landing_cta_primary || 'Setup Your Premise Free';
    const ctaSecondary = settings?.landing_cta_secondary || 'Watch Product Tour';
    const dynamicFeatures = settings?.landing_features || defaultFeatures;

    const iconMap: Record<string, any> = {
        QrCode, MessageSquareText, ShieldCheck, Coins, LayoutDashboard, ClipboardCheck
    };

    if (isLoading) {
        return <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>;
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-blue-500/30">
            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[30rem] h-[30rem] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[20%] right-[10%] w-[25rem] h-[25rem] bg-indigo-900/10 blur-[120px] rounded-full" />
            </div>

            {/* Nav */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl transition-colors">
                <div className="container max-w-7xl h-20 flex items-center justify-between px-6">
                    <AavijaLogo />
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                        <Link href="#features" className="hover:text-white transition-colors">Features</Link>
                        <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" asChild className="text-gray-300 hover:text-white">
                            <Link href="/login">Sign In</Link>
                        </Button>
                        <Button className="bg-white text-black hover:bg-white/90 rounded-full px-6">
                            <Link href="/signup">Get Started</Link>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="relative z-10 pt-32 pb-20">
                {/* Hero Section */}
                <section className="container max-w-7xl px-6 flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        style={{ opacity, scale }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-semibold mb-8">
                            <Zap className="w-3 h-3" />
                            <span>Next-Gen Visitor Management for India</span>
                        </div>

                        <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-8 leading-[1.1]">
                            {heroTitle.split(' ').slice(0, -1).join(' ')} <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-600">
                                {heroTitle.split(' ').slice(-1)}
                            </span>
                        </h1>

                        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-light leading-relaxed">
                            {heroSubtitle}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Button size="lg" className="h-14 px-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white border-blue-400/50 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                                <Link href="/signup" className="flex items-center gap-2 text-lg">
                                    {ctaPrimary} <ArrowRight className="w-5 h-5" />
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" className="h-14 px-8 rounded-full border-white/10 hover:bg-white/5 bg-transparent" asChild>
                                <Link href="/signup" className="text-lg">{ctaSecondary}</Link>
                            </Button>
                        </div>
                    </motion.div>

                    {/* Hero Image / UI Mockup */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-24 w-full max-w-6xl relative"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-[2.5rem] blur-2xl opacity-50" />
                        <div className="relative rounded-[2rem] border border-white/10 bg-black/40 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                            <div className="aspect-[21/9] w-full relative group">
                                <Image
                                    src="/hero-mockup.png"
                                    alt="Aavija Dashboard Preview"
                                    fill
                                    className="object-cover opacity-80 group-hover:scale-105 transition-transform duration-[2s]"
                                    priority
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-60" />

                                {/* Overlay Floating Badges for 'Complete' feel */}
                                <div className="absolute top-6 left-6 flex gap-3">
                                    <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md text-[10px] uppercase font-bold text-blue-400">
                                        Production Ready 9.0
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 backdrop-blur-md text-[10px] uppercase font-bold text-green-400">
                                        Encrypted
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Shadow Floor */}
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-20 bg-blue-600/10 blur-3xl rounded-full" />
                    </motion.div>
                </section>

                {/* Features Grid */}
                <section id="features" className="container max-w-7xl px-6 py-40">
                    <div id="security" className="absolute -top-40" />
                    <div className="text-center mb-24">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Built for Trust at Every Layer</h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto font-light">
                            From high-rise apartments to corporate industrial parks, Aavija adapts to your security protocol.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {(dynamicFeatures as any[]).map((feature, index) => {
                            const Icon = iconMap[feature.icon] || Zap;
                            return (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                    className="group p-8 rounded-3xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300"
                                >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-blue-500/10 text-blue-400 border border-blue-500/20`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed font-light">
                                        {feature.description}
                                    </p>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>


                {/* Pricing Grid */}
                <section id="pricing" className="container max-w-7xl px-6 py-40">
                    <div className="text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Pay Only For Use</h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto font-light">
                            Aavija operates on a professional token economy. You pay for what you use. If you don't use it for the whole month, there are zero charges. Seamless scaling for any premise.
                        </p>
                    </div>

                    <div className="flex justify-center">
                        <div className="grid grid-cols-1 md:grid-cols-1 max-w-md w-full gap-8">
                        {pricingTiers.map((tier, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className={`relative p-8 rounded-3xl border transition-all duration-300 ${tier.highlight
                                    ? 'border-blue-500/50 bg-blue-500/5 scale-105 shadow-[0_0_40px_rgba(37,99,235,0.1)]'
                                    : 'border-white/5 bg-white/5 hover:border-white/10'
                                    }`}
                            >
                                {tier.highlight && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-blue-500 text-[10px] font-bold uppercase tracking-wider">
                                        Most Popular
                                    </div>
                                )}
                                <div className="mb-8">
                                    <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-bold tracking-tight">{tier.price}</span>
                                        {/* @ts-ignore */}
                                        {tier.period && <span className="text-gray-500 text-sm">{tier.period}</span>}
                                    </div>
                                    <p className="text-gray-500 text-sm mt-4 font-light">{tier.description}</p>
                                </div>
                                <ul className="space-y-4 mb-8">
                                    {tier.features.map((f, j) => (
                                        <li key={j} className="flex items-center gap-3 text-sm text-gray-400">
                                            <ShieldCheck className="w-4 h-4 text-blue-400" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <Button
                                    className={`w-full rounded-2xl h-12 font-bold ${tier.highlight
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                        : 'bg-white/10 hover:bg-white/20 text-white'
                                        }`}
                                >
                                    {tier.cta}
                                </Button>
                            </motion.div>
                        ))}
                    </div>
                    </div>
                </section>

                {/* Call to Action */}
                <section className="container max-w-5xl px-6 py-20">
                    <div className="relative p-12 md:p-20 rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/20 to-indigo-900/20 text-center overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Building2 className="w-48 h-48" />
                        </div>

                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to digitize your gate?</h2>
                        <p className="text-gray-300 text-lg mb-10 max-w-xl mx-auto font-light">
                            Join hundreds of premises that have upgraded to a smarter, safer way to manage access.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" className="rounded-full px-10 h-14 bg-white text-black hover:bg-white/90 font-bold text-lg" asChild>
                                <Link href="/signup">Create Free Account</Link>
                            </Button>
                            <Button size="lg" variant="ghost" className="rounded-full px-10 h-14 text-white hover:bg-white/5 border border-white/10" asChild>
                                <Link href="/contact">Contact Sales</Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-white/5 py-12">
                <div className="container max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2">
                        <AavijaLogo />
                        <span className="text-xs text-gray-500 ml-4">© {new Date().getFullYear()} Regional India Hub</span>
                    </div>
                    <div className="flex gap-8 text-sm text-gray-500">
                        <Link href="/privacy-policy" className="hover:text-white">Privacy</Link>
                        <Link href="/terms-and-conditions" className="hover:text-white">Terms</Link>
                        <Link href="/contact" className="hover:text-white">Contact</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
