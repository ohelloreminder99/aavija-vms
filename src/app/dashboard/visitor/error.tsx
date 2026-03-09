'use client'; // Error boundaries must be Client Components

import { ErrorCard } from '@/components/ErrorCard';

export default function VisitorErrorBoundary({
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
                title="Visitor Dashboard Error"
                description="We couldn't load your passes or history right now."
            />
        </div>
    );
}
