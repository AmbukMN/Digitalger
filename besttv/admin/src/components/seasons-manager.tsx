'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Stamp,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { api } from '@/lib/api';
import { useAdminTitle, type AdminSeason } from '@/lib/queries';
import { VideoUpload } from '@/components/video-upload';
import { SubtitleManager } from '@/components/subtitle-manager';

/**
 * Олон ангитын улирал / анги удирдах.
 *
 * ⚠️ Тусдаа файл — кино засах МОДАЛ болон хуудас хоёулаа ашиглана
 * (өмнө нь зөвхөн хуудсанд дотоод функц байсан).
 */
export function SeasonsManager({ titleId }: { titleId: string }) {
  const { data: title, refetch } = useAdminTitle(titleId);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [adding, setAdding] = useState(false);

  const seasons = title?.seasons ?? [];

  /**
   * ⚠️⚠️ АЛЬ УЛИРАЛ НЭЭЛТТЭЙ БАЙХ — ЗӨВХӨН НЭГ (accordion).
   *
   * БОДИТ АСУУДАЛ: өмнө нь БҮХ улирал бүх ангиа задласан байдлаар
   * зэрэг харагддаг байв. 10 улирал × 22 анги = 220 мөр нэг доор
   * урсаж, админ хайж байгаа улирлаа олохын тулд хуудсыг тасралтгүй
   * гүйлгэдэг байсан (The Blacklist дээр яг ийм болсон).
   *
   * Accordion (нэг л нээлттэй) нь урт цувралд хамгийн тохиромжтой:
   * дэлгэц дээр үргэлж бүх улирлын ТОЛГОЙ харагдана — админ хаана
   * байгаагаа алдахгүй.
   *
   * ⚠️ 1 улирал бол нээх/хаах утгагүй — үргэлж нээлттэй (доор).
   */
  const [openId, setOpenId] = useState<string | null>(null);

  /* ⚠️ Дата ирэхэд/улирал нэмэгдэхэд эхнийхийг автоматаар нээнэ —
     хоосон accordion харуулбал «юу ч алга» мэт харагдана */
  useEffect(() => {
    if (!openId && seasons.length > 0) setOpenId(seasons[0].id);
  }, [seasons, openId]);

  const addSeason = async () => {
    setAdding(true);
    try {
      const number = seasons.length + 1;
      const created = await api<{ id: string }>(`/admin/titles/${titleId}/seasons`, {
        method: 'POST',
        body: JSON.stringify({ number, name: newSeasonName.trim() || undefined }),
      });
      setNewSeasonName('');
      /* Шинээр нэмсэн улирлыг ШУУД нээнэ — админ анги нэмэх гэж байгаа */
      setOpenId(created.id);
      refetch();
      toast.success(`${number}-р улирал нэмэгдлээ`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Нэмж чадсангүй');
    } finally {
      setAdding(false);
    }
  };

  const single = seasons.length === 1;
  const hiddenCount = seasons.filter((s) => !s.isVisible).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={newSeasonName}
          onChange={(e) => setNewSeasonName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !adding && addSeason()}
          placeholder="Улирлын нэр (заавал биш)"
          aria-label="Улирлын нэр"
          className="admin-input min-w-48 flex-1"
        />
        <button onClick={addSeason} disabled={adding} className="btn-secondary">
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Улирал нэмэх
        </button>
      </div>

      {/* ⚠️ Нуусан улирал байвал админд ТОДООР сануулна — эс бөгөөс
          «яагаад сайт дээр харагдахгүй байна» гэж удаан хайна */}
      {hiddenCount > 0 && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
          <EyeOff size={13} className="shrink-0" />
          {hiddenCount} улирал нуугдсан — хэрэглэгчид харагдахгүй байна
        </p>
      )}

      {seasons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">Улирал байхгүй байна</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            Дээрх товчоор эхний улирлаа нэмнэ үү
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {seasons.map((s) => (
            <SeasonBlock
              key={s.id}
              season={s}
              /* ⚠️ Киноны усан тэмдэг — анги «өвлөх» үед юу болохыг
                 админд ХАРУУЛАХАД хэрэгтэй (таамаглуулахгүй) */
              titleWatermark={Boolean(title?.watermark)}
              /* 1 улирал бол хаах утгагүй — үргэлж нээлттэй */
              open={single || openId === s.id}
              collapsible={!single}
              onToggle={() => setOpenId(openId === s.id ? null : s.id)}
              onChange={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SeasonBlock({
  season,
  titleWatermark,
  open,
  collapsible,
  onToggle,
  onChange,
}: {
  season: AdminSeason;
  /** Киноны усан тэмдэг — «өвлөх» сонголтод юу болохыг харуулна */
  titleWatermark: boolean;
  open: boolean;
  collapsible: boolean;
  onToggle: () => void;
  onChange: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addingEp, setAddingEp] = useState(false);
  const confirm = useConfirm();

  /** Улирлын нэр засах */
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const saveName = async () => {
    setEditingName(false);
    /* ⚠️ Өөрчлөгдөөгүй бол сервер рүү дэмий явуулахгүй */
    if (nameInput.trim() === (season.name ?? '')) return;
    try {
      await api(`/admin/titles/seasons/${season.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      onChange();
      toast.success('Улирлын нэр хадгалагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    }
  };

  const episodes = season.episodes ?? [];
  const readyCount = episodes.filter((e) => e.streamStatus === 'READY').length;
  const hiddenEps = episodes.filter((e) => !e.isVisible).length;
  /* ⚠️ Үнэгүй ангийн тоо — улирлын толгойд шууд харуулна */
  const freeCount = episodes.filter((e) => e.isFreePreview).length;

  /**
   * ⚠️⚠️ УЛИРАЛ НУУХ — хэрэглэгчид ОГТ харагдахгүй болно.
   *
   * Дата УСТАХГҮЙ (видео, хадмал, нэр бүгд хэвээр) — зөвхөн нийтэд
   * харуулахгүй. Админ хүссэн үедээ буцааж нээнэ.
   *
   * ⚠️ Backend талд ч хаагдана (stream + хадмал) — ангийн ID мэдэж
   * байсан ч шууд URL-ээр татаж чадахгүй.
   */
  const toggleSeasonVisible = async () => {
    const next = !season.isVisible;
    /* ⚠️ НУУХ нь хэрэглэгчид шууд нөлөөлнө — баталгаажуулна.
       Нээхэд асуух шаардлагагүй (эрсдэлгүй үйлдэл). */
    if (!next) {
      const ok = await confirm({
        title: `${season.name ?? `${season.number}-р улирал`}-ыг нуух уу?`,
        description: 'Хэрэглэгчид энэ улирал болон доторх бүх анги ОГТ харагдахгүй болно.',
        bullets: [
          `${episodes.length} анги нуугдана`,
          'Дата устахгүй — хүссэн үедээ буцааж нээнэ',
          'Шууд холбоосоор ч үзэх боломжгүй болно',
        ],
        confirmLabel: 'Нуух',
      });
      if (!ok) return;
    }
    try {
      await api(`/admin/titles/seasons/${season.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isVisible: next }),
      });
      onChange();
      toast.success(next ? 'Улирал харагдана' : 'Улирал нуугдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    }
  };

  /** Ангийг тус тусад нь нуух */
  const toggleEpisodeVisible = async (episodeId: string, next: boolean) => {
    try {
      await api(`/admin/titles/episodes/${episodeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isVisible: next }),
      });
      onChange();
      toast.success(next ? 'Анги харагдана' : 'Анги нуугдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    }
  };

  const addEpisode = async () => {
    setAddingEp(true);
    try {
      const number = episodes.length + 1;
      await api(`/admin/titles/seasons/${season.id}/episodes`, {
        method: 'POST',
        body: JSON.stringify({ number }),
      });
      onChange();
      toast.success(`${number}-р анги нэмэгдлээ`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Нэмж чадсангүй');
    } finally {
      setAddingEp(false);
    }
  };

  /**
   * Ангийг үнэгүй/төлбөртэй болгох.
   *
   * ⚠️ Оптимист шинэчлэлт ХИЙХГҮЙ — `onChange()` сервэрээс дахин татна.
   * Эс бөгөөс алдаа гарахад UI зөрж, админ «болсон» гэж бодно.
   */
  const toggleFree = async (episodeId: string, value: boolean) => {
    try {
      await api(`/admin/titles/episodes/${episodeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFreePreview: value }),
      });
      onChange();
      toast.success(value ? 'Анги үнэгүй боллоо' : 'Анги төлбөртэй боллоо');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    }
  };

  /**
   * ⚠️⚠️ АНГИЙН УСАН ТЭМДЭГ — ГУРВАН ТӨЛӨВ.
   *
   * БОДИТ ХЭРЭГЦЭЭ (админ): «зарим видеод лого тавина, зарим дээр нь
   * тавихгүй». Өмнө нь тохиргоо ЗӨВХӨН кино түвшинд байсан тул
   * бүх анги нэг л адил байх ёстой байв.
   *
   *   null  → кинооос өвлөнө
   *   true  → заавал тавина
   *   false → заавал тавихгүй
   *
   * ⚠️ Аль хэдийн хөрвүүлсэн видеонд НӨЛӨӨЛӨХГҮЙ — лого нь видеонд
   * ШАТААГДСАН. Дараагийн upload-д л үйлчилнэ (доор анхааруулна).
   */
  const setWatermark = async (episodeId: string, value: boolean | null) => {
    try {
      await api(`/admin/titles/episodes/${episodeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ watermark: value }),
      });
      onChange();
      toast.success(
        value === null
          ? `Кинооос өвлөнө (${titleWatermark ? 'лого ОРНО' : 'логогүй'})`
          : value
            ? 'Энэ ангид лого ОРНО'
            : 'Энэ ангид лого ОРОХГҮЙ',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    }
  };

  /** Ангийн нэр засах — өөрчлөгдсөн үед л илгээнэ */
  const saveEpisodeName = async (episodeId: string, before: string, next: string) => {
    if (next.trim() === before.trim()) return;
    try {
      await api(`/admin/titles/episodes/${episodeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: next.trim() || null }),
      });
      onChange();
      toast.success('Ангийн нэр хадгалагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    }
  };

  const removeSeason = async () => {
    const ok = await confirm({
      title: `${season.name ?? `${season.number}-р улирал`}-ыг устгах уу?`,
      description: `Энэ улирал ${episodes.length} ангитай${readyCount ? `, ${readyCount} нь видеотой` : ''}.`,
      bullets: [
        'Бүх анги устана',
        ...(readyCount ? ['Байршуулсан видео файлууд ч устана — сэргээх боломжгүй'] : []),
        'Хэрэглэгчдийн үзэлтийн явц алдагдана',
        /* ⚠️ Устгахын оронд НУУХ гэсэн эргэж болох сонголт байгааг сануулна */
        'Түр хугацаанд хаах бол «Нуух» товчийг ашиглана уу (дата хэвээр)',
      ],
      confirmLabel: 'Улирлыг устгах',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/admin/titles/seasons/${season.id}`, { method: 'DELETE' });
      onChange();
      toast.success('Улирал устгагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Устгаж чадсангүй');
    }
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border transition-colors',
        /* ⚠️ Нээлттэй улирал ТОДРОХ — 10 улирлын дунд аль нь идэвхтэйг
           нэг харцаар мэдэхийн тулд хүрээ + дэвсгэрээр ялгана */
        open ? 'border-primary/35 bg-card' : 'border-border bg-card/50 hover:border-border/80',
        /* Нуусан улирал — бүхэлдээ бүдэг + анхааруулах хүрээ */
        !season.isVisible && 'border-dashed border-warning/40',
      )}
    >
      {/* ── Толгой ────────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 px-4 py-3',
          open && collapsible && 'border-b border-border',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/*
            ⚠️ ЗАДЛАХ ТОВЧ — гарчгаас ТУСДАА. Гарчиг дээр дарахад нэр
            засварлагддаг тул хоёрыг нэг товч болговол админ нэр засах
            гэж дараад улирал хаагдана.
          */}
          {collapsible && (
            <button
              onClick={onToggle}
              aria-expanded={open}
              aria-label={open ? 'Хаах' : 'Нээх'}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronDown
                size={16}
                className={cn('transition-transform duration-200', open && 'rotate-180')}
              />
            </button>
          )}

          <div className="min-w-0 flex-1">
            {/*
              ⚠️ Улирлын нэр — ЗАСВАРЛАХ боломжтой. «1-р улирал» гэсэн
              автомат нэр бүх цувралд тохирохгүй («1-р бүлэг», «Season 1»
              гэх мэт өөр нэршил хэрэгтэй байж болно).
              ⚠️ Хоосон үлдээвэл автомат нэр рүү буцна.
            */}
            {editingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                placeholder={`${season.number}-р улирал`}
                className="admin-input w-full max-w-xs text-sm font-semibold"
              />
            ) : (
              <button
                onClick={() => {
                  setNameInput(season.name ?? '');
                  setEditingName(true);
                }}
                title="Нэр засах"
                className="group flex items-center gap-1.5 text-left font-semibold text-foreground hover:text-primary"
              >
                <h3 className={cn('truncate', !season.isVisible && 'text-muted-foreground')}>
                  {season.name ?? `${season.number}-р улирал`}
                </h3>
                <Pencil
                  size={11}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
                />
              </button>
            )}
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              <span>{episodes.length} анги</span>
              {readyCount > 0 && <span>· {readyCount} бэлэн</span>}
              {freeCount > 0 && <span className="text-warning">· {freeCount} үнэгүй</span>}
              {hiddenEps > 0 && <span className="text-warning">· {hiddenEps} нуусан</span>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* ⚠️ НУУСАН ТӨЛӨВ — толгой дээр ил шошго. Хаалттай (collapsed)
              байхад ч админ шууд харна. */}
          {!season.isVisible && (
            <span className="rounded bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
              Нуусан
            </span>
          )}
          <button
            onClick={toggleSeasonVisible}
            title={season.isVisible ? 'Хэрэглэгчээс нуух' : 'Хэрэглэгчид харуулах'}
            aria-label={season.isVisible ? 'Улирал нуух' : 'Улирал харуулах'}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              season.isVisible
                ? 'text-muted-foreground hover:bg-accent hover:text-foreground'
                : 'bg-warning/15 text-warning hover:bg-warning/25',
            )}
          >
            {season.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            onClick={addEpisode}
            disabled={addingEp}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            {addingEp ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Анги нэмэх
          </button>
          <button
            onClick={removeSeason}
            aria-label="Улирал устгах"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Ангиуд ────────────────────────────────────────────────── */}
      {open && episodes.length > 0 && (
        <div className="space-y-1.5 p-3">
          {episodes.map((ep) => (
            <div
              key={ep.id}
              className={cn(
                'rounded-lg bg-accent/40 p-2.5',
                !ep.isVisible && 'bg-warning/8 ring-1 ring-inset ring-warning/25',
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpanded(expanded === ep.id ? null : ep.id)}
                  aria-expanded={expanded === ep.id}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                    <ChevronDown
                      size={13}
                      className={cn(
                        'shrink-0 text-muted-foreground transition-transform',
                        expanded === ep.id && 'rotate-180',
                      )}
                    />
                    <span className={cn('truncate', !ep.isVisible && 'text-muted-foreground')}>
                      {ep.number}. {ep.name ?? `Анги ${ep.number}`}
                    </span>
                  </span>
                  {/*
                    ⚠️ ҮНЭГҮЙ ТЭМДЭГ — ЖАГСААЛТЫН МӨР ДЭЭР ШУУД.
                    Задалж байж л checkbox харагддаг байсан тул 32
                    ангитай улиралд «аль нь үнэгүй вэ» гэдгийг мэдэх
                    боломжгүй байв.
                  */}
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    {ep.isFreePreview && (
                      <span className="shrink-0 rounded bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                        Үнэгүй
                      </span>
                    )}
                    <StatusBadge status={ep.streamStatus} />
                  </span>
                </button>

                {/*
                  ⚠️⚠️ АНГИ НУУХ — ЖАГСААЛТЫН МӨР ДЭЭР ШУУД.
                  Задлаж байж нуудаг байвал 22 ангитай улиралд «аль
                  ангиуд нуугдсан бэ» гэдгийг харахын тулд бүгдийг
                  нэг нэгээр нь дарах хэрэгтэй болно.
                */}
                <button
                  onClick={() => void toggleEpisodeVisible(ep.id, !ep.isVisible)}
                  title={ep.isVisible ? 'Хэрэглэгчээс нуух' : 'Хэрэглэгчид харуулах'}
                  aria-label={ep.isVisible ? 'Анги нуух' : 'Анги харуулах'}
                  className={cn(
                    'shrink-0 rounded-md p-1.5 transition-colors',
                    ep.isVisible
                      ? 'text-muted-foreground hover:bg-background hover:text-foreground'
                      : 'bg-warning/20 text-warning hover:bg-warning/30',
                  )}
                >
                  {ep.isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
              </div>

              {expanded === ep.id && (
                <div className="mt-3 space-y-3">
                  {/*
                    ⚠️ Ангийн нэр — «Анги 1» гэсэн автомат нэрийн оронд
                    бодит гарчиг («Пилот», «Берлин»). Хоосон үлдээвэл
                    автомат нэр рүү буцна.
                  */}
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      Ангийн нэр (заавал биш)
                    </span>
                    <input
                      defaultValue={ep.name ?? ''}
                      placeholder={`Анги ${ep.number}`}
                      onBlur={(e) => void saveEpisodeName(ep.id, ep.name ?? '', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="admin-input w-full"
                    />
                  </label>

                  {/* ⚠️ Нуусан анги задлахад ЯАГААД гэдгийг тайлбарлана */}
                  {!ep.isVisible && (
                    <p className="flex items-start gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
                      <EyeOff size={13} className="mt-0.5 shrink-0" />
                      Энэ анги хэрэглэгчид харагдахгүй байна. Дээрх нүд дүрсээр
                      буцааж нээнэ.
                    </p>
                  )}

                  {/*
                    ⚠️⚠️ ҮНЭГҮЙ ҮЗЭХ — цувралын эхний ангийг үнэгүй
                    болгож хэрэглэгчийг татах маркетингийн хэрэгсэл.
                    Backend (`isFreePreview`) болон frontend бэлэн байсан
                    атлаа АДМИН ПАНЕЛД тохируулах газар БАЙХГҮЙ байв —
                    DB-д гараар засахаас өөр арга байгаагүй.
                  */}
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40">
                    <input
                      type="checkbox"
                      checked={ep.isFreePreview}
                      onChange={(e) => void toggleFree(ep.id, e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-success"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        Үнэгүй үзэх
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Багц аваагүй, нэвтрээгүй хэрэглэгч ч энэ ангийг үзнэ
                      </span>
                    </span>
                  </label>

                  {/*
                    ⚠️⚠️ УСАН ТЭМДЭГ — АНГИ ТУС БҮРД (админы хүсэлт:
                    «зарим видеод лого тавина, зарим дээр нь тавихгүй»).

                    ⚠️ Байрлал нь VideoUpload-ЫН ДЭЭР ЗААВАЛ: лого нь
                    хөрвүүлэх ҮЕД шатаагддаг тул upload дарахаас ӨМНӨ
                    сонгосон байх ёстой. Доор нь тавибал админ видеогоо
                    оруулчихаад дараа нь олж хардаг.
                  */}
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Stamp size={13} className="shrink-0 text-muted-foreground" />
                        BestTV лого
                      </span>
                      {/* ⚠️ Хөрвүүлсэн видеонд өөрчлөлт үйлчлэхгүйг ил хэлнэ */}
                      {ep.streamStatus === 'READY' && (
                        <span className="text-[11px] text-muted-foreground">
                          дараагийн байршуулалтад
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 rounded-lg bg-accent/40 p-1">
                      {(
                        [
                          {
                            v: null,
                            label: `Кинооос (${titleWatermark ? 'орно' : 'орохгүй'})`,
                            short: 'Кинооос',
                          },
                          { v: true, label: 'Заавал тавина', short: 'Тавина' },
                          { v: false, label: 'Тавихгүй', short: 'Тавихгүй' },
                        ] as const
                      ).map((o) => {
                        /* ⚠️ `undefined` ч «тохируулаагүй» = өвлөх (хуучин
                           дата эсвэл backend талбар илгээгээгүй тохиолдол) */
                        const cur = ep.watermark ?? null;
                        const active = cur === o.v;
                        return (
                          <button
                            key={String(o.v)}
                            onClick={() => void setWatermark(ep.id, o.v)}
                            title={o.label}
                            className={cn(
                              'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                              active
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background hover:text-foreground',
                            )}
                          >
                            {o.short}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      Зүүн дээд буланд, өргөний 10%. ⚠️ Лого видеонд{' '}
                      <strong className="text-warning">шатаагдана</strong> — өөрчлөхийн тулд
                      видеог дахин байршуулна.
                    </p>
                  </div>

                  <VideoUpload
                    target="episode"
                    targetId={ep.id}
                    currentStatus={ep.streamStatus}
                    streamProgress={ep.streamProgress}
                    streamError={ep.streamError}
                    onDone={onChange}
                  />

                  {/* ⚠️ Анги бүрд ТУСДАА хадмал — олон ангит киноны
                      анги бүр өөр орчуулгатай */}
                  <div className="mt-3">
                    <SubtitleManager kind="episode" targetId={ep.id} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Хоосон улирал задлахад юу хийхийг зааж өгнө */}
      {open && episodes.length === 0 && (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Анги байхгүй — дээрх «Анги нэмэх» товчийг дарна уу
        </p>
      )}
    </div>
  );
}

/** Ангийн видео төлөв — монгол нэршилтэй */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    READY: { label: 'Бэлэн', className: 'bg-success/15 text-success' },
    PROCESSING: { label: 'Боловсруулж байна', className: 'bg-warning/15 text-warning' },
    UPLOADED: { label: 'Дараалалд', className: 'bg-warning/15 text-warning' },
    FAILED: { label: 'Алдаа', className: 'bg-destructive/15 text-destructive' },
    NONE: { label: 'Видеогүй', className: 'bg-muted text-muted-foreground' },
  };
  const m = map[status] ?? map.NONE;
  return (
    <span className={cn('shrink-0 rounded px-2 py-0.5 text-[11px] font-medium', m.className)}>
      {m.label}
    </span>
  );
}
