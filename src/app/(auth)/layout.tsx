'use client';

import { AavijaLogo } from "@/components/icons";
import { InstallPwaButton } from "@/components/shared/install-pwa-button";
import Link from "next/link";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    return (
        <div className="flex min-h-screen flex-col bg-[#010a05]">
            <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/50 backdrop-blur-xl transition-colors">
                <div className="container flex h-16 max-w-7xl items-center justify-between">
                    <Link href="/">
                        <AavijaLogo />
                    </Link>
                    <InstallPwaButton />
                </div>
            </header>
            <main className="flex flex-1 items-center justify-center py-12">
                <div className="w-full max-w-md px-4">{children}</div>
            </main>
            <footer className="border-t border-white/5">
                <div className="container flex flex-col items-center justify-center h-24 gap-4">
                    <nav className="flex gap-4 text-sm text-gray-400 sm:gap-6">
                        <Link href="/terms-and-conditions" className="hover:text-white">
                            Terms
                        </Link>
                        <Link href="/privacy-policy" className="hover:text-white">
                            Privacy
                        </Link>
                        <Link href="/contact" className="hover:text-white">
                            Contact
                        </Link>
                    </nav>
                     <p className="text-xs text-gray-500">
                        &copy; {new Date().getFullYear()} Aavija (by 99 Interactive Services). All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
