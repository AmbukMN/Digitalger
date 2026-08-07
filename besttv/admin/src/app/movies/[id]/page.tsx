'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { api } from '@/lib/api';
import { useAdminGenres, useAdminTitle, type AdminSeason } from '@/lib/queries';
import { ImageUpload } from '@/components/image-upload';
import { VideoUpload } from '@/components/video-upload';
import { BackdropMediaUpload } from '@/components/backdrop-media-upload';
import { TmdbImportDialog, type TmdbImportResult } from '@/components/tmdb-import-dialog';
import { CastEditor, type CastEntry } from '@/components/cast-editor';
import { GalleryEditor, type GalleryEntry } from '@/components/gallery-editor';
import { genreId } from '@/lib/genre';

export default function TitleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();
  const qc = useQueryClient();
  const { data: genres } = useAdminGenres();
  const { data: existing } = useAdminTitle(id);

  const [form, setForm] = useState({
    type: 'MOVIE' as 'MOVIE' | 'SERIES',
    title: '',
    description: '',
    year: '',
    rating: '',
    director: '',
    ageRating: '',
    metaTitle: '',
    metaDescription: '',
    isPremium: true,
  rentEnabled: true,
  rentPrice: '',
  rentHours: '',
    isBanner: false,
    bannerOrder: '0',
    comingSoon: false,
    isActive: true,
    genreIds: [] as string[],
  });
  const [posterKey, setPosterKey] = useState<string | undefined>();
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [backdropKey, setBackdropKey] = useState<string | undefined>();
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  const [cast, setCast] = useState<CastEntry[]>([]);
  const [gallery, setGallery] = useState<GalleryEntry[]>([]);
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : id);
  const [saving, setSaving] = useState(false);
  const [tmdbOpen, setTmdbOpen] = useState(false);

  useEffect(() => {
    if (existing && !isNew) {
      const e = existing as any;
      setForm({
        type: e.type,
        title: e.title,
        description: e.description ?? '',
        year: e.year ? String(e.year) : '',
        rating: e.rating ? String(e.rating) : '',
        director: e.director ?? '',
        ageRating: e.ageRating ?? '',
        metaTitle: e.metaTitle ?? '',
        metaDescription: e.metaDescription ?? '',
        isPremium: e.isPremium,
        rentEnabled: e.rentEnabled ?? true,
        rentPrice: e.rentPrice != null ? String(e.rentPrice) : '',
        rentHours: e.rentHours != null ? String(e.rentHours) : '',
        isBanner: e.isBanner,
        bannerOrder: e.bannerOrder != null ? String(e.bannerOrder) : '0',
        comingSoon: e.comingSoon,
        isActive: e.isActive,
        genreIds: (e.genres ?? []).map(genreId).filter(Boolean),
      });
      setPosterKey(e.posterKey);
      setPosterUrl(e.posterUrl);
      setBackdropKey(e.backdropKey);
      setBackdropUrl(e.backdropUrl);
      setCast(e.cast ?? []);
      setGallery(
        (e.galleryUrls ?? []).map((url: string | null, i: number) => ({
          key: e.galleryKeys?.[i] ?? `gallery-${i}`,
          url,
        })),
      );
    }
  }, [existing, isNew]);

  const applyTmdbImport = (result: TmdbImportResult) => {
    setForm((f) => ({
      ...f,
      title: f.title || result.titleEn,
      description: result.description || f.description,
      year: result.year ? String(result.year) : f.year,
      rating: result.rating ? String(result.rating) : f.rating,
      genreIds: [
        ...f.genreIds,
        ...(genres ?? [])
          .filter((g) => result.genreNames.some((n) => n.toLowerCase() === g.name.toLowerCase()))
          .map((g) => g.id),
      ].filter((v, i, arr) => arr.indexOf(v) === i),
    }));
    if (result.posterKey) {
      setPosterKey(result.posterKey);
      setPosterUrl(result.posterUrl);
    }
    if (result.backdropKey) {
      setBackdropKey(result.backdropKey);
      setBackdropUrl(result.backdropUrl);
    }
    /**
     * ⚠️ ЖҮЖИГЧИД — нэр + дүр + ЗУРАГ автоматаар бөглөнө.
     * Өмнө нь TMDB-ээс ирдэг байсан ч ХЭРЭГЛЭГДЭХГҮЙ өнгөрдөг тул
     * админ 8 жүжигчийг нэг бүрчлэн гараар бичдэг байв.
     * ⚠️ Гараар оруулсан cast байвал ДАРЖ БИЧИХГҮЙ (админы ажил үрэгдэхгүй).
     */
    if (result.cast?.length && cast.length === 0) {
      setCast(
        result.cast.map((c) => ({
          name: c.name,
          character: c.character,
          photoKey: c.photoKey ?? undefined,
        })),
      );
    }
    /* ⚠️ Трейлер олдвол админд мэдэгдэнэ — R2 HLS-тэй ӨӨР тул гараар авна */
    if (result.trailerYoutubeKey) {
      toast.info(`TMDB трейлер олдлоо: youtu.be/${result.trailerYoutubeKey}`, { duration: 8000 });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        title: form.title,
        description: form.description,
        year: form.year ? Number(form.year) : undefined,
        rating: form.rating ? Number(form.rating) : undefined,
        director: form.director || undefined,
        ageRating: form.ageRating || undefined,
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
        cast: cast.filter((c) => c.name.trim()).map((c) => ({
          name: c.name,
          character: c.character || undefined,
          photoKey: c.photoKey,
        })),
        galleryKeys: gallery.map((g) => g.key),
        isPremium: form.isPremium,
        // ⚠️ Хоосон = сайтын нийтлэг үнэ/хугацаа хэрэглэнэ (null явуулна)
        rentEnabled: form.rentEnabled,
        rentPrice: form.rentPrice.trim() ? Number(form.rentPrice) : null,
        rentHours: form.rentHours.trim() ? Number(form.rentHours) : null,
        isBanner: form.isBanner,
        bannerOrder: form.bannerOrder ? Number(form.bannerOrder) : 0,
        comingSoon: form.comingSoon,
        isActive: form.isActive,
        genreIds: form.genreIds,
        posterKey,
        backdropKey,
      };

      if (savedId) {
        await api(`/admin/titles/${savedId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Хадгалагдлаа');
      } else {
        const created = await api<{ id: string }>('/admin/titles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSavedId(created.id);
        toast.success('Үүсгэгдлээ');
        router.replace(`/movies/${created.id}`);
      }
      qc.invalidateQueries({ queryKey: ['admin-titles'] });
      qc.invalidateQueries({ queryKey: ['admin-title', savedId] });
    } catch {
      toast.error('Хадгалахад алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell>
      <AdminTopbar
        title={isNew ? 'Шинэ контент нэмэх' : 'Контент засах'}
        subtitle={!isNew ? form.title : undefined}
      />

      {/* ⚠️ `max-w-3xl` нь өргөн дэлгэцэнд хэт нарийн — 5xl болгож,
          мобайлд padding багасгав */}
      <main className="mx-auto max-w-5xl p-4 pt-5 sm:p-8 sm:pt-6">
        {isNew && (
          <div className="mb-5 flex justify-end">
            <button
              onClick={() => setTmdbOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/70"
            >
              <Sparkles size={15} /> TMDB-ээс импорт
            </button>
          </div>
        )}

        {tmdbOpen && (
          <TmdbImportDialog
            type={form.type === 'MOVIE' ? 'movie' : 'tv'}
            onImport={applyTmdbImport}
            onClose={() => setTmdbOpen(false)}
          />
        )}

        <div className="admin-card rounded-xl p-6">
          <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
            <ImageUpload kind="poster" value={posterUrl} onChange={(k, u) => { setPosterKey(k); setPosterUrl(u); }} />

            <div className="space-y-3">
              <div className="flex gap-1.5 rounded-lg bg-accent/50 p-1 w-fit">
                {(['MOVIE', 'SERIES'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={cn(
                      'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                      form.type === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t === 'MOVIE' ? 'Нэг ангит' : 'Олон ангит'}
                  </button>
                ))}
              </div>

              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Гарчиг"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none transition-colors focus:border-primary"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Тайлбар"
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none transition-colors focus:border-primary"
              />
              <div className="flex gap-3">
                <input
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                  placeholder="Он"
                  className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none transition-colors focus:border-primary"
                />
                <input
                  value={form.rating}
                  onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                  placeholder="Үнэлгээ (0-10)"
                  className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none transition-colors focus:border-primary"
                />
                <select
                  value={form.ageRating}
                  onChange={(e) => setForm((f) => ({ ...f, ageRating: e.target.value }))}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none transition-colors focus:border-primary"
                >
                  <option value="">Насны ангилал</option>
                  <option value="G">G</option>
                  <option value="PG-13">PG-13</option>
                  <option value="16+">16+</option>
                  <option value="18+">18+</option>
                </select>
              </div>
              <input
                value={form.director}
                onChange={(e) => setForm((f) => ({ ...f, director: e.target.value }))}
                placeholder="Найруулагч"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="admin-card mt-5 rounded-xl p-6">
          <label className="mb-1 block text-sm font-semibold text-foreground">Backdrop &amp; Трейлер</label>
          <p className="mb-3 text-xs text-muted-foreground">
            16:9 hero зураг эсвэл трейлер видео сонгоно уу. Зураг WebP болгож автоматаар optimize хийнэ, видео HLS-рvv хөрвvvлэгдэнэ (1-3 мин).
          </p>
          <BackdropMediaUpload
            titleId={savedId ?? undefined}
            backdropUrl={backdropUrl}
            onBackdropChange={(k, u) => { setBackdropKey(k); setBackdropUrl(u); }}
            trailerAvailable={(existing as any)?.trailerUrl != null}
            onTrailerDone={() => qc.invalidateQueries({ queryKey: ['admin-title', savedId] })}
          />
        </div>

        <div className="admin-card mt-5 rounded-xl p-6">
          <label className="mb-1 block text-sm font-semibold text-foreground">Жүжигчид</label>
          <p className="mb-3 text-xs text-muted-foreground">Гол дvрvvдийг нэмээрэй — нэр, дvрийн нэр, зураг (заавал биш).</p>
          <CastEditor cast={cast} onChange={setCast} />
        </div>

        <div className="admin-card mt-5 rounded-xl p-6">
          <label className="mb-1 block text-sm font-semibold text-foreground">Зургийн цомог</label>
          <p className="mb-3 text-xs text-muted-foreground">Дэлгэрэнгvй хуудсанд харагдах нэмэлт screenshot/зурагнууд.</p>
          <GalleryEditor images={gallery} onChange={setGallery} />
        </div>

        <div className="admin-card mt-5 rounded-xl p-6">
          <label className="mb-1 block text-sm font-semibold text-foreground">SEO тохиргоо</label>
          <p className="mb-3 text-xs text-muted-foreground">Хайлтын систем болон social preview-д ашиглагдана.</p>
          <input
            value={form.metaTitle}
            onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))}
            placeholder="Meta title (хоосон бол автомат үүснэ)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
          <textarea
            value={form.metaDescription}
            onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))}
            placeholder="Meta description (хоосон бол тайлбараас автомат үүснэ)"
            rows={2}
            className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
        </div>

        <div className="admin-card mt-5 rounded-xl p-6">
          <label className="mb-3 block text-sm font-semibold text-foreground">Жанр</label>
          <div className="flex flex-wrap gap-2">
            {genres?.map((g) => {
              const active = form.genreIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      genreIds: active ? f.genreIds.filter((id) => id !== g.id) : [...f.genreIds, g.id],
                    }))
                  }
                  className={cn(
                    'rounded-full px-3 py-1 text-sm',
                    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ширхэгээр түрээслэх — зөвхөн төлбөртэй кинонд утгатай */}
        {form.isPremium && (
          <div className="admin-card mt-5 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Ширхэгээр түрээслэх</p>
                <p className="text-xs text-muted-foreground">
                  Багц авалгүй зөвхөн энэ киног хугацаатай үзэх боломж
                </p>
              </div>
              <Toggle
                label={form.rentEnabled ? 'Идэвхтэй' : 'Идэвхгүй'}
                checked={form.rentEnabled}
                onChange={(v) => setForm((f) => ({ ...f, rentEnabled: v }))}
              />
            </div>

            {form.rentEnabled && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">Түрээсийн үнэ (₮)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.rentPrice}
                    onChange={(e) => setForm((f) => ({ ...f, rentPrice: e.target.value }))}
                    placeholder="Хоосон = нийтлэг үнэ (4,900₮)"
                    className="admin-input"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">Хугацаа (цаг)</span>
                  <input
                    type="number"
                    min={1}
                    value={form.rentHours}
                    onChange={(e) => setForm((f) => ({ ...f, rentHours: e.target.value }))}
                    placeholder="Хоосон = нийтлэг (48ц)"
                    className="admin-input"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        <div className="admin-card mt-5 rounded-xl p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Toggle label="Premium" checked={form.isPremium} onChange={(v) => setForm((f) => ({ ...f, isPremium: v }))} />
            <Toggle label="Hero-д харуулах" checked={form.isBanner} onChange={(v) => setForm((f) => ({ ...f, isBanner: v }))} />
            {form.isBanner && (
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                Дараалал
                <input
                  type="number"
                  value={form.bannerOrder}
                  onChange={(e) => setForm((f) => ({ ...f, bannerOrder: e.target.value }))}
                  className="w-16 rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
            )}
            <Toggle label="Удахгүй гарах" checked={form.comingSoon} onChange={(v) => setForm((f) => ({ ...f, comingSoon: v }))} />
            <Toggle label="Идэвхтэй" checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
          </div>

          <button
            onClick={save}
            disabled={saving || !form.title}
            className="mt-5 rounded-lg bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
        </div>

        {savedId && form.type === 'MOVIE' && (
          <div className="admin-card mt-5 rounded-xl p-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Киноны видео</h2>
            <VideoUpload
              target="movie"
              targetId={savedId}
              currentStatus={(existing as any)?.streamStatus}
              streamProgress={(existing as any)?.streamProgress}
              streamError={(existing as any)?.streamError}
              onDone={() => qc.invalidateQueries({ queryKey: ['admin-title', savedId] })}
            />
          </div>
        )}

        {savedId && form.type === 'SERIES' && (
          <div className="admin-card mt-5 rounded-xl p-6">
            <SeasonsManager titleId={savedId} />
          </div>
        )}
      </main>
    </AdminShell>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
        checked ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
      )}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" />
      {label}
    </label>
  );
}

function SeasonsManager({ titleId }: { titleId: string }) {
  const { data: title, refetch } = useAdminTitle(titleId);
  const [newSeasonName, setNewSeasonName] = useState('');

  const addSeason = async () => {
    const number = (title?.seasons?.length ?? 0) + 1;
    await api(`/admin/titles/${titleId}/seasons`, {
      method: 'POST',
      body: JSON.stringify({ number, name: newSeasonName || undefined }),
    });
    setNewSeasonName('');
    refetch();
  };

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-foreground">Улирал / Ангиуд</h2>

      <div className="mb-4 flex gap-2">
        <input
          value={newSeasonName}
          onChange={(e) => setNewSeasonName(e.target.value)}
          placeholder="Улирлын нэр (заавал биш)"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <button onClick={addSeason} className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/70">
          <Plus size={15} /> Улирал нэмэх
        </button>
      </div>

      <div className="space-y-4">
        {title?.seasons?.map((s) => (
          <SeasonBlock key={s.id} season={s} onChange={refetch} />
        ))}
      </div>
    </div>
  );
}

function SeasonBlock({ season, onChange }: { season: AdminSeason; onChange: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const confirm = useConfirm();

  const addEpisode = async () => {
    const number = (season.episodes?.length ?? 0) + 1;
    await api(`/admin/titles/seasons/${season.id}/episodes`, {
      method: 'POST',
      body: JSON.stringify({ number }),
    });
    onChange();
    toast.success(`${number}-р анги нэмэгдлээ`);
  };

  const removeSeason = async () => {
    const episodeCount = season.episodes?.length ?? 0;
    const withVideo = (season.episodes ?? []).filter((e) => e.streamStatus === 'READY').length;
    const ok = await confirm({
      title: `${season.name ?? `${season.number}-р улирал`}-ыг устгах уу?`,
      description: `Энэ улирал ${episodeCount} ангитай${withVideo ? `, ${withVideo} нь видеотой` : ''}.`,
      bullets: [
        'Бүх анги устана',
        ...(withVideo ? ['Байршуулсан видео файлууд ч устана — сэргээх боломжгүй'] : []),
        'Хэрэглэгчдийн үзэлтийн явц алдагдана',
      ],
      confirmLabel: 'Улирлыг устгах',
      tone: 'danger',
    });
    if (!ok) return;
    await api(`/admin/titles/seasons/${season.id}`, { method: 'DELETE' });
    onChange();
    toast.success('Улирал устгагдлаа');
  };

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">{season.name ?? `${season.number}-р улирал`}</h3>
        <div className="flex gap-2">
          <button onClick={addEpisode} className="text-xs font-medium text-primary hover:underline">
            + Анги нэмэх
          </button>
          <button onClick={removeSeason} className="text-muted-foreground hover:text-destructive">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {season.episodes?.map((ep) => (
          <div key={ep.id} className="rounded-md bg-muted/40 p-3">
            <button
              onClick={() => setExpanded(expanded === ep.id ? null : ep.id)}
              className="flex w-full items-center justify-between text-sm"
            >
              <span className="text-foreground">
                {ep.number}. {ep.name ?? `Анги ${ep.number}`}
              </span>
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-xs',
                  ep.streamStatus === 'READY' && 'bg-success/15 text-success',
                  ep.streamStatus === 'PROCESSING' && 'bg-warning/15 text-warning',
                  ep.streamStatus === 'NONE' && 'bg-muted text-muted-foreground',
                )}
              >
                {ep.streamStatus}
              </span>
            </button>
            {expanded === ep.id && (
              <div className="mt-3">
                <VideoUpload
                  target="episode"
                  targetId={ep.id}
                  currentStatus={ep.streamStatus}
                  streamProgress={ep.streamProgress}
                  streamError={ep.streamError}
                  onDone={onChange}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
