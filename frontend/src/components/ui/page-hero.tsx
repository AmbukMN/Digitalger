import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/**
 * Статик хуудсуудын (Бид, Үйлчилгээний нөхцөл, Нууцлал, Мэдээлэл устгах, Холбоо барих)
 * дээд талын full-width primary өнгийн hero banner. Гарчиг эсрэг (цагаан/харанхуй)
 * өнгөтэй, breadcrumb банер дотор. Light: navy bg + цагаан текст; Dark: gold bg +
 * харанхуй текст (bg-primary / text-primary-foreground автомат хөрвөнө).
 * ⚠️ Зөвхөн "цулгай" статик хуудсанд ашиглана (PageHeader-ийг бусдад хэвээр).
 */
export function PageHero({ title, breadcrumb }: { title: string; breadcrumb?: string }) {
  return (
    <div className="w-full bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {/* Breadcrumb — банер дотор, эсрэг өнгөтэй (бүдэг) */}
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-primary-foreground/70">
          <Link href="/" className="transition-colors hover:text-primary-foreground">
            Нүүр
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-primary-foreground">{breadcrumb ?? title}</span>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {/* Гарчгийн доорх онцлох зураас — эсрэг өнгөөр (secondary gold light, navy dark) */}
        <div className="mt-2 h-1 w-14 rounded-full bg-secondary" />
      </div>
    </div>
  );
}
