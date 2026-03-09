'use client'; // Error boundaries must be Client Components

import { ErrorCard } from '@/components/ErrorCard';

export default function GatekeeperErrorBoundary({
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
                title="Gatekeeper Scanner Error"
                description="The check-in scanner encountered a critical issue."
            />
        </div>
    );
}
