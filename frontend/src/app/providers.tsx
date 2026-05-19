'use client';

import { ThemeProvider } from '@digitalger/shared/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
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
        <ThemeProvider defaultTheme="system">
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
