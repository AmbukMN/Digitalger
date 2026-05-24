'use client';

import { useReportWebVitals } from 'next/dist/client/web-vitals';

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Web Vitals] ${metric.name}: ${Math.round(metric.value)}ms`);
    }
  });
  return null;
}
