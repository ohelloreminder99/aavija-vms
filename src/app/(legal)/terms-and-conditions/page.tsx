import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function TermsAndConditionsPage() {
    const supabase = await createClient();
    const { data: settings } = await supabase.from('settings').select('*').eq('id', 'global').single();

    const lastUpdated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="container py-12 md:py-16">
            <Card className="max-w-4xl mx-auto shadow-lg border-primary/10">
                <CardHeader className="border-b bg-muted/30">
                    <CardTitle className="text-3xl font-bold tracking-tight">Terms and Conditions</CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
                </CardHeader>
                <CardContent className="space-y-8 py-8">

                    <Alert variant="destructive" className="bg-destructive/5 text-destructive border-destructive/20">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle className="font-bold">Important Notice</AlertTitle>
                        <AlertDescription>
                            Please read these terms carefully. They contain important information about your legal rights, including a <strong>No-Refund Policy</strong> and <strong>Limitation of Liability</strong>.
                        </AlertDescription>
                    </Alert>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-primary">1. Agreement to Terms</h2>
                        <p className="leading-relaxed">
                            By accessing or using the Aavija platform (the "Service") provided by {settings?.legal_entity_name || '99 Interactive Services'}, you agree to be bound by these Terms and Conditions. If you do not agree to all of these terms, you are prohibited from using the Service.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-primary">2. User Accounts & Security</h2>
                        <p className="leading-relaxed">
                            Users are responsible for maintaining the confidentiality of their account credentials. You agree to:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Provide accurate, current, and complete information during registration.</li>
                            <li>Immediately notify us of any unauthorized use of your account.</li>
                            <li>Be solely responsible for all activities that occur under your account.</li>
                            <li>Ensure that your use of the Service complies with all local laws and regulations in India.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-primary">3. Token Purchases & Usage</h2>
                        <p className="leading-relaxed">
                            The Service operates on a virtual token system. By purchasing tokens, you acknowledge and agree to the following:
                        </p>
                        <div className="bg-muted p-4 rounded-lg border space-y-4">
                            <p><strong>A. NO REFUNDS:</strong> All token purchases are final. We do not offer refunds, credits, or exchanges under any circumstances, including but not limited to: account termination, unused tokens, technical glitches, or dissatisfaction with the Service.</p>
                            <p><strong>B. NO TRANSFERS:</strong> Tokens are strictly tied to the account through which they were purchased. Transferring tokens to another user account or premise account is technically prohibited and contractually unauthorized.</p>
                            <p><strong>C. NO MONETARY VALUE:</strong> Tokens are a license to access specific features of the Aavija ecosystem. They do not constitute a currency, have no cash value, and cannot be redeemed for legal tender.</p>
                            <p><strong>D. GST COMPLIANCE:</strong> Users must provide valid GST details before purchase. We cannot modify invoices once issued.</p>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-primary">4. Code of Conduct</h2>
                        <p className="leading-relaxed">
                            You shall not:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Input false visitor data or impersonate others.</li>
                            <li>Attempt to circumvent security measures or access restricted data.</li>
                            <li>Use the platform for any illegal activities or to harass premise staff.</li>
                            <li>Extract data from the platform for commercial use without prior written consent.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-primary">5. Limitation of Liability</h2>
                        <p className="leading-relaxed">
                            To the maximum extent permitted by Indian Law, {settings?.legal_entity_name || '99 Interactive Services'} shall not be liable for:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Any incident, injury, or loss occurring at a premise after a check-in facilitated by Aavija.</li>
                            <li>Direct or indirect damages resulting from service interruptions or data breaches.</li>
                            <li>Mistakes or delays in WhatsApp/SMS notifications caused by third-party networks.</li>
                            <li>Decisions made by premise owners to block or deny entry to any user.</li>
                        </ul>
                        <p className="font-semibold mt-4">Our total liability for any claim arising out of these terms shall not exceed the amount paid by you for tokens in the 3 months preceding the claim.</p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-primary">6. Indemnification</h2>
                        <p className="leading-relaxed">
                            You agree to defend, indemnify, and hold harmless {settings?.legal_entity_name || '99 Interactive Services'}, its employees, and directors from and against any claims, damages, or legal costs (including attorney fees) arising from your misuse of the platform or violation of these terms.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-primary">7. Modifications to Service</h2>
                        <p className="leading-relaxed">
                            We reserve the right to modify, suspend, or discontinue any part of the Service or the Token System at any time. We will provide 30 days' notice for significant changes to these terms via the dashboard or email.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-primary">8. Governing Law & Dispute Resolution</h2>
                        <p className="leading-relaxed">
                            These terms are governed by the laws of <strong>India</strong>. Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts located in <strong>{settings?.legal_jurisdiction_city || 'Surat, Gujarat, India'}</strong>.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-primary">9. Contact</h2>
                        <p className="leading-relaxed">
                            For legal inquiries, please contact <a href={`mailto:${settings?.legal_email || 'legal@99interactive.com'}`} className="text-primary hover:underline">{settings?.legal_email || 'legal@99interactive.com'}</a> or visit our contact page.
                        </p>
                    </section>
                </CardContent>
            </Card>
        </div>
    );
}
