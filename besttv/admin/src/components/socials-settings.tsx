'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Facebook, Instagram, Loader2, Mail, Phone, Plus, Trash2, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSiteUrl } from '@/lib/site-store';

/** ⚠️ `platform` нь backend-ийн `SOCIAL_PLATFORMS`-тэй ЯГ ТААРНА */
type Platform = 'facebook' | 'instagram' | 'youtube' | 'twitter' | 'tiktok';

interface SocialLink {
  platform: Platform;
  url: string;
  label?: string;
}

interface Socials {
  facebook: string;
  instagram: string;
  youtube: string;
  twitter: string;
  tiktok: string;
  email: string;
  phone: string;
  links: SocialLink[];
}

const PLATFORMS: {
  key: Platform;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/besttv',
    icon: <Facebook size={15} />,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/besttv',
    icon: <Instagram size={15} />,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@besttv',
    icon: <Youtube size={15} />,
  },
  {
    key: 'twitter',
    label: 'X (Twitter)',
    placeholder: 'https://x.com/besttv',
    icon: <span className="text-sm font-black">𝕏</span>,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@besttv',
    icon: <span className="text-xs font-bold">TT</span>,
  },
];

const platformOf = (p: Platform) => PLATFORMS.find((x) => x.key === p)!;

/**
 * Сошиал сүлжээ / холбоо барих — footer-т харагдана.
 *
 * ⚠️⚠️ ОЛОН ХОЛБООС: нэг сүлжээнд ХЭДЭН Ч хаяг нэмнэ (ж: 2 Facebook
 * хуудас). Өмнө нь сүлжээ бүр ГАНЦ мөр байсан тул хоёр дахь хуудсаа
 * нэмэх ямар ч зам байгаагүй.
 *
 * ⚠️ Хоосон URL-тай мөрийг backend ХАЯНА — устгах товч дарахтай ижил.
 */
