import { AdminShell } from '@/components/layout/admin-shell';

// ⚠️ Энгийн wrapper — server-side fetch ХИЙХГҮЙ. Өмнө нь layout-д server-side
// profile+permission татдаг байсан нь Next.js layout navigation бүрд дахин ажилладаг
// тул хуудас солих БҮРД 2 fetch хүлээж УДААШРАЛ үүсгэж байв. AdminShell нь client
// query (localStorage кэштэй) дээр ажиллана — navigation шуурхай, анивчилтыг кэш зөөлрүүлнэ.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
