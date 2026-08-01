'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UiProvider } from '@besttv/shared/ui';
import { useAdminAuth } from '@/lib/auth-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const init = useAdminAuth((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <QueryClientProvider client={client}>
      {/* Toast + confirm/prompt модалыг нэг дор — window.confirm/alert ХЭРЭГЛЭХГҮЙ */}
      <UiProvider theme="dark">{children}</UiProvider>
    </QueryClientProvider>
  );
}
