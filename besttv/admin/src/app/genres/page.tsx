'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Tags,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import { useAdminGenres, type AdminGenre } from '@/lib/queries';

interface FormState {
  name: string;
  nameEn: string;
  order: string;
  isAdult: boolean;
}

const EMPTY: FormState = { name: '', nameEn: '', order: '0', isAdult: false };

export default function GenresPage() {
  const { data, isLoading, isError, error, refetch } = useAdminGenres();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<AdminGenre | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  /* ── ЭРЭМБЭ: чирэх / сумаар зөөх ── */
  const [list, setList] = useState<AdminGenre[]>([]);
  const [dirty, setDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  /* ⚠️ Сервер дата ирэхэд ажлын хуулбарыг шинэчилнэ. Хадгалаагүй
     өөрчлөлт байвал ДАРЖ БОЛОХГҮЙ — админы ажил алга болно
     (`refetchOnWindowFocus` таб солиход асдаг). */
  useEffect(() => {
    if (data && !dirty) setList(data);
  }, [data, dirty]);

  /**
   * ⚠️ Шүүлт CLIENT талд — жанрын жагсаалт богино (ихэвчлэн 30-аас цөөн)
   * тул сервер рүү дахин очих нь илүү удаан (сүлжээний саатал > шүүх хугацаа).
   */
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!needle) return list;
    return list.filter((g) => g.name.toLowerCase().includes(needle));
  }, [list, needle]);

  /**
   * ⚠️⚠️ ХАЙЖ БАЙХАД ЧИРЭХГҮЙ.
   *
   * Шүүсэн жагсаалтын index нь БҮТЭН жагсаалттай таарахгүй тул чирвэл
   * ӨӨР жанр байраа солино (кино эрэмбэлэх хуудсанд яг энэ алдаанаас
   * сэргийлж хайлтыг «зөвхөн тодруулга» болгосон). Энд жанр цөөн тул
   * илүү энгийн шийдэл: хайлттай үед эрэмбэлэхийг түр хаана.
   */
  const canReorder = !needle && !savingOrder;

  /** i-р жанрыг j-р байрлалд шилжүүлнэ */
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

  /** Эрэмбийг сервер рүү хадгална */
  const saveOrder = async () => {
    setSavingOrder(true);
    await runMutation(
      () =>
        api('/admin/genres/reorder', {
          method: 'PATCH',
          body: JSON.stringify({ ids: list.map((g) => g.id) }),
        }),
      {
        success: 'Эрэмбэ хадгалагдлаа — нүүр хуудсанд шууд харагдана',
        error: 'Эрэмбэ хадгалахад алдаа гарлаа',
        /* ⚠️ `dirty=false` нь refetch-ЭЭС ӨМНӨ — эс бөгөөс useEffect
           хуучин датаг буцааж тавина */
        onDone: () => {
          setDirty(false);
          void refetch();
          qc.invalidateQueries({ queryKey: ['admin-genres'] });
        },
      },
    );
    setSavingOrder(false);
  };

  /**
   * ⚠️⚠️ ЖАНРЫГ ТУХАЙН САЙТАД НУУХ / ХАРУУЛАХ.
   *
   * ЯАГААД УСТГАХ БИШ ВЭ: `Genre` нь хоёр сайтад НИЙТЛЭГ (нэр, кино
   * нь хуваалцсан). Устгавал `PlanGenre` cascade-аар алга болж, тэр
   * жанртай багц авсан ТӨЛБӨРТЭЙ захиалагчид контентоо БҮГДИЙГ
   * алдана — мөнгө буцаагдахгүй, сэргээх боломжгүй.
   *
   * Нуух нь зөвхөн ТУХАЙН САЙТЫН нүүр/каталогоос хасна
   * (`GenreSiteOrder.isVisible`), нөгөө сайт хэвийн хэвээр.
   */
  const [visBusy, setVisBusy] = useState<string | null>(null);

  const toggleVisible = async (g: AdminGenre) => {
    if (visBusy) return;
    const next = !(g.isVisible ?? true);
    setVisBusy(g.id);
    await runMutation(
      () =>
        api(`/admin/genres/${g.id}/visible`, {
          method: 'PATCH',
          body: JSON.stringify({ isVisible: next }),
        }),
      {
        success: next
          ? `«${g.name}» энэ сайтад харагдана`
          : `«${g.name}» энэ сайтад НУУГДЛАА (кино устаагүй)`,
        error: 'Харагдацыг өөрчилж чадсангүй',
        onDone: () => {
          void refetch();
          qc.invalidateQueries({ queryKey: ['admin-genres'] });
        },
      },
    );
    setVisBusy(null);
  };

  /** Хадгалаагүй өөрчлөлтийг буцаана */
  const resetOrder = () => {
    if (data) setList(data);
    setDirty(false);
  };

  const openEdit = (genre: AdminGenre | 'new') => {
    setEditing(genre);
    setForm(
      genre === 'new'
        ? EMPTY
        : {
            name: genre.name,
            nameEn: '',
            order: String(genre.order),
            isAdult: genre.isAdult,
          },
    );
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Жанрын нэр оруулна уу');
      return;
    }

    // 18+ болгож байвал баталгаажуулна (үр дагавар том)
    if (form.isAdult && editing !== 'new' && !editing?.isAdult) {
      const ok = await confirm({
        title: `"${form.name}" жанрыг 18+ болгох уу?`,
        description: 'Энэ жанрын контент олон нийтэд харагдахаа болино.',
        bullets: [
          'Нүүр хуудас, каталог, хайлтаас бүрэн алга болно',
          'Зөвхөн /adult хуудсанд, нас баталгаажуулсны дараа харагдана',
          'Үзэхэд 18+ багц (эсвэл VIP) шаардлагатай болно',
        ],
        confirmLabel: '18+ болгох',
        tone: 'warning',
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        nameEn: form.nameEn.trim() || undefined,
        order: Number(form.order) || 0,
        isAdult: form.isAdult,
      };
      if (editing === 'new') {
        await api('/admin/genres', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Жанр нэмэгдлээ');
      } else if (editing) {
        await api(`/admin/genres/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Хадгалагдлаа');
      }
      qc.invalidateQueries({ queryKey: ['admin-genres'] });
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  /* ⚠️ `runMutation` — өмнө нь try/catch БАЙХГҮЙ байсан тул жанр
     ашиглагдаж байгаа (FK) эсвэл 403 гарвал toast ч гарахгүй, мөр ч
     арилахгүй → админ устсан гэж бодно */
  /**
   * ⚠️⚠️ ЖАНР УСТГАХ — ХОЁР ШАТЛАЛТ (багц/захиалагч хамгаална).
   *
   * БОДИТ АЛДАА: энэ диалог «Энэ жанрыг ашигладаг багцаас автоматаар
   * хасагдана» гэж ЭНГИЙН цэвэрлэгээ мэт бичдэг байв. Үнэндээ
   * `PlanGenre` нь Cascade тул тэр багц авсан ТӨЛБӨРТЭЙ захиалагчид
   * контентоо алддаг — админ үүнийг мэдэлгүй дардаг.
   *
   * Одоо backend нь багцад холбоотой жанрыг ТАТГАЛЗАж, хэдэн
   * захиалагч хохирохыг хэлнэ. Админ тэр мэдээллийг ХАРСНЫ дараа л
   * `force=1`-ээр давтаж болно.
   */
  const remove = async (g: AdminGenre) => {
    const ok = await confirm({
      title: `"${g.name}" жанрыг устгах уу?`,
      description: g._count?.titles
        ? `Энэ жанр ${g._count.titles} контенттой холбоотой байна.`
        : 'Энэ жанрыг бүрмөсөн устгана.',
      bullets: [
        'Контент өөрөө устахгүй, зөвхөн жанрын холбоос сална',
        /**
         * ⚠️⚠️ `Genre` нь SHARED (`site` багана АЛГА) тул устгавал
         * ХОЁУЛАНГ САЙТААС алга болно. Нуух товч нь «энэ сайтад
         * НУУГДСАН… нөгөө сайт хэвээр» гэж зөв хэлдэг атал устгах зам
         * дээр энэ ялгаа мартагдсан байв.
         */
        '⚠️ BestTV болон BestFilm ХОЁУЛАНГААС устана (жанр хуваалцсан)',
        '⚠️ Багцад холбоотой бол устахгүй — эхлээд анхааруулга харуулна',
      ],
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await api(`/admin/genres/${g.id}`, { method: 'DELETE' });
      toast.success('Жанр устгагдлаа');
      qc.invalidateQueries({ queryKey: ['admin-genres'] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Алдаа гарлаа';
      /* ⚠️ Багцад ашиглагдаж байгаагаас болж татгалзсан бол — админд
         ЯГ хэдэн захиалагч хохирохыг үзүүлээд ХҮЧЭЭР устгах сонголт */
      if (!msg.includes('багц')) {
        toast.error(msg);
        return;
      }
      const force = await confirm({
        title: `«${g.name}» — багцад ашиглагдаж байна`,
        description: msg,
        bullets: [
          'Устгавал тэдгээр багцын захиалагчид энэ жанрын контентоо АЛДАНА',
          'Мөнгө буцаагдахгүй, холбоосыг сэргээх боломжгүй',
          'Зөв арга: эхлээд Багц хуудаснаас энэ жанрыг хасах',
        ],
        confirmLabel: 'Ойлголоо, ХҮЧЭЭР устга',
        tone: 'danger',
      });
      if (!force) return;
      await runMutation(() => api(`/admin/genres/${g.id}?force=1`, { method: 'DELETE' }), {
        success: 'Жанр хүчээр устгагдлаа',
        onDone: () => qc.invalidateQueries({ queryKey: ['admin-genres'] }),
      });
    }
  };

  return (
    <AdminShell>
      <AdminTopbar
        title="Жанрууд"
        subtitle={data ? `Нийт ${data.length} жанр · ${data.filter((g) => g.isAdult).length} нь 18+` : undefined}
      />

      <main className="mx-auto max-w-3xl p-4 pt-5 sm:p-8 sm:pt-6">
        <div className="mb-4 rounded-lg border border-primary/25 bg-primary/8 p-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Жанр = багцын хандалт.</strong> Багц бүр сонгосон
          жанруудын контентыг нээдэг. Улс/төрлөөр (Монгол кино, Солонгос кино гэх мэт) жанр үүсгээд{' '}
          <strong className="text-foreground">Багц</strong> хуудаснаас холбоно. 🔞 тэмдэгтэй жанр нь
          ерөнхий каталогт харагдахгүй.
          {/* ⚠️ Чирэх боломжтойг ХЭЛНЭ — эс бөгөөс админ бариулыг анзаарахгүй */}
          <span className="mt-1 block">
            Жанруудыг <strong className="text-foreground">чирж</strong> эсвэл{' '}
            <strong className="text-foreground">сумаар</strong> эрэмбэлнэ — нүүр хуудсанд ЯГ энэ
            дарааллаар гарна.
          </span>
        </div>

        {/* ⚠️ Хайлт — өмнө нь ЗӨВХӨН доош гүйлгэж хайх боломжтой байв
            (жанр 40+ болоход хэрэгтэйгээ олохгүй) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Жанрын нэрээр хайх…"
              aria-label="Жанр хайх"
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => openEdit('new')}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
          >
            <Plus size={15} /> Жанр нэмэх
          </button>
        </div>

        {/* ⚠️ Шүүлтийн үр дүнгийн тоо — админ "хайлт ажиллав уу" гэдгийг
            шууд харна (хоосон үр дүн нь эвдэрсэн гэж ойлгогдохгүй) */}
        {q && (
          <p className="mt-2 text-xs text-muted-foreground">
            {rows.length} / {data?.length ?? 0} жанр
            {/* ⚠️ Хайлттай үед чирэх боломжгүйг ХЭЛНЭ — эс бөгөөс админ
                «чирэх ажиллахгүй байна» гэж эвдэрсэн гэж бодно */}
            <span className="ml-1.5 text-warning">· эрэмбэлэхийн тулд хайлтаа цэвэрлэнэ үү</span>
          </p>
        )}

        {/*
          ⚠️⚠️ ХАДГАЛААГҮЙ ЭРЭМБИЙН МӨР — өөрчлөлт хийсэн үед л гарна.

          Автоматаар хадгалахгүй: админ 5 жанрыг зөөх бүрд сервер рүү
          хүсэлт явуулбал завсрын эмх замбараагүй дараалал нүүр хуудсанд
          ХАРАГДАНА. Оронд нь бүгдийг зөөгөөд НЭГ удаа хадгална.
        */}
        {dirty && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3">
            <span className="text-sm font-medium text-foreground">
              Эрэмбэ өөрчлөгдсөн — хадгалаагүй байна
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={resetOrder}
                disabled={savingOrder}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <RotateCcw size={13} /> Буцаах
              </button>
              <button
                onClick={saveOrder}
                disabled={savingOrder}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {savingOrder ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Хадгалах
              </button>
            </div>
          </div>
        )}

        <div className="admin-card mt-4 overflow-hidden rounded-xl">
          {isError ? (
            <AdminErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            /* ⚠️ Spinner БИШ skeleton — төслийн дүрэм (бүтэц урьдчилж
               харагдаж, дата ирэхэд layout үсэрдэггүй) */
            <TableSkeleton rows={6} cols={3} />
          ) : (
            <div className="divide-y divide-border">
              {rows.map((g, i) => (
                <div
                  key={g.id}
                  /* ⚠️ Чирэх нь ЗӨВХӨН хайлтгүй үед — шүүсэн index нь
                     бүтэн жагсаалттай таарахгүй тул өөр жанр байраа солино */
                  draggable={canReorder}
                  onDragStart={() => (dragIndex.current = i)}
                  onDragOver={(e) => {
                    if (!canReorder) return;
                    e.preventDefault();
                    setOverIndex(i);
                  }}
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
                    'group flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent/40',
                    /* Чирж буй мөрийн БУУХ байрлалыг тодоор заана */
                    overIndex === i && dragIndex.current !== null && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
                    /* ⚠️ Энэ САЙТАД нуугдсан жанр — админ шууд танина.
                       Мөр УСТААГҮЙ тул бүдгэрүүлнэ, нуухгүй. */
                    g.isVisible === false && 'opacity-45',
                  )}
                >
                  {/* ⚠️ Чирэх бариул — мөр бүхэлдээ draggable ч бариул нь
                      «энийг чирж болно» гэдгийг ХАРУУЛНА (эс бөгөөс админ
                      мэдэхгүй өнгөрнө). Хайж байхад бүдгэрнэ. */}
                  <span
                    className={cn(
                      'mr-1 flex h-7 w-5 shrink-0 items-center justify-center text-muted-foreground/50',
                      canReorder ? 'cursor-grab active:cursor-grabbing' : 'opacity-25',
                    )}
                    title={canReorder ? 'Чирж эрэмбэлэх' : 'Хайлт идэвхтэй үед эрэмбэлэх боломжгүй'}
                  >
                    <GripVertical size={15} />
                  </span>

                  <button
                    onClick={() => openEdit(g)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <Tags size={14} className={g.isAdult ? 'text-destructive' : 'text-muted-foreground'} />
                    <span className="truncate font-medium text-foreground group-hover:text-primary">
                      {g.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {g._count?.titles ?? 0} контент
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {/*
                      ⚠️ СУМАН ТОВЧ — чирэх нь зарим орчинд хүндрэлтэй
                      (мэдрэгчтэй дэлгэц, чирэхийг мэддэггүй хэрэглэгч).
                      Тиймээс хоёр аргыг ЗЭРЭГ өгнө.
                      ⚠️ Хамгийн дээд/доод мөрөнд идэвхгүй болно.
                    */}
                    {canReorder && (
                      <div className="mr-1 flex items-center gap-0.5">
                        <button
                          onClick={() => move(i, i - 1)}
                          disabled={i === 0}
                          aria-label="Дээш зөөх"
                          title="Дээш зөөх"
                          className="flex h-9 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:pointer-events-none disabled:opacity-20"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          onClick={() => move(i, i + 1)}
                          disabled={i === rows.length - 1}
                          aria-label="Доош зөөх"
                          title="Доош зөөх"
                          className="flex h-9 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:pointer-events-none disabled:opacity-20"
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>
                    )}
                    {g.isAdult && (
                      <span className="rounded-md bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive">
                        🔞 18+
                      </span>
                    )}
                    {/* ⚠️ ЭНЭ САЙТАД нуух/харуулах — жанр УСТАХГҮЙ.
                        Нөгөө сайт хэвээр ажиллана. */}
                    <button
                      onClick={() => toggleVisible(g)}
                      disabled={visBusy === g.id}
                      aria-label={
                        g.isVisible === false ? 'Энэ сайтад харуулах' : 'Энэ сайтаас нуух'
                      }
                      title={
                        g.isVisible === false
                          ? 'Энэ сайтад НУУГДСАН — дарж харуулна (кино устаагүй)'
                          : 'Энэ сайтаас нуух (кино устахгүй, нөгөө сайт хэвээр)'
                      }
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-md transition-colors disabled:opacity-40',
                        g.isVisible === false
                          ? 'text-destructive hover:bg-destructive/10'
                          : 'text-muted-foreground hover:bg-accent hover:text-primary',
                      )}
                    >
                      {visBusy === g.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : g.isVisible === false ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} />
                      )}
                    </button>
                    {/* ⚠️ Кинотой жанрт л эрэмбэлэх утгатай — хоосон жанрт
                        товч гарвал хоосон хуудас нээгдэж будлиан үүснэ */}
                    {(g._count?.titles ?? 0) > 1 && (
                      <Link
                        href={`/genres/${g.id}/order`}
                        aria-label="Кино эрэмбэлэх"
                        title="Нүүрэнд гарах дарааллыг өөрчлөх"
                        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                      >
                        <ArrowUpDown size={15} />
                      </Link>
                    )}
                    {/* ⚠️ 36px — өмнөх 26px (`p-1.5`+14px) нь хүрэлцэх
                        зөвлөмжөөс хамаагүй бага, таблет дээр устгахыг
                        андуурч дардаг байв */}
                    <button
                      onClick={() => openEdit(g)}
                      aria-label="Засах"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => remove(g)}
                      aria-label="Устгах"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isLoading && !isError && !rows.length && (
            /* ⚠️ Хайлтын үр дүн хоосон БА дата огт байхгүй хоёрыг ЯЛГАНА —
               эс бөгөөс админ "бүх жанр устсан" гэж сандарна */
            <TableEmptyState
              icon={Tags}
              message={q ? 'Хайлтад тохирох жанр олдсонгүй' : 'Жанр байхгүй байна'}
              description={
                q
                  ? 'Өөр түлхүүр үг оруулж үзнэ үү.'
                  : 'Улс/төрлөөр жанр үүсгээд Багц хуудаснаас холбоно.'
              }
              action={
                q ? (
                  <button
                    onClick={() => setQ('')}
                    className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    Шүүлт цэвэрлэх
                  </button>
                ) : (
                  <button
                    onClick={() => openEdit('new')}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
                  >
                    <Plus size={15} /> Эхний жанр нэмэх
                  </button>
                )
              }
            />
          )}
        </div>
      </main>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing === 'new' ? 'Шинэ жанр' : 'Жанр засах'}</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Жанрын нэр
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="ж: Монгол кино"
                  autoFocus
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Англи нэр (заавал биш)
                  </label>
                  <input
                    value={form.nameEn}
                    onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                    placeholder="Mongolian"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Дараалал
                  </label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <label
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors',
                  form.isAdult
                    ? 'border-destructive/40 bg-destructive/8'
                    : 'border-border hover:bg-accent/40',
                )}
              >
                <input
                  type="checkbox"
                  checked={form.isAdult}
                  onChange={(e) => setForm((f) => ({ ...f, isAdult: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    🔞 Насанд хүрэгчдийн (18+)
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Нүүр, каталог, хайлтаас алга болж зөвхөн /adult хуудсанд харагдана
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                Хадгалах
              </button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  );
}
