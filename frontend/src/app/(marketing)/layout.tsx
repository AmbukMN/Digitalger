import { SiteFooter } from '@/components/layout/site-footer';
import { SiteNavbar } from '@/components/layout/site-navbar';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
  <>
      <SiteNavbar />
      <main className="min-h-[calc(100dvh-8rem)] pt-16">{children}</main>
      <SiteFooter />
    </>
  );
}
