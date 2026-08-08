'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronsUp,
  Clock,
  Eye,
  Film,
  GripVertical,
  Info,
  RotateCcw,
  Save,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableSkeleton } from '@/components/table-skeleton';
import { TableEmptyState } from '@/components/table-empty-state';
import { AdminErrorState } from '@/components/admin-error-state';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';

interface OrderTitle {
  id: string;
  title: string;
  slug: string;
  type: string;
  year: number | null;
  views: number;
  isActive: boolean;
  comingSoon: boolean;
  createdAt: string;
  order: number;
  posterUrl: string | null;
}

interface GenreOrderResponse {
  genre: { id: string; name: string; slug: string };
  items: OrderTitle[];
}

/**
 * ⚠️⚠️ НҮҮР ХУУДСАНД ХАРАГДАХ ТОО.
 *
 * `titles.service.ts` нь жанрын эгнээнд `take: 24` авдаг. Админ 60 кино
 * эрэмбэлээд 30 дахь нь нүүрэнд ОГТ гарахгүй бол "яагаад миний тавьсан
 * кино харагдахгүй байна?" гэсэн гомдол гарна. Тиймээс 24-ийн дараа
 * ХАРАГДАХГҮЙ гэсэн заагийг ил зурна.
 */
const HOME_VISIBLE = 24;

