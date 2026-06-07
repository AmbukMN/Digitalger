'use client';

// Admin root layout error boundary. RootLayout өөрөө унавал энэ ажиллана.
// Layout-ыг бүхэлд нь орлох тул <html>/<body>-г ӨӨРӨӨ render хийнэ.
// CSS ачаалагдаагүй байж болзошгүй тул inline style ашиглана.
import { useEffect } from 'react';

export default function AdminGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO(Sentry): DSN тохируулсан үед энд captureException(error) нэмнэ.
    console.error('[admin/global-error]', error);
  }, [error]);

  return (
    <html lang="mn">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#022179',
          color: '#ffffff',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 440 }}>
          <div
            style={{
              fontSize: 48,
              lineHeight: 1,
              marginBottom: 20,
              color: '#ffbe00',
            }}
            aria-hidden
          >
            &#9888;
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px' }}>
            Системд алдаа гарлаа
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              opacity: 0.85,
              margin: '0 0 24px',
            }}
          >
            Админ системд гэнэтийн алдаа гарсан тул хуудсыг харуулах боломжгүй
            боллоо. Дахин оролдоно уу.
          </p>
          <button
            onClick={reset}
            style={{
              cursor: 'pointer',
              border: 'none',
              borderRadius: 10,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: '#ffbe00',
              color: '#022179',
            }}
          >
            Дахин ачаалах
          </button>
        </div>
      </body>
    </html>
  );
}
