'use client';

import React, { useEffect, useState } from 'react';
import { GlobalPortal } from '@/components/landing/GlobalPortal';
import { RegionalHomepageV2 } from '@/components/landing/RegionalHomepageV2';

export default function Home() {
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHostname(window.location.hostname);
    }
  }, []);

  // If we haven't detected the hostname yet, show a loading state or default to Portal
  if (hostname === null) {
    return <div className="min-h-screen bg-[#010a05]" />;
  }

  // Logic: 
  // 1. If hostname is 'india.aavija.com' or localhost (for development), show the VMS app landing page.
  // 2. Otherwise (root aavija.com), show the Global Portal.

  const isIndiaSubdomain = hostname.includes('india.') || hostname === 'localhost' || hostname === '127.0.0.1';

  if (isIndiaSubdomain) {
    return <RegionalHomepageV2 />;
  }

  return <GlobalPortal />;
}

