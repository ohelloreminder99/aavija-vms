import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

export default async function PrivacyPolicyPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 'global').single();

  const lastUpdated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="container py-12 md:py-16">
      <Card className="max-w-4xl mx-auto shadow-lg border-primary/10">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-3xl font-bold tracking-tight">Privacy Policy</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
        </CardHeader>
        <CardContent className="space-y-8 py-8">

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-primary">1. Introduction</h2>
            <p className="leading-relaxed">
              Welcome to <strong>Aavija</strong> (operated by <strong>{settings?.legal_entity_name || '99 Interactive Services'}</strong>, hereinafter "we," "our," "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy is formulated in compliance with the Information Technology Act, 2000, and the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> of India.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-primary">2. Information We Collect</h2>
            <p className="leading-relaxed">
              We collect information that allows us to provide a secure and efficient Visitor Management System (VMS). This includes:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Personal Identifiable Information (PII):</strong> Name, phone number, email address, and company name provided during registration.</li>
              <li><strong>Sensitive Personal Data or Information (SPDI):</strong> We may collect biometric data (if enabled by the premise for facial recognition), passwords, and financial information for token purchases (processed via secure third-party gateways).</li>
              <li><strong>Usage Data:</strong> Log data of check-ins, check-outs, and premises visited.</li>
              <li><strong>Device Info:</strong> IP address, browser type, and operating system for security monitoring.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-primary">3. Purpose of Data Processing</h2>
            <p className="leading-relaxed">
              In accordance with the principle of "Purpose Limitation," we process your data for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Facilitating secure entry and exit at registered premises.</li>
              <li>Real-time notifications to hosts via WhatsApp or SMS.</li>
              <li>Maintaining a digital audit trail for security and incident management.</li>
              <li>Verifying user identity and preventing unauthorized access.</li>
              <li>Complying with legal obligations under Indian law.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-primary">4. Data Sharing and Disclosure</h2>
            <p className="leading-relaxed">
              We do not sell your data. We share information only in the following scenarios:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Premise Security:</strong> Your name and photo are visible to the gatekeeper and the host you are visiting.</li>
              <li><strong>Service Providers:</strong> Sharing data with payment gateways or communication providers (like WhatsApp API) to fulfill service requests.</li>
              <li><strong>Legal Requirements:</strong> Disclosing information to law enforcement or regulatory bodies if mandated by a court order or applicable law.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-primary">5. User Rights (Data Principal Rights)</h2>
            <p className="leading-relaxed">
              Under the DPDP Act 2023, you have the following rights:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Right to Access:</strong> See what data we hold about you.</li>
              <li><strong>Right to Correction:</strong> Update inaccurate or incomplete data via your profile dashboard.</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your data when it is no longer needed for the specified purpose (subject to legal retention requirements).</li>
              <li><strong>Right to Withdraw Consent:</strong> You may withdraw your consent for data processing at any time, though this may limit your access to certain premises.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-primary">6. Data Security</h2>
            <p className="leading-relaxed">
              We implement "Reasonable Security Practices and Procedures" including end-to-end encryption for sensitive data, secure API endpoints, and regular security audits to protect against unauthorized access or data breaches.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-primary">7. Data Retention</h2>
            <p className="leading-relaxed">
              We retain visitor logs for a period deemed necessary by the Premise Owners for their security requirements, typically not exceeding 180 days unless specifically requested by law enforcement or agreed upon in commercial terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-primary">8. Grievance Redressal</h2>
            <p className="leading-relaxed">
              If you have any concerns or complaints regarding your privacy or data usage, you may reach out to our Grievance Officer:
            </p>
            <div className="bg-muted p-4 rounded-lg border">
              <p><strong>Grievance Officer:</strong> {settings?.legal_grievance_officer || '[Name/Legal Dept]'}</p>
              <p><strong>Entity:</strong> {settings?.legal_entity_name || '99 Interactive Services'}</p>
              <p><strong>Email:</strong> {settings?.legal_support_email || 'support@99interactive.com'}</p>
              <p><strong>Address:</strong> {settings?.legal_address || '[Your Registered Address, Surat, Gujarat, India]'}</p>
            </div>
            <p className="text-sm italic">
              Complaints will be acknowledged within 24 hours and resolved within the timelines prescribed by the IT Act.
            </p>
          </section>

        </CardContent>
      </Card>
    </div>
  );
}
