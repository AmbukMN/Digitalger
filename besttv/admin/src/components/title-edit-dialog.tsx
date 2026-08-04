'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Clapperboard,
  Film,
  Image as ImageIcon,
  Info,
  Loader2,
  Save,
  Search,
  Sparkles,
  Tv,
  UploadCloud,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@besttv/shared/ui';
import { api } from '@/lib/api';
import { uploadVideo } from '@/lib/upload';
import { useAdminGenres, useAdminTitle } from '@/lib/queries';
import { ImageUpload } from '@/components/image-upload';
import { VideoUpload } from '@/components/video-upload';
import { BackdropMediaUpload } from '@/components/backdrop-media-upload';
import { TmdbImportDialog, type TmdbImportResult } from '@/components/tmdb-import-dialog';
import { CastEditor, type CastEntry } from '@/components/cast-editor';
import { GalleryEditor, type GalleryEntry } from '@/components/gallery-editor';
import { SeasonsManager } from '@/components/seasons-manager';
import { genreId } from '@/lib/genre';

const EMPTY_FORM = {
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
};

/** SEO meta title — 60 тэмдэгтэд багтаана (Google таслахгүй) */
function autoMetaTitle(title: string, year?: string): string {
  const base = year ? `${title} (${year})` : title;
  const full = `${base} — BestTV дээр онлайнаар үзэх`;
  return full.length <= 60 ? full : `${base} — BestTV`.slice(0, 60);
}

/** SEO meta description — 150-160 тэмдэгт (хайлтын хэсэгт таслагдахгүй) */
function autoMetaDescription(title: string, description: string): string {
  const clean = description.replace(/\s+/g, ' ').trim();
  if (clean.length >= 80) {
    return clean.length <= 160 ? clean : `${clean.slice(0, 157).trimEnd()}...`;
  }
  // Тайлбар богино бол бүтэн өгүүлбэр болгоно
  const filled = `${clean ? `${clean} ` : ''}${title} киног BestTV дээр өндөр чанартай, зар сурталчилгаагүй үзээрэй.`;
  return filled.length <= 160 ? filled : `${filled.slice(0, 157).trimEnd()}...`;
}

/**
 * Кино нэмэх-засах МОДАЛ.
 *
 * ⚠️ Видео болон улирал/анги нь `savedId` шаарддаг (backend-д title үүссэн
 * байх ёстой) тул ШИНЭ контент үүсгэх үед тэдгээр таб түгжээтэй — эхлээд
 * үндсэн мэдээллийг хадгална.
 */
