'use client';

import { useState } from 'react';
import { ChevronDown, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
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

  const addSeason = async () => {
    setAdding(true);
    try {
      const number = seasons.length + 1;
      await api(`/admin/titles/${titleId}/seasons`, {
        method: 'POST',
        body: JSON.stringify({ number, name: newSeasonName.trim() || undefined }),
      });
      setNewSeasonName('');
      refetch();
      toast.success(`${number}-р улирал нэмэгдлээ`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Нэмж чадсангүй');
    } finally {
      setAdding(false);
    }
  };

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

      {seasons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">Улирал байхгүй байна</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            Дээрх товчоор эхний улирлаа нэмнэ үү
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {seasons.map((s) => (
            <SeasonBlock key={s.id} season={s} onChange={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}

function SeasonBlock({ season, onChange }: { season: AdminSeason; onChange: () => void }) {
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
              <h3>{season.name ?? `${season.number}-р улирал`}</h3>
              <Pencil size={11} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            {episodes.length} анги
            {readyCount > 0 && ` · ${readyCount} бэлэн`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
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

      {episodes.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {episodes.map((ep) => (
            <div key={ep.id} className="rounded-lg bg-accent/40 p-2.5">
              <button
                onClick={() => setExpanded(expanded === ep.id ? null : ep.id)}
                aria-expanded={expanded === ep.id}
                className="flex w-full items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                  <ChevronDown
                    size={13}
                    className={cn(
                      'shrink-0 text-muted-foreground transition-transform',
                      expanded === ep.id && 'rotate-180',
                    )}
                  />
                  <span className="truncate">
                    {ep.number}. {ep.name ?? `Анги ${ep.number}`}
                  </span>
                </span>
                <StatusBadge status={ep.streamStatus} />
              </button>

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
