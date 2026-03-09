'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface ErrorCardProps {
    error: Error & { digest?: string };
    reset: () => void;
    title?: string;
    description?: string;
}

export function ErrorCard({
    error,
    reset,
    title = "Something went wrong",
    description = "An unexpected error occurred while loading this page."
}: ErrorCardProps) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Captured by Next.js Error Boundary:', error);
    }, [error]);

    return (
        <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center p-4">
            <Card className="max-w-md w-full shadow-lg border-destructive/20">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="text-xl">{title}</CardTitle>
                    <CardDescription className="mt-2 text-sm">
                        {description}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center pb-6">
                    <div className="mt-2 rounded-md bg-muted p-3 text-left">
                        <p className="text-xs font-mono text-muted-foreground break-words overflow-auto max-h-32">
                            {error.message || "Unknown error details"}
                            {error.digest && <span className="block mt-1">Digest: {error.digest}</span>}
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-between w-full">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => reset()}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Try Again
                    </Button>
                    <Button asChild className="w-full sm:w-auto mt-2 sm:mt-0">
                        <Link href="/dashboard">
                            <Home className="mr-2 h-4 w-4" />
                            Return Home
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
