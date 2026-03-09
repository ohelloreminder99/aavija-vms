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
        <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
            <footer className="border-t">
                <div className="container flex flex-col items-center justify-center h-24 gap-4">
                    <nav className="flex gap-4 text-sm text-muted-foreground sm:gap-6">
                        <Link href="/terms-and-conditions" className="hover:text-primary">
                            Terms
                        </Link>
                        <Link href="/privacy-policy" className="hover:text-primary">
                            Privacy
                        </Link>
                        <Link href="/contact" className="hover:text-primary">
                            Contact
                        </Link>
                    </nav>
                     <p className="text-xs text-muted-foreground">
                        &copy; {new Date().getFullYear()} Aavija (by 99 Interactive Services). All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
