'use client'; // Error boundaries must be Client Components

import { ErrorCard } from '@/components/ErrorCard';

export default function HostErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <ErrorCard
                error={error}
                reset={reset}
                title="Host Dashboard Error"
                description="A problem occurred while loading your visitor logs or invites."
            />
        </div>
    );
}
