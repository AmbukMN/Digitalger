'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { ThemeProvider } from '@digitalger/shared/ui';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
  );

  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider storageKey="digitalger-admin-theme">
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