export function SocialsSettings() {
  /** ⚠️ Сонгосон сайтын домэйн — placeholder дэх hardcode-ыг орлоно */
  const { host: siteHost } = useSiteUrl();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-socials'],
    queryFn: () => api<Socials>('/admin/settings/socials'),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const [links, setLinks] = useState<SocialLink[]>([]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setLinks(data.links ?? []);
    setEmail(data.email ?? '');
    setPhone(data.phone ?? '');
  }, [data]);

  /* ⚠️ Хадгалах товчийг зөвхөн ӨӨРЧЛӨЛТТЭЙ үед идэвхжүүлнэ */
  const dirty =
    !!data &&
    (JSON.stringify(data.links ?? []) !== JSON.stringify(links) ||
      (data.email ?? '') !== email ||
      (data.phone ?? '') !== phone);

  const addLink = (platform: Platform) =>
    setLinks((s) => [...s, { platform, url: '' }]);

  const setLink = (i: number, patch: Partial<SocialLink>) =>
    setLinks((s) => s.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const removeLink = (i: number) => setLinks((s) => s.filter((_, idx) => idx !== i));

  const save = async () => {
    /* ⚠️ Хоосон мөр = устгах гэсэн үг (backend ч хаяна) */
    const clean = links.filter((l) => l.url.trim());

    // URL талбарууд http(s):// эхлэх ёстой (backend @IsUrl require_protocol)
    for (const l of clean) {
      if (!/^https?:\/\//i.test(l.url.trim())) {
        toast.error(`${platformOf(l.platform).label}: https:// -ээр эхлэх ёстой`);
        return;
      }
    }

    /**
     * ⚠️⚠️ НЭРИЙН ТАЛБАРТ URL БИЧСЭНИЙГ БАРИНА.
     *
     * БОДИТ АЛДАА: талбарын өргөн эвдэрсэн үед хэрэглэгч URL-ээ «ялгах
     * нэр» нүдэнд бичиж хадгалсан. Backend нь `label`-ыг чөлөөт текст
     * гэж үздэг тул ЧИМЭЭГҮЙ хадгалагдаж, footer дээр «Facebook ·
     * https://...» гэж эвгүй харагдана.
     *
     * Байрлалыг зассан ч давхар хамгаалалт үлдээв — нэг талбар эвдрэхэд
     * өгөгдөл бохирдох ёсгүй.
     */
    for (const l of clean) {
      if (l.label?.trim() && /^https?:\/\//i.test(l.label.trim())) {
        toast.error(
          `${platformOf(l.platform).label}: «Ялгах нэр» талбарт URL биш, нэр бичнэ үү (ж: Үндсэн)`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      await api('/admin/settings/socials', {
        method: 'PUT',
        body: JSON.stringify({
          links: clean.map((l) => ({
            platform: l.platform,
            url: l.url.trim(),
            ...(l.label?.trim() ? { label: l.label.trim() } : {}),
          })),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      qc.invalidateQueries({ queryKey: ['admin-socials'] });
      toast.success('Сошиал холбоос хадгалагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  /** Тухайн сүлжээнд хэдэн холбоос байгаа — ялгах нэрийн сануулга өгөхөд */
  const countOf = (p: Platform) => links.filter((l) => l.platform === p).length;

  return (
    <div className="admin-card rounded-xl p-6">
      <div>
        <h2 className="font-bold text-foreground">Сошиал сүлжээ / Холбоо барих</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Footer-т харагдана. Нэг сүлжээнд{' '}
          <strong className="text-foreground">хэдэн ч холбоос</strong> нэмж болно (ж: 2 Facebook
          хуудас).
        </p>
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Холбоосын жагсаалт ── */}
          <div className="mt-5 space-y-2.5">
            {links.length === 0 && (
              <p className="rounded-lg border border-dashed border-input px-3 py-6 text-center text-xs text-muted-foreground">
                Холбоос алга — доорх товчоор нэмнэ үү.
              </p>
            )}

            {links.map((l, i) => {
              const p = platformOf(l.platform);
              /* ⚠️ Ижил сүлжээ ОЛОН байвал ялгах нэр ХЭРЭГТЭЙ — эс бөгөөс
                 footer дээр хоёр ижил icon зэрэгцэж, аль нь юу болох нь
                 ойлгомжгүй болно. */
              const needsLabel = countOf(l.platform) > 1;
              return (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-lg border border-input bg-muted/20 p-2.5 sm:flex-row sm:items-center"
                >
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-foreground sm:w-28">
                    <span className="text-primary">{p.icon}</span>
                    {p.label}
                  </span>

                  {/*
                    ⚠️⚠️ САВААР ӨРГӨНИЙГ ЗАХИРНА — `admin-input` ДЭЭР БИШ.

                    БОДИТ АЛДАА: `.admin-input` нь globals.css-д `width:100%`
                    гэж тодорхойлогдсон тул Tailwind-ийн `flex-1` / `sm:w-44`
                    -ыг ДАРДАГ. Үр дүнд URL талбар жижиг, нэрийн талбар том
                    болж БАЙРЛАЛ ЭВДЭРЧ, хэрэглэгч URL-ээ буруу нүдэнд бичив
                    (label дотор URL хадгалагдсан — бодит гомдол).

                    Тиймээс өргөнийг ГАДНА талын `<div>`-ээр өгнө: input нь
                    савныхаа 100%-ийг эзэлнэ, сав нь flex-ийн дүрмийг дагана.
                  */}
                  <div className="min-w-0 flex-1">
                    <input
                      value={l.url}
                      onChange={(e) => setLink(i, { url: e.target.value })}
                      placeholder={p.placeholder}
                      className="admin-input"
                      aria-label={`${p.label} холбоосын хаяг`}
                    />
                  </div>

                  <div className="shrink-0 sm:w-44">
                    <input
                      value={l.label ?? ''}
                      onChange={(e) => setLink(i, { label: e.target.value })}
                      placeholder={needsLabel ? 'Ялгах нэр (ж: Үндсэн)' : 'Нэр (заавал биш)'}
                      className={`admin-input ${
                        needsLabel && !l.label?.trim() ? 'border-warning' : ''
                      }`}
                      aria-label={`${p.label} ялгах нэр`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    title="Устгах"
                    aria-label={`${p.label} холбоос устгах`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/40 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── Нэмэх товчнууд ── */}
          <div className="mt-3 flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => addLink(p.key)}
                className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus size={13} />
                <span className="text-primary">{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>

          {/* ── Холбоо барих ── */}
          <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="text-primary">
                  <Mail size={15} />
                </span>{' '}
                Холбоо барих имэйл
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`info@${siteHost}`}
                className="admin-input"
              />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="text-primary">
                  <Phone size={15} />
                </span>{' '}
                Утас
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+976 9911 2233"
                className="admin-input"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              Хадгалах
            </button>
          </div>
        </>
      )}
    </div>
  );
}
