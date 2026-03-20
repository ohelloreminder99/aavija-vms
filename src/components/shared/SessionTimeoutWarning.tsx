'use client';

/**
 * AAVIJA VMS — Session Timeout Warning
 * Shows a toast 5 minutes before the Supabase JWT expires.
 * Mount this in the root layout or any authenticated layout.
 *
 * Usage:
 *   <SessionTimeoutWarning />
 */

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

const WARNING_BEFORE_MS = 5 * 60 * 1000; // warn 5 minutes before expiry
const CHECK_INTERVAL_MS = 60 * 1000;     // check every 60 seconds

export function SessionTimeoutWarning() {
  const { toast } = useToast();
  const warnedRef = React.useRef(false);

  React.useEffect(() => {
    const supabase = createClient();

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const expiresAt  = session.expires_at! * 1000; // convert s → ms
      const now        = Date.now();
      const msLeft     = expiresAt - now;

      if (msLeft > 0 && msLeft <= WARNING_BEFORE_MS && !warnedRef.current) {
        warnedRef.current = true;
        const minutesLeft = Math.max(1, Math.round(msLeft / 60000));

        toast({
          title: `⏱️ Session expiring in ${minutesLeft} min`,
          description: 'Click anywhere on the page or refresh to stay logged in.',
          duration: 30_000, // show for 30s
        });
      }

      // Reset warned flag once session is refreshed and well away from expiry
      if (msLeft > WARNING_BEFORE_MS * 2) {
        warnedRef.current = false;
      }
    };

    // Run immediately, then on interval
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [toast]);

  return null; // renders nothing — side-effect only
}
