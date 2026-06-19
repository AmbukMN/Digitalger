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
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        {/* Breadcrumb — банер дотор, эсрэг өнгөтэй (бүдэг) */}
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-primary-foreground/70">
          <Link href="/" className="transition-colors hover:text-primary-foreground">
            Нүүр
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-primary-foreground">{breadcrumb ?? title}</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
        {/* Гарчгийн доорх онцлох зураас — эсрэг өнгөөр (secondary gold light, navy dark) */}
        <div className="mt-3 h-1 w-16 rounded-full bg-secondary" />
      </div>
    </div>
  );
}
