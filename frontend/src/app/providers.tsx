'use client';

import { ThemeProvider } from '@digitalger/shared/ui';
import type { Theme } from '@digitalger/shared/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: React.ReactNode;
  /** Server-fetched default theme from admin settings (system / light / dark) */
  defaultTheme?: Theme;
}

export function Providers({ children, defaultTheme = 'system' }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme={defaultTheme} storageKey="digitalger-theme">
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
