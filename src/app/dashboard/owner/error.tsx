'use client'; // Error boundaries must be Client Components

import { ErrorCard } from '@/components/ErrorCard';

export default function OwnerErrorBoundary({
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
                title="Owner Dashboard Error"
                description="Failed to load your premise data. Please try again."
            />
        </div>
    );
}
