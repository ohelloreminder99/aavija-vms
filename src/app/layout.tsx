import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { SupabaseClientProvider } from '@/supabase';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { I18nProvider } from '@/i18n/LanguageContext';

export const metadata: Metadata = {
  title: {
    default: 'Aavija | Secure Cloud Visitor Management System (VMS)',
    template: '%s | Aavija VMS',
  },
  description: 'The ultimate QR-based Visitor Management App for corporate premises, gated communities, and enterprise security. Real-time check-ins, E-Gatepasses, and deep analytics.',
  keywords: [
    'Visitor Management App',
    'VMS Software',
    'Digital Gatepass',
    'QR Check-in System',
    'Premise Security',
    'Corporate Visitor Tracking',
    'Gatekeeper App',
    'Aavija',
  ],
  authors: [{ name: 'Aavija Team' }],
  creator: 'Aavija',
  publisher: 'Aavija',
  manifest: '/manifest.json',
  applicationName: 'Aavija VMS',
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://aavija.com',
    title: 'Aavija | Secure Cloud Visitor Management System (VMS)',
    description: 'Transform your premise security with lightning-fast QR check-ins and live active visitor tracking.',
    siteName: 'Aavija VMS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aavija | Modern Visitor Management System',
    description: 'Lightning-fast QR check-ins, E-Gatepasses, and real-time security tracking.',
  },
  icons: {
    icon: {
      url: '/icon.png',
      type: 'image/png',
      sizes: '32x32',
    },
    apple: {
      url: '/apple-icon.png',
      sizes: '180x180',
      type: 'image/png',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Source+Code+Pro&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn('font-body antialiased min-h-screen bg-background')}>
        <SupabaseClientProvider>
          <I18nProvider>
            {children}
          </I18nProvider>
        </SupabaseClientProvider>
        <Toaster />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

