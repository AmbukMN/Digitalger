'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { ThemeProvider } from '@digitalger/shared/ui';
import type { Theme } from '@digitalger/shared/ui';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function Providers({ children, defaultTheme = 'system' }: ProvidersProps) {
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
        <ThemeProvider defaultTheme={defaultTheme} storageKey="digitalger-admin-theme">
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