/** Огноогоор шинэ→хуучин (нүүрний анхны дараалалтай ижил) */
const byNewest = (a: OrderTitle, b: OrderTitle) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export default function GenreOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading, isError, error, refetch } = useQuery<GenreOrderResponse>({
    queryKey: ['admin', 'genre-order', id],
    queryFn: () => api<GenreOrderResponse>(`/admin/genres/${id}/titles`),
    /* ⚠️ Төслийн дүрэм — админ жагсаалт цонх идэвхжихэд шинэчлэгдэнэ */
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  /** Чирэлтээр өөрчлөгдөх ажлын хуулбар */
  const [list, setList] = useState<OrderTitle[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  /* Сервер дата ирэхэд ажлын хуулбарыг шинэчилнэ.
     ⚠️ Хадгалаагүй өөрчлөлт байвал ДАРЖ БОЛОХГҮЙ — админы ажил алга болно
     (refetchOnWindowFocus нь таб солиход л асдаг). */
  useEffect(() => {
    if (data?.items && !dirty) setList(data.items);
  }, [data, dirty]);

  /**
   * ⚠️ Хайлт нь ЗӨВХӨН тодруулга — жагсаалтыг ШҮҮХГҮЙ.
   *
   * Шүүчихвэл чирэх үед index нь бүтэн жагсаалттай таарахгүй болж
   * ӨӨР кино байраа солино. Оронд нь олдсоныг өнгөөр ялгаж, бусдыг
   * бүдгэрүүлнэ — эрэмбэ бүтнээрээ хэвээр.
   */
  const needle = q.trim().toLowerCase();
  const matches = useMemo(
    () =>
      new Set(
        needle ? list.filter((t) => t.title.toLowerCase().includes(needle)).map((t) => t.id) : [],
      ),
    [list, needle],
  );

  /** i-р элементийг j-р байрлалд шилжүүлнэ */
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= list.length) return;
    setList((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    await runMutation(
      () =>
        api(`/admin/genres/${id}/reorder`, {
          method: 'PATCH',
          body: JSON.stringify({ titleIds: list.map((t) => t.id) }),
        }),
      {
        success: 'Эрэмбэ хадгалагдлаа — нүүр хуудсанд шууд харагдана',
        error: 'Эрэмбэ хадгалахад алдаа гарлаа',
        /* ⚠️ `dirty=false` нь refetch-ээс ӨМНӨ — эс бөгөөс useEffect
           хуучин датаг буцааж тавина (dirty хамгаалалт) */
        onDone: () => {
          setDirty(false);
          void refetch();
        },
      },
    );
    setSaving(false);
  };

  const reset = () => {
    if (data?.items) setList(data.items);
    setDirty(false);
    toast.info('Хадгалаагүй өөрчлөлт цуцлагдлаа');
  };

  const sortByNewest = () => {
    setList((prev) => [...prev].sort(byNewest));
    setDirty(true);
  };

  const sortByViews = () => {
    setList((prev) => [...prev].sort((a, b) => b.views - a.views));
    setDirty(true);
  };

  return (
    <AdminShell>
      <AdminTopbar
        title={data?.genre.name ? `${data.genre.name} — эрэмбэ` : 'Жанрын эрэмбэ'}
        subtitle="Нүүр хуудасны эгнээнд гарах дараалал"
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6">
        <Link
          href="/genres"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} /> Жанрын жагсаалт руу
        </Link>

        {/* ⚠️ Заавар — чирэх боломжтой гэдгийг мэдэхгүй админ олон байдаг */}
        <div className="mb-4 flex gap-2.5 rounded-lg border border-primary/25 bg-primary/8 p-3 text-xs leading-relaxed text-muted-foreground">
          <Info size={15} className="mt-0.5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p>
              <b className="text-foreground">Мөрийг чирж</b> дээш/доош зөөнө. Гар утаснаас бол баруун
              талын <ChevronsUp size={11} className="inline" /> товчоор хамгийн дээш гаргана.
            </p>
            <p>
              Эхний <b className="text-foreground">{HOME_VISIBLE}</b> кино л нүүр хуудасны эгнээнд
              харагдана — доорх улаан зураасны доод талынхыг зөвхөн{' '}
              <b className="text-foreground">Бүгд</b> хуудаснаас олно.
            </p>
          </div>
        </div>

        {/* Хэрэгслийн мөр */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-45 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Кино олох (эрэмбэ хэвээрээ)"
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={sortByNewest}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Clock size={14} /> Шинэ эхэнд
          </button>
          <button
            onClick={sortByViews}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Eye size={14} /> Үзэлтээр
          </button>
        </div>

        {isError ? (
          <AdminErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={8} cols={3} />
        ) : !list.length ? (
          <TableEmptyState
            icon={Film}
            message="Энэ жанрт кино алга"
            description="Кино засварлах хуудаснаас энэ жанрыг сонговол энд гарч ирнэ."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {list.map((t, i) => (
              <div key={t.id}>
                {/* ⚠️ Нүүрэнд харагдах ХИЛ — доод талынх нүүрэнд ГАРАХГҮЙ */}
                {i === HOME_VISIBLE && (
                  <div className="flex items-center gap-2 border-y border-dashed border-destructive/50 bg-destructive/8 px-4 py-1.5 text-xs font-semibold text-destructive">
                    <ArrowUpDown size={12} />
                    Эндээс доош нүүр хуудсанд харагдахгүй
                  </div>
                )}

                <div
                  draggable
                  onDragStart={() => (dragIndex.current = i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIndex(i);
                  }}
                  onDragLeave={() => setOverIndex((p) => (p === i ? null : p))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex.current !== null) move(dragIndex.current, i);
                    dragIndex.current = null;
                    setOverIndex(null);
                  }}
                  onDragEnd={() => {
                    dragIndex.current = null;
                    setOverIndex(null);
                  }}
                  className={cn(
                    'flex cursor-grab items-center gap-3 border-b border-border px-3 py-2 transition-colors last:border-b-0 active:cursor-grabbing',
                    overIndex === i && 'bg-primary/15',
                    /* ⚠️ Хайлтад олдсоныг ТОДРУУЛНА, бусдыг бүдгэрүүлнэ
                       (шүүхгүй — index эвдэрнэ, дээрх тайлбар) */
                    needle && !matches.has(t.id) && 'opacity-35',
                    needle && matches.has(t.id) && 'bg-primary/10',
                  )}
                >
                  <GripVertical size={16} className="shrink-0 text-muted-foreground" />

                  {/* Байрлалын дугаар — 1-ээс эхэлнэ (админд ойлгомжтой) */}
                  <span
                    className={cn(
                      'w-7 shrink-0 text-center text-xs font-bold tabular-nums',
                      i < HOME_VISIBLE ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {i + 1}
                  </span>

                  {/* ⚠️ Постер — presign URL (backend `media.url`). Байхгүй бол
                      зай хэвээр үлдэнэ (layout үсрэхгүй) */}
                  <div className="relative h-13 w-9 shrink-0 overflow-hidden rounded bg-muted">
                    {t.posterUrl && (
                      <Image src={t.posterUrl} alt="" fill sizes="36px" className="object-cover" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {t.year ?? '—'}
                      <span className="text-border">·</span>
                      {t.views.toLocaleString('mn-MN')} үзэлт
                      {!t.isActive && (
                        <span className="rounded bg-muted px-1.5 font-medium text-muted-foreground">
                          Идэвхгүй
                        </span>
                      )}
                      {t.comingSoon && (
                        <span className="rounded bg-primary/15 px-1.5 font-medium text-primary">
                          Удахгүй
                        </span>
                      )}
                    </p>
                  </div>

                  {/* ⚠️ МОБАЙЛД чирэх найдваргүй (хуудас гүйлгэхтэй зөрчилдөнө)
                      тул товчоор дээш зөөх ЗАМ заавал хэрэгтэй */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => move(i, 0)}
                      disabled={i === 0}
                      aria-label="Хамгийн дээш"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:opacity-25"
                    >
                      <ChevronsUp size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/*
        ⚠️⚠️ ХАДГАЛАХ МӨР нь ЗӨВХӨН өөрчлөлт байгаа үед гарна (sticky).
        Урт жагсаалтын ЁСТОЙ доод талд товч байвал админ 60 мөр гүйлгэж
        очих хэрэгтэй болно — чирсэн даруйдаа хадгалж чаддаг байх ёстой.
      */}
      {dirty && (
        <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Хадгалаагүй өөрчлөлт байна
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={reset}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                <RotateCcw size={14} /> Буцаах
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'Хадгалж байна…' : 'Хадгалах'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
