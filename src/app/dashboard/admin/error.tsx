'use client'; // Error boundaries must be Client Components

import { ErrorCard } from '@/components/ErrorCard';

export default function AdminErrorBoundary({
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
                title="Admin Dashboard Error"
                description="We encountered a problem loading the administration console."
            />
        </div>
    );
}