export function TitleEditDialog({
  titleId,
  open,
  onClose,
}: {
  /** null = шинэ контент */
  titleId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: genres } = useAdminGenres();
  const { data: existing } = useAdminTitle(titleId ?? '');

  const [form, setForm] = useState(EMPTY_FORM);
  const [posterKey, setPosterKey] = useState<string | undefined>();
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [backdropKey, setBackdropKey] = useState<string | undefined>();
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  const [cast, setCast] = useState<CastEntry[]>([]);
  const [gallery, setGallery] = useState<GalleryEntry[]>([]);
  const [savedId, setSavedId] = useState<string | null>(titleId);
  /**
   * ⚠️ ШИНЭ контент дээр сонгосон видео — хадгалах хүртэл ЭНД хүлээнэ.
   * (Upload нь `targetId` шаарддаг, тэр нь title үүссэний дараа л гарна.)
   * Хадгалмагц `save()` автоматаар байршуулна.
   */
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [tmdbOpen, setTmdbOpen] = useState(false);
  const [tab, setTab] = useState('info');

  const isNew = !savedId;

  // Модал нээгдэх/контент солигдох бүрд формыг шинэчилнэ
  useEffect(() => {
    if (!open) return;
    setSavedId(titleId);
    setTab('info');
    if (!titleId) {
      setForm(EMPTY_FORM);
      setPosterKey(undefined);
      setPosterUrl(null);
      setBackdropKey(undefined);
      setBackdropUrl(null);
      setCast([]);
      setGallery([]);
    }
  }, [open, titleId]);

  // ⚠️ existing нь async ирнэ — ирмэгц формыг дүүргэнэ
  useEffect(() => {
    if (!existing || !titleId) return;
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
  }, [existing, titleId]);

  /**
   * ⚠️ SEO-г БОДИТООР бөглөнө (placeholder биш).
   *
   * Өмнө нь зөвхөн placeholder-т харуулж, хадгалах үед л утга үүсгэдэг
   * байсан тул админ "бөглөгдөхгүй байна" гэж ойлгодог байв. Одоо гарчиг/
   * тайлбар бичихэд талбарт ШУУД бичигдэнэ — харагдана, засаж болно.
   *
   * ⚠️ Гараар засвал ДАРЖ БИЧИХГҮЙ: `seoTouched` тэмдэглэнэ.
   */
  const seoTouched = useRef({ title: false, desc: false });

  useEffect(() => {
    if (!form.title.trim()) return;
    setForm((f) => {
      const next = { ...f };
      if (!seoTouched.current.title) next.metaTitle = autoMetaTitle(f.title, f.year);
      if (!seoTouched.current.desc) {
        next.metaDescription = autoMetaDescription(f.title, f.description);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, form.year, form.description]);

  /**
   * ⚠️ ХУУЧИН контент нээхэд хадгалсан SEO-г "гараар бичсэн" гэж үзнэ —
   * эс бөгөөс дээрх автомат нь админы бичсэн текстийг ДАРЖ БИЧНЭ.
   * Шинэ контент (titleId=null) дээр хоосон тул автомат ажиллана.
   */
  useEffect(() => {
    if (!open) return;
    if (!titleId) {
      seoTouched.current = { title: false, desc: false };
      return;
    }
    const e = existing as { metaTitle?: string; metaDescription?: string } | undefined;
    if (!e) return;
    seoTouched.current = {
      title: Boolean(e.metaTitle?.trim()),
      desc: Boolean(e.metaDescription?.trim()),
    };
  }, [open, titleId, existing]);

  const applyTmdb = (result: TmdbImportResult) => {
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
    toast.success('TMDB-ээс мэдээлэл татагдлаа');
  };

  const save = async (closeAfter = false) => {
    if (!form.title.trim()) {
      toast.error('Гарчиг оруулна уу');
      setTab('info');
      return;
    }
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
        /**
         * ⚠️ SEO АВТОМАТ — хоосон орхивол гарчиг/тайлбараас үүсгэнэ.
         * Гараар бичсэн бол ХҮНДЭТГЭНЭ (дарж бичихгүй). Ингэснээр кино
         * бүр SEO-той болж, админ нэмэлт ажил хийхгүй.
         */
        metaTitle: form.metaTitle.trim() || autoMetaTitle(form.title, form.year),
        metaDescription:
          form.metaDescription.trim() || autoMetaDescription(form.title, form.description),
        cast: cast
          .filter((c) => c.name.trim())
          .map((c) => ({ name: c.name, character: c.character || undefined, photoKey: c.photoKey })),
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

      let id = savedId;
      if (id) {
        await api(`/admin/titles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        const created = await api<{ id: string }>('/admin/titles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        id = created.id;
        setSavedId(id);
      }

      /**
       * ⚠️ ХҮЛЭЭЛГЭСЭН ВИДЕО — шинэ контент дээр сонгосон файлыг ЭНД
       * байршуулна. Өмнө нь эхлээд хадгалж, дараа нь модалыг дахин нээж
       * видео нэмэх ХОЁР алхамтай байсан. Одоо нэг удаад бүгд.
       */
      if (pendingVideo && id) {
        toast.success('Хадгалагдлаа — видео байршуулж байна...');
        try {
          await uploadVideo(pendingVideo, { target: 'movie', targetId: id }).promise;
          setPendingVideo(null);
        } catch {
          // uploadVideo өөрөө toast харуулна — контент аль хэдийн хадгалагдсан
          toast.error('Контент хадгалагдсан ч видео байршуулж чадсангүй');
        }
      } else {
        toast.success(savedId ? 'Хадгалагдлаа' : 'Үүсгэгдлээ');
      }

      await qc.invalidateQueries({ queryKey: ['admin-titles'] });
      if (id) await qc.invalidateQueries({ queryKey: ['admin-title', id] });
      if (closeAfter) onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалахад алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const toggleGenre = (id: string) =>
    setForm((f) => ({
      ...f,
      genreIds: f.genreIds.includes(id)
        ? f.genreIds.filter((g) => g !== id)
        : [...f.genreIds, id],
    }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 p-0">
        {/* ── Толгой ── */}
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              {form.type === 'SERIES' ? <Tv size={17} /> : <Clapperboard size={17} />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold text-foreground">
                {isNew ? 'Шинэ контент нэмэх' : form.title || 'Контент засах'}
              </span>
              <span className="block text-xs font-normal text-muted-foreground">
                {form.type === 'SERIES' ? 'Олон ангит' : 'Бүрэн хэмжээний кино'}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border px-6 pt-3">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="info">
                <Info size={13} className="mr-1.5" /> Мэдээлэл
              </TabsTrigger>
              <TabsTrigger value="media">
                <ImageIcon size={13} className="mr-1.5" /> Зураг
              </TabsTrigger>
              <TabsTrigger value="cast">
                <UsersIcon size={13} className="mr-1.5" /> Жүжигчид
              </TabsTrigger>
              <TabsTrigger value="video" disabled={isNew} title={isNew ? 'Эхлээд хадгална уу' : ''}>
                <Film size={13} className="mr-1.5" />
                {form.type === 'SERIES' ? 'Ангиуд' : 'Видео'}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Гүйлгэдэг агуулга ── */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {/* ═══ Мэдээлэл ═══ */}
            <TabsContent value="info" className="mt-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 rounded-lg bg-accent/50 p-1">
                  {(['MOVIE', 'SERIES'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors',
                        form.type === t
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t === 'MOVIE' ? <Clapperboard size={13} /> : <Tv size={13} />}
                      {t === 'MOVIE' ? 'Кино' : 'Олон ангит'}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setTmdbOpen(true)}
                  className="btn-secondary"
                  title="TMDB-ээс нэр, тайлбар, зураг татах"
                >
                  <Sparkles size={14} /> TMDB-ээс татах
                </button>
              </div>

              <Field label="Гарчиг" required>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Киноны нэр"
                  aria-label="Гарчиг"
                  className="admin-input"
                  autoFocus
                />
              </Field>

              <Field label="Тайлбар">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Агуулгын товч тайлбар"
                  rows={3}
                  aria-label="Тайлбар"
                  className="admin-textarea"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Он">
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                    placeholder="2024"
                    aria-label="Гарсан он"
                    className="admin-input"
                  />
                </Field>
                <Field label="Үнэлгээ (0-10)">
                  <input
                    type="number"
                    step="0.1"
                    max={10}
                    value={form.rating}
                    onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                    placeholder="8.5"
                    aria-label="Үнэлгээ"
                    className="admin-input"
                  />
                </Field>
                <Field label="Насны ангилал">
                  <select
                    value={form.ageRating}
                    onChange={(e) => setForm((f) => ({ ...f, ageRating: e.target.value }))}
                    aria-label="Насны ангилал"
                    className="admin-select"
                  >
                    <option value="">—</option>
                    {['G', 'PG', 'PG-13', '16+', '18+'].map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Найруулагч">
                  <input
                    value={form.director}
                    onChange={(e) => setForm((f) => ({ ...f, director: e.target.value }))}
                    placeholder="Нэр"
                    aria-label="Найруулагч"
                    className="admin-input"
                  />
                </Field>
              </div>

              {/* Жанр */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Жанр {form.genreIds.length > 0 && `(${form.genreIds.length})`}
                </p>
                {genres?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {genres.map((g) => {
                      const on = form.genreIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          onClick={() => toggleGenre(g.id)}
                          aria-pressed={on}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                            on
                              ? g.isAdult
                                ? 'border-destructive/50 bg-destructive/15 text-destructive'
                                : 'border-primary/50 bg-primary/15 text-primary'
                              : 'border-border text-muted-foreground hover:bg-accent',
                          )}
                        >
                          {g.isAdult && '🔞 '}
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Жанр байхгүй —{' '}
                    <a href="/genres" className="text-primary underline">
                      эхлээд үүсгэнэ үү
                    </a>
                  </p>
                )}
              </div>


              {/* Ширхэгээр түрээслэх — зөвхөн төлбөртэй кинонд утгатай */}
              {form.isPremium && (
                <div className="rounded-xl border border-border bg-card/40 p-4">
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
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted-foreground">
                          Түрээсийн үнэ (₮)
                        </span>
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
                        <span className="mb-1 block text-xs text-muted-foreground">
                          Хугацаа (цаг)
                        </span>
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

              {/* Тохиргоо */}
              <div className="flex flex-wrap gap-2">
                <Toggle
                  label="Төлбөртэй (эрхтэй үзнэ)"
                  checked={form.isPremium}
                  onChange={(v) => setForm((f) => ({ ...f, isPremium: v }))}
                />
                <Toggle
                  label="Нүүрний баннер"
                  checked={form.isBanner}
                  onChange={(v) => setForm((f) => ({ ...f, isBanner: v }))}
                />
                {form.isBanner && (
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                    Дараалал
                    <input
                      type="number"
                      value={form.bannerOrder}
                      onChange={(e) => setForm((f) => ({ ...f, bannerOrder: e.target.value }))}
                      aria-label="Баннерын дараалал"
                      className="w-16 rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </label>
                )}
                <Toggle
                  label="Удахгүй гарах"
                  checked={form.comingSoon}
                  onChange={(v) => setForm((f) => ({ ...f, comingSoon: v }))}
                />
                <Toggle
                  label="Идэвхтэй"
                  checked={form.isActive}
                  onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
              </div>

              {/* SEO */}
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                  <Search size={12} className="mr-1 inline" /> SEO — автоматаар бөглөгдөнө
                </summary>
                <div className="mt-3 space-y-3">
                  {/*
                    ⚠️ Гарчиг/тайлбар бичихэд эдгээр ШУУД бөглөгдөнө.
                    Гараар засвал автомат дарж бичихээ болино (seoTouched).
                  */}
                  <Field
                    label="Meta гарчиг"
                    hint={`${form.metaTitle.length}/60`}
                  >
                    <input
                      value={form.metaTitle}
                      onChange={(e) => {
                        // ⚠️ Гараар засав — цаашид автоматаар дарж бичихгүй
                        seoTouched.current.title = true;
                        setForm((f) => ({ ...f, metaTitle: e.target.value }));
                      }}
                      placeholder="Гарчиг бичихэд автоматаар үүснэ"
                      aria-label="Meta гарчиг"
                      className="admin-input"
                    />
                  </Field>
                  <Field
                    label="Meta тайлбар"
                    hint={`${form.metaDescription.length}/160`}
                  >
                    <textarea
                      value={form.metaDescription}
                      onChange={(e) => {
                        // ⚠️ Гараар засав — цаашид автоматаар дарж бичихгүй
                        seoTouched.current.desc = true;
                        setForm((f) => ({ ...f, metaDescription: e.target.value }));
                      }}
                      rows={2}
                      placeholder={
                        form.title
                          ? autoMetaDescription(form.title, form.description)
                          : '150-160 тэмдэгт — автоматаар үүснэ'
                      }
                      aria-label="Meta тайлбар"
                      className="admin-textarea"
                    />
                  </Field>
                </div>
              </details>
            </TabsContent>

            {/* ═══ Зураг ═══ */}
            <TabsContent value="media" className="mt-0 space-y-5">
              <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Постер (2:3)
                  </p>
                  <ImageUpload
                    kind="poster"
                    value={posterUrl}
                    onChange={(k, u) => {
                      setPosterKey(k);
                      setPosterUrl(u);
                    }}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Дэвсгэр зураг / Трейлер (16:9)
                  </p>
                  <BackdropMediaUpload
                    titleId={savedId ?? undefined}
                    backdropUrl={backdropUrl}
                    onBackdropChange={(k, u) => {
                      setBackdropKey(k);
                      setBackdropUrl(u);
                    }}
                    trailerAvailable={(existing as any)?.trailerUrl != null}
                    onTrailerDone={() =>
                      qc.invalidateQueries({ queryKey: ['admin-title', savedId] })
                    }
                  />
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Галерей
                </p>
                <GalleryEditor images={gallery} onChange={setGallery} />
              </div>
            </TabsContent>

            {/* ═══ Жүжигчид ═══ */}
            <TabsContent value="cast" className="mt-0">
              <CastEditor cast={cast} onChange={setCast} />
            </TabsContent>

            {/* ═══ Видео / Ангиуд ═══ */}
            <TabsContent value="video" className="mt-0">
              {!savedId ? (
                /*
                  ⚠️ ШИНЭ контент — файлыг ЭНД сонгоод хүлээлгэнэ, "Хадгалах"
                  дархад автоматаар байршина. Өмнө нь "эхлээд хадгална уу"
                  гээд бүтэн зогсоодог, админ модалыг хааж дахин нээх
                  шаардлагатай байсан.
                */
                form.type === 'MOVIE' ? (
                  <PendingVideoPicker file={pendingVideo} onPick={setPendingVideo} />
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Олон ангит — хадгалсны дараа улирал/анги нэмнэ
                  </p>
                )
              ) : form.type === 'MOVIE' ? (
                <VideoUpload
                  target="movie"
                  targetId={savedId}
                  currentStatus={(existing as any)?.streamStatus}
                  streamProgress={(existing as any)?.streamProgress}
                  streamError={(existing as any)?.streamError}
                  onDone={() => qc.invalidateQueries({ queryKey: ['admin-title', savedId] })}
                />
              ) : (
                <SeasonsManager titleId={savedId} />
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* ── Хөл — үргэлж харагдана ── */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3.5">
          <p className="text-xs text-muted-foreground">
            {isNew ? 'Хадгалсны дараа видео/анги нэмнэ' : 'Өөрчлөлт шууд хадгалагдана'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary" disabled={saving}>
              Хаах
            </button>
            <button onClick={() => save(false)} disabled={saving || !form.title} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </div>

        {tmdbOpen && (
          <TmdbImportDialog
            type={form.type === 'MOVIE' ? 'movie' : 'tv'}
            onImport={applyTmdb}
            onClose={() => setTmdbOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  /** Баруун талд жижиг тэмдэглэл — SEO-д тэмдэгтийн тоо харуулна */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </span>
        {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
        checked
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:bg-accent',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}

/**
 * ШИНЭ контент дээрх видео сонгогч.
 *
 * ⚠️ Яагаад тусдаа вэ: upload нь `targetId` (backend-д үүссэн title) шаарддаг,
 * тэр нь хадгалах хүртэл байхгүй. Тиймээс энд ЗӨВХӨН файлыг барьж аваад
 * хүлээлгэнэ — "Хадгалах" дархад `save()` автоматаар байршуулна.
 */
function PendingVideoPicker({
  file,
  onPick,
}: {
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = ''; // ижил файлыг дахин сонгож болно
        }}
      />

      {file ? (
        <div className="rounded-lg border border-primary/30 bg-primary/8 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Film size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(1)} MB · Хадгалахад автоматаар байршина
              </p>
            </div>
            <button
              type="button"
              onClick={() => onPick(null)}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-destructive"
              aria-label="Видео хасах"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/30 py-10 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <UploadCloud size={20} />
          Видео сонгох
          <span className="text-xs font-normal text-muted-foreground">
            Хадгалахад автоматаар байршиж, HLS хөрвүүлэлт эхэлнэ
          </span>
        </button>
      )}
    </div>
  );
}
