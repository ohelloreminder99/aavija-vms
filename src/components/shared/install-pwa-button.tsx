'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/use-pwa-install';

export function InstallPwaButton() {
  const { canInstall, installPwa } = usePwaInstall();

  if (!canInstall) {
    return null;
  }

  return (
    <Button variant="outline" className="text-white border-white/10 hover:bg-white/5" onClick={installPwa}>
      <Download className="mr-2 h-4 w-4" />
      Install App
    </Button>
  );
}
