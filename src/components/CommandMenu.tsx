'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    Search,
    Home,
    Shield,
    Users,
    History as HistoryIcon,
    LayoutDashboard
} from 'lucide-react';

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from 'cmdk';

// We'll define a simple wrapper since we don't have the full shadcn/ui command yet
// but we want it to look good.

export function CommandMenu() {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = React.useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
            >
                <Search className="w-4 h-4" />
                <span>Search...</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            {open && (
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[10vh] p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center border-b border-white/10 px-4">
                            <Search className="w-4 h-4 text-gray-400 mr-3" />
                            <input
                                autoFocus
                                placeholder="Type a command or search..."
                                className="flex-1 h-14 bg-transparent outline-none text-white text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') setOpen(false);
                                }}
                            />
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
                            <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Navigation</div>
                            <CommandItem_ custom onClick={() => runCommand(() => router.push('/dashboard/owner'))}>
                                <LayoutDashboard className="w-4 h-4 mr-2" />
                                <span>Owner Dashboard</span>
                            </CommandItem_>
                            <CommandItem_ custom onClick={() => runCommand(() => router.push('/dashboard/owner/history'))}>
                                <HistoryIcon className="w-4 h-4 mr-2" />
                                <span>Visit History</span>
                            </CommandItem_>
                            <CommandItem_ custom onClick={() => runCommand(() => router.push('/dashboard/owner/gatekeepers'))}>
                                <Shield className="w-4 h-4 mr-2" />
                                <span>Manage Gatekeepers</span>
                            </CommandItem_>
                            <CommandItem_ custom onClick={() => runCommand(() => router.push('/dashboard/owner/hosts'))}>
                                <Users className="w-4 h-4 mr-2" />
                                <span>Manage Hosts</span>
                            </CommandItem_>

                            <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Settings</div>
                            <CommandItem_ custom onClick={() => runCommand(() => router.push('/dashboard/owner/gst-details'))}>
                                <Settings className="w-4 h-4 mr-2" />
                                <span>Billing & Settings</span>
                            </CommandItem_>
                        </div>
                        <div className="bg-white/[0.02] p-3 text-[10px] text-gray-500 border-t border-white/5 flex gap-4">
                            <span><kbd className="bg-white/5 px-1 rounded">↑↓</kbd> to navigate</span>
                            <span><kbd className="bg-white/5 px-1 rounded">Enter</kbd> to select</span>
                            <span><kbd className="bg-white/5 px-1 rounded">Esc</kbd> to close</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function CommandItem_({ children, onClick }: { children: React.ReactNode, onClick: () => void, custom?: boolean }) {
    return (
        <div
            onClick={onClick}
            className="flex items-center px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors text-sm text-gray-300 hover:text-white group"
        >
            {children}
            <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}

function ChevronRight(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}
