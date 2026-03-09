import { AavijaLogo } from "@/components/icons";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LegalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col bg-muted/20">
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 max-w-7xl items-center justify-between">
                    <Link href="/">
                        <AavijaLogo />
                    </Link>
                    <Button asChild>
                        <Link href="/login">Go to App</Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1">
                {children}
            </main>
            <footer className="border-t bg-background">
                <div className="container flex flex-col items-center justify-center gap-4 py-8 md:h-24 md:flex-row md:py-0">
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                        &copy; {new Date().getFullYear()} Aavija (by 99 Interactive Services). All rights reserved.
                    </p>
                    <nav className="flex gap-4 sm:gap-6 md:ml-auto">
                        <Link href="/terms-and-conditions" className="text-sm text-muted-foreground hover:text-primary">
                            Terms
                        </Link>
                        <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary">
                            Privacy
                        </Link>
                        <Link href="/contact" className="text-sm text-muted-foreground hover:text-primary">
                            Contact
                        </Link>
                    </nav>
                </div>
            </footer>
        </div>
    );
}
