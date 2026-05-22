import Link from 'next/link';
import { SITE_NAME } from '@/lib/constants';

export function SiteFooter() {
  return (
    <footer className="bg-muted/30" style={{ borderTop: '2px solid oklch(0.847 0.178 85.87)' }}>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {SITE_NAME}. Бүх эрх хуулиар хамгаалагдсан.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Нууцлалын бодлого
            </Link>
            <Link href="/terms-of-use" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Үйлчилгээний нөхцөл
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
