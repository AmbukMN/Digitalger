'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles, Trash2, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { SeasonsManager } from '@/components/seasons-manager';
import { AdminTopbar } from '@/components/admin-topbar';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import { useAdminGenres, useAdminTitle, type AdminSeason } from '@/lib/queries';
import { ImageUpload } from '@/components/image-upload';
import { VideoUpload } from '@/components/video-upload';
import { BackdropMediaUpload } from '@/components/backdrop-media-upload';
import { TmdbImportDialog, type TmdbImportResult } from '@/components/tmdb-import-dialog';
import { CastEditor, type CastEntry } from '@/components/cast-editor';
import { GalleryEditor, type GalleryEntry } from '@/components/gallery-editor';
import { genreId } from '@/lib/genre';
import { autoMetaDescription, autoMetaTitle, SEO_MIN_TITLE_LEN } from '@/lib/seo';

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
    /** ⚠️ Англи эх тайлбар (TMDB) — `description` нь МОНГОЛ орчуулга */
    descriptionEn: '',
    year: '',
    rating: '',
    director: '',
    ageRating: '',
    /** ⚠️ YouTube трейлерийн key — R2 HLS трейлерээс ТУСДАА */
    trailerYoutubeKey: '',
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
        descriptionEn: e.descriptionEn ?? '',
        year: e.year ? String(e.year) : '',
        rating: e.rating ? String(e.rating) : '',
        director: e.director ?? '',
        ageRating: e.ageRating ?? '',
        trailerYoutubeKey: e.trailerYoutubeKey ?? '',
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

  /**
   * ⚠️⚠️ SEO АВТОМАТ — гарчиг/тайлбар бичихэд талбарт ШУУД бичигдэнэ.
   *
   * Өмнө нь энэ хуудсанд автомат ОГТ БАЙХГҮЙ байсан тул (модалд л
   * байсан) эндээс хадгалсан кино SEO-ГҮЙ үлддэг байв.
   *
   * ⚠️ Гараар засвал ДАРЖ БИЧИХГҮЙ (`seoTouched`), хуучин контентын
   * хадгалсан SEO-г "гараар бичсэн" гэж үзнэ.
   * ⚠️ 600мс debounce + богино нэрийг алгасах — эс бөгөөс "Avatar"
   * бичихэд эхний "a" үсгээр SEO үүснэ (production дээр гарсан алдаа).
   */
  const seoTouched = useRef({ title: false, desc: false });
  useEffect(() => {
    if (form.title.trim().length < SEO_MIN_TITLE_LEN) return;
    const timer = setTimeout(() => {
      setForm((f) => {
        const next = { ...f };
        if (!seoTouched.current.title) next.metaTitle = autoMetaTitle(f.title, f.year);
        if (!seoTouched.current.desc) {
          next.metaDescription = autoMetaDescription(f.title, f.description);
        }
        return next;
      });
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, form.year, form.description]);

  /* ⚠️ Хуучин контент нээхэд хадгалсан SEO-г "гараар бичсэн" гэж үзнэ —
     эс бөгөөс дээрх автомат нь админы бичсэн текстийг ДАРЖ БИЧНЭ */
  useEffect(() => {
    if (isNew) { seoTouched.current = { title: false, desc: false }; return; }
    const e = existing as { metaTitle?: string; metaDescription?: string } | undefined;
    if (!e) return;
    seoTouched.current = {
      title: Boolean(e.metaTitle?.trim()),
      desc: Boolean(e.metaDescription?.trim()),
    };
  }, [existing, isNew]);

  const applyTmdbImport = (result: TmdbImportResult) => {
    setForm((f) => ({
      ...f,
      title: f.title || result.titleEn,
      description: result.description || f.description,
      /* ⚠️ Англи ЭХ хувилбар — орчуулга буруу гарвал тулгах эх сурвалж */
      descriptionEn: result.descriptionEn || f.descriptionEn,
      year: result.year ? String(result.year) : f.year,
      rating: result.rating ? String(result.rating) : f.rating,
      /* ⚠️ Найруулагч — TMDB `credits.crew`-ээс; гараар бичсэнийг хөндөхгүй */
      director: f.director || result.director || '',
      /**
       * ⚠️ SEO-г TMDB-ээс АВАХГҮЙ — backend хоосон буцаана.
       * Энэ хуудсанд SEO нь хадгалах үед `save()` дотор гарчиг+тайлбараас
       * үүсдэг тул энд хөндөх шаардлагагүй.
       */
      /* ⚠️ YouTube трейлер — манай HLS трейлерээс ТУСДАА талбар */
      trailerYoutubeKey: result.trailerYoutubeKey || f.trailerYoutubeKey,
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
          /**
           * ⚠️⚠️ `photoUrl` ЗААВАЛ — `CastEditor` ҮҮГЭЭР зураг харуулна.
           * Зөвхөн `photoKey` өгвөл R2-д зураг БАЙГАА мөртлөө хоосон
           * дүрс харагдана (bucket нь private тул key-гээр шууд болохгүй).
           */
          photoUrl: c.photoUrl ?? null,
        })),
      );
    }

    /* ⚠️ Юу орсныг ТОДОРХОЙ хэлнэ — админ дахин шалгах шаардлагагүй */
    const parts = [
      result.posterKey ? 'постер' : null,
      result.backdropKey ? 'backdrop' : null,
      result.cast?.length && cast.length === 0 ? `${result.cast.length} жүжигчин` : null,
      result.trailerYoutubeKey ? 'трейлер' : null,
      result.translated ? 'монгол орчуулга' : null,
    ].filter(Boolean);
    toast.success(parts.length ? `TMDB: ${parts.join(', ')} орлоо` : 'TMDB мэдээлэл орлоо');

    /**
     * ⚠️ AI орчуулга УНТРААЛТТАЙ бол админд ХЭЛНЭ — эс бөгөөс англи
     * тайлбар орсныг анзаарахгүй хадгалж, сайт дээр англиар гарна.
     */
    if (!result.translated && result.description) {
      toast.warning('AI орчуулга идэвхгүй — тайлбар АНГЛИ хэвээр байна', { duration: 7000 });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        title: form.title,
        description: form.description,
        descriptionEn: form.descriptionEn || undefined,
        year: form.year ? Number(form.year) : undefined,
        rating: form.rating ? Number(form.rating) : undefined,
        director: form.director || undefined,
        ageRating: form.ageRating || undefined,
        trailerYoutubeKey: form.trailerYoutubeKey || undefined,
        /**
         * ⚠️ SEO хоосон орхивол гарчиг/тайлбараас үүсгэнэ — кино бүр
         * SEO-той байх ёстой. Гараар бичсэн бол ХҮНДЭТГЭНЭ.
         * ⚠️ Богино нэрэнд утгагүй SEO үүсгэхгүй (`undefined` үлдээнэ).
         */
        metaTitle:
          form.metaTitle.trim() ||
          (form.title.trim().length >= SEO_MIN_TITLE_LEN
            ? autoMetaTitle(form.title, form.year)
            : undefined),
        metaDescription:
          form.metaDescription.trim() ||
          (form.title.trim().length >= SEO_MIN_TITLE_LEN
            ? autoMetaDescription(form.title, form.description)
            : undefined),
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
            16:9 hero зураг эсвэл трейлер видео сонгоно уу. Зураг WebP болгож автоматаар optimize хийнэ, видео HLS-рүv хөрвүүлэгдэнэ (1-3 мин).
          </p>
          <BackdropMediaUpload
            titleId={savedId ?? undefined}
            backdropUrl={backdropUrl}
            onBackdropChange={(k, u) => { setBackdropKey(k); setBackdropUrl(u); }}
            trailerAvailable={(existing as any)?.trailerUrl != null}
            onTrailerDone={() => qc.invalidateQueries({ queryKey: ['admin-title', savedId] })}
          />

          {/*
            ⚠️ YOUTUBE ТРЕЙЛЕР — TMDB-ээс автоматаар ирнэ.
            Дээрх R2 HLS трейлерээс ТУСДАА: HLS байхгүй үед л энийг тоглуулна.
          */}
          <div className="mt-4 border-t border-border pt-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Youtube size={15} /> YouTube трейлер
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              Манай трейлер байхгүй үед энийг тоглуулна. TMDB импортоор автоматаар бөглөгдөнө.
            </p>
            <input
              value={form.trailerYoutubeKey}
              onChange={(e) => {
                /* ⚠️ Бүтэн линк буулгасан ч key-г салгаж авна */
                const v = e.target.value.trim();
                const m = v.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
                setForm((f) => ({ ...f, trailerYoutubeKey: m?.[1] ?? v }));
              }}
              placeholder="dQw4w9WgXcQ эсвэл бүтэн линк"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            {form.trailerYoutubeKey && (
              <a
                href={`https://youtu.be/${form.trailerYoutubeKey}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-primary hover:underline"
              >
                youtu.be/{form.trailerYoutubeKey} — шалгах
              </a>
            )}
          </div>
        </div>

        <div className="admin-card mt-5 rounded-xl p-6">
          <label className="mb-1 block text-sm font-semibold text-foreground">Жүжигчид</label>
          <p className="mb-3 text-xs text-muted-foreground">Гол дүрүүдийг нэмээрэй — нэр, дүрийн нэр, зураг (заавал биш).</p>
          <CastEditor cast={cast} onChange={setCast} />
        </div>

        <div className="admin-card mt-5 rounded-xl p-6">
          <label className="mb-1 block text-sm font-semibold text-foreground">Зургийн цомог</label>
          <p className="mb-3 text-xs text-muted-foreground">Дэлгэрэнгүй хуудсанд харагдах нэмэлт screenshot/зурагнууд.</p>
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

/**
 * ⚠️⚠️ `SeasonsManager` / `SeasonBlock`-ыг ЭНДЭЭС ХАСАВ.
 *
 * Хоёр хувилбар зэрэг оршиж байсан: энэ inline хувилбар (try/catch,
 * loading төлөв, toast-гүй) болон `components/seasons-manager.tsx`
 * (бүгдтэй). Модалаар засвал toast гарч, хуудсаар засвал гардаггүй
 * байв — нэгийг засахад нөгөө нь мартагдана.
 *
 * Одоо `@/components/seasons-manager` НЭГ эх сурвалж.
 */
