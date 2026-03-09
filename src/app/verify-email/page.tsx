import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30">
            <Card className="w-full max-w-md shadow-lg border-primary/20">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
                        <MailCheck className="h-10 w-10 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                    <CardDescription className="text-base mt-2">
                        We've sent a verification link to your email address.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground pt-4 pb-6 space-y-4">
                    <p>
                        Please click the link in that email to activate your account and access the dashboard.
                    </p>
                    <div className="bg-muted p-4 rounded-md text-left mt-4 border">
                        <p className="font-medium text-foreground mb-1">Didn't receive the email?</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Check your spam or junk folder.</li>
                            <li>Verify that you entered the correct email address during signup.</li>
                        </ul>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button asChild className="w-full group">
                        <Link href="/login">
                            Return to Login
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
