'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Award, ExternalLink, GraduationCap, Printer } from 'lucide-react';
import { Button, EmptyState, Loading } from '@digitalger/shared/ui';
import { coursesApi, type MyCertificate } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';

const PAGE_SIZE = 6;

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function CertificateCard({ cert, index }: { cert: MyCertificate; index: number }) {
  // "Сертификат харах" — viewUrl-ийг шинэ tab-д нээнэ
  const openView = () => {
    window.open(cert.viewUrl, '_blank', 'noopener,noreferrer');
  };

  // "PDF татах/Хэвлэх" — public HTML сертификатыг шинэ tab-д нээж, ачаалмагц
  // хэвлэх цонх дуудна (хэрэглэгч PDF болгож хадгалах боломжтой). Cross-origin
  // tab дотор шууд print() дуудах боломжгүй тул сертификат хуудас өөрөө
  // ?print=1 байвал print хийдэг бол ажиллана; эс бөгөөс хэрэглэгч Ctrl+P дарна.
  const openPrint = () => {
    const sep = cert.viewUrl.includes('?') ? '&' : '?';
    window.open(`${cert.viewUrl}${sep}print=1`, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      {/* Thumbnail / brand banner */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {cert.productThumbnail ? (
          <Image
            src={cert.productThumbnail}
            alt={cert.courseTitle}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              // color-mix iPhone7-д унана → HEX navy gradient (90% primary+black ≈ #011a5f)
              background: 'linear-gradient(135deg, #011a5f 0%, #022179 100%)',
            }}
          >
            <GraduationCap className="h-12 w-12 text-secondary" />
          </div>
        )}
        {/* Сертификат badge */}
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground shadow-sm"
          style={{ background: 'var(--secondary)' }}
        >
          <Award className="h-3.5 w-3.5" />
          Сертификат
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/products/${cert.productSlug}`}
            className="line-clamp-2 text-sm font-bold leading-snug text-foreground transition-colors hover:text-primary"
          >
            {cert.courseTitle || cert.productTitle}
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground">
              #{cert.certNo}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(cert.issuedAt)}-нд олгосон
            </span>
          </div>

          {cert.userName && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Эзэмшигч: <span className="font-medium text-foreground">{cert.userName}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openView}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Сертификат харах
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-primary/30 text-primary hover:bg-muted/70 hover:text-primary"
            onClick={openPrint}
            aria-label="PDF татах / Хэвлэх"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PDF / Хэвлэх</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function CertificatesPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-certificates', token],
    queryFn: () => coursesApi.certificate.listMine(token!),
    enabled: !!token,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  if (!session) return null;

  const certs = data ?? [];
  const paged = certs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Миний сертификат</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Сургалт амжилттай дуусгаж авсан бүх сертификат
          </p>
        </div>
        {certs.length > 0 && (
          <span className="mt-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {certs.length} сертификат
          </span>
        )}
      </div>

      {isLoading && <Loading className="mt-8" />}

      {/* Backend бэлэн биш / алдаа гарвал — empty state-тэй адил эелдэг харагдац */}
      {error && (
        <EmptyState
          title="Сертификат аваагүй байна"
          description="Сургалт амжилттай дуусгаад сертификат аваарай. Сертификат олдмогц энд харагдана."
          className="mt-8"
          action={
            <Button asChild>
              <Link href="/categories/lesson">Хичээл үзэх</Link>
            </Button>
          }
        />
      )}

      {!isLoading && !error && certs.length === 0 && (
        <EmptyState
          title="Сертификат аваагүй байна"
          description="Сургалт амжилттай дуусгаад сертификат аваарай. Хичээлээ 100% үзэж дуусгахад сертификат олгогдоно."
          className="mt-8"
          action={
            <Button asChild>
              <Link href="/categories/lesson">Хичээл үзэх</Link>
            </Button>
          }
        />
      )}

      {!isLoading && !error && certs.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((cert, i) => (
              <CertificateCard key={cert.certNo} cert={cert} index={i} />
            ))}
          </div>
          <Pagination
            page={page}
            total={certs.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
