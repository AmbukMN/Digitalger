'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import {
  ADMIN_SITES,
  SITE_META,
  siteMeta,
  useSiteStore,
  type SiteScope,
} from '@/lib/site-store';

/**
 * ⚠️⚠️ САЙТ СОЛИХ ШИЛЖҮҮЛЭГЧ — админы БҮХ хуудсанд.
 *
 * Нэг админ панель хоёр сайтыг удирдана. Энэ шилжүүлэгчийн сонголт
 * нь `X-Site` толгойгоор БҮХ API дуудлагад явж, backend түүгээр
 * өгөгдлийг шүүнэ.
 *
 * ⚠️⚠️ ЯАГААД ЭНЭ НЬ МАШ ТОД БАЙХ ЁСТОЙ ВЭ:
 *
 * Админ аль сайтад ажиллаж байгаагаа мэдэхгүй бол BestTV-ийн
 * хэрэглэгчийг BestFilm-ийнх гэж бодоод УСТГАЖ болно. Тиймээс:
 *   · Сайтын өнгөөр ялгасан цэг (улаан / час улаан)
 *   · Нэрийг БҮТНЭЭР харуулна (товчлохгүй)
 *   · Сонгосон сайт нь идэвхтэй байхад чагт
 *
 * ⚠️ Гадуур дарах + Esc — заавал (UX дүрэм).
 */

export function SiteSwitcher({ allowAll = false }: { allowAll?: boolean }) {
  const site = useSiteStore((s) => s.site);
  const setSite = useSiteStore((s) => s.setSite);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /* ⚠️ Гадуур дарах + Esc — цэс нээлттэй үлдэж болохгүй */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /**
   * ⚠️ Хуудас `all` дэмждэггүй үед сонголт `all` байвал besttv руу
   * буцаана. Эс бөгөөс тэр хуудас 403 авна (`AllSitesGuard`).
   */
  useEffect(() => {
    if (!allowAll && site === 'all') setSite('besttv');
  }, [allowAll, site, setSite]);

  const meta = siteMeta(site);
  const options: SiteScope[] = allowAll ? [...ADMIN_SITES, 'all'] : [...ADMIN_SITES];

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-semibold text-foreground transition hover:bg-muted sm:px-3 sm:py-2"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Аль сайтын өгөгдөл харах вэ"
      >
        {site === 'all' ? (
          <Globe size={15} className="shrink-0 text-muted-foreground" />
        ) : (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: meta.color }}
            aria-hidden
          />
        )}
        <span className="hidden sm:inline">{meta.label}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          /* ⚠️ `.admin-dropdown` — төслийн БАЙГАА анимац (globals.css).
             Шинэ keyframes бичихгүй; `prefers-reduced-motion` ч хамрагдана. */
          className="admin-dropdown absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          {options.map((opt) => {
            const m = siteMeta(opt);
            const active = opt === site;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setSite(opt);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-muted ${
                  active ? 'bg-muted/60' : ''
                }`}
              >
                {opt === 'all' ? (
                  <Globe size={15} className="shrink-0 text-muted-foreground" />
                ) : (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: m.color }}
                    aria-hidden
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {m.label}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {m.domain}
                  </span>
                </span>
                {active && <Check size={15} className="shrink-0 text-primary" />}
              </button>
            );
          })}

          {allowAll && (
            <p className="border-t border-border px-3 py-2 text-[11px] leading-snug text-muted-foreground">
              ⚠️ «Бүх сайт» нь хоёулангийн дүнг нийлүүлж харуулна — засвар
              хийхэд тодорхой сайт сонго.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ⚠️ Сонгосон сайтыг ХУУДСАНД сануулах жижиг тэмдэг.
 *
 * Жагсаалт, дэлгэрэнгүй хуудсанд «энэ өгөгдөл аль сайтынх вэ»
 * гэдгийг эргэлзээгүй харуулна.
 */
export function SiteBadge({ className = '' }: { className?: string }) {
  const site = useSiteStore((s) => s.site);
  const m = siteMeta(site);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${className}`}
      style={{
        background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
        color: m.color,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}

export { SITE_META };
