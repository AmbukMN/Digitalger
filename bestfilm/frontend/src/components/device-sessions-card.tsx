'use client';

import { useEffect, useState } from 'react';
import { Loader2, LogOut, Monitor, Smartphone, Tablet, MonitorSmartphone } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { api } from '@/lib/api';

/**
 * НЭВТЭРСЭН ТӨХӨӨРӨМЖИЙН ЖАГСААЛТ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: нэг эрхээр хязгаарлагдмал тооны төхөөрөмж
 * нэвтэрнэ. Хэрэглэгч «яагаад гарчихав?» гэж эргэлзэхгүйн тулд ХЭН
 * холбогдсоныг ХАРУУЛАХ ёстой — хязгаарыг зөвхөн чимээгүй хэрэгжүүлэх
 * нь дэмжлэгийн гомдол болдог.
 *
 * ⚠️ Хязгаарын тоог backend-ээс (`max`) авна — hardcode ХИЙХГҮЙ.
 * MAX_DEVICES өөрчлөгдвөл UI өөрөө дагана.
 */

interface DeviceSession {
  id: string;
  deviceName: string;
  ip: string | null;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}

interface SessionsResponse {
  max: number;
  items: DeviceSession[];
}

/** Төхөөрөмжийн нэрээс тохирох дүрс сонгоно */
function DeviceIcon({ name, className }: { name: string; className?: string }) {
  const s = name.toLowerCase();
  if (s.includes('iphone') || s.includes('android')) return <Smartphone className={className} />;
  if (s.includes('ipad')) return <Tablet className={className} />;
  if (s.includes('windows') || s.includes('mac') || s.includes('linux'))
    return <Monitor className={className} />;
  return <MonitorSmartphone className={className} />;
}

/**
 * Хэдэн хугацааны өмнө болохыг харуулна.
 * ⚠️ Сан нэмэхгүй — «2 цагийн өмнө» гэдэг нь огноо/цагаас илүү
 * ойлгомжтой (хэрэглэгч төхөөрөмжөө таних гол дохио).
 */
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'Яг одоо';
  if (m < 60) return `${m} минутын өмнө`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цагийн өмнө`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} өдрийн өмнө`;
  return new Date(iso).toLocaleDateString('mn-MN');
}

export function DeviceSessionsCard() {
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();

  const load = async () => {
    try {
      /**
       * ⚠️ `rt` — одоогийн refresh token. Backend түүгээр «энэ
       * төхөөрөмж» гэж тэмдэглэнэ, ингэснээр хэрэглэгч ӨӨРИЙГӨӨ
       * санамсаргүй гаргахгүй.
       */
      let rt: string | null = null;
      try {
        rt = localStorage.getItem('btv_refresh');
      } catch {
        /* storage хаалттай — «энэ төхөөрөмж» тэмдэг байхгүй, бусад нь ажиллана */
      }
      const res = await api<SessionsResponse>(
        `/auth/sessions${rt ? `?rt=${encodeURIComponent(rt)}` : ''}`,
      );
      setData(res);
    } catch {
      /* ⚠️ Чимээгүй — энэ карт нь НЭМЭЛТ мэдээлэл, унасан ч профайлын
         бусад хэсэг ажиллах ёстой */
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revoke = async (s: DeviceSession) => {
    const ok = await confirm({
      title: 'Төхөөрөмж гаргах уу?',
      description: `«${s.deviceName}» төхөөрөмж дахин нэвтрэх шаардлагатай болно.`,
      confirmLabel: 'Гаргах',
      tone: 'warning',
    });
    if (!ok) return;

    setBusy(s.id);
    try {
      await api(`/auth/sessions/${s.id}`, { method: 'DELETE' });
      toast.success('Төхөөрөмжийг гаргалаа');
      await load();
    } catch {
      toast.error('Гаргаж чадсангүй');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
        <div className="flex items-center gap-2">
          <MonitorSmartphone size={17} className="text-foreground/40" />
          <span className="text-sm font-semibold text-foreground/85">Нэвтэрсэн төхөөрөмж</span>
        </div>
        {/* ⚠️ Spinner БИШ skeleton — гүйдэг дугуй нь «гацсан» мэдрэмж өгдөг */}
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-foreground/6" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { max, items } = data;
  const full = items.length >= max;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MonitorSmartphone size={17} className="text-foreground/40" />
          <span className="text-sm font-semibold text-foreground/85">Нэвтэрсэн төхөөрөмж</span>
        </div>
        {/*
          ⚠️ «X / N» — хэрэглэгч хязгаарт хэр ойрхон байгаагаа НЭГ харцаар
          мэдэх ёстой. Дүүрсэн үед өнгө анхааруулна (улаан биш шар —
          алдаа биш, зүгээр л дүүрсэн).
        */}
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-bold tabular-nums',
            full ? 'bg-premium/15 text-premium' : 'bg-foreground/8 text-foreground/55',
          )}
        >
          {items.length} / {max}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((s) => (
          <div
            key={s.id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              s.current ? 'bg-primary/10 ring-1 ring-primary/25' : 'bg-black/20',
            )}
          >
            <DeviceIcon
              name={s.deviceName}
              className={cn('size-4.5 shrink-0', s.current ? 'text-primary' : 'text-foreground/40')}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground/90">
                  {s.deviceName}
                </span>
                {s.current && (
                  <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Энэ төхөөрөмж
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-foreground/45">
                {ago(s.lastUsedAt)}
                {s.ip && ` · ${s.ip}`}
              </p>
            </div>

            {/*
              ⚠️ Одоогийн төхөөрөмжид «Гаргах» товч ХАРУУЛАХГҮЙ — өөрийгөө
              гаргах нь энгийн гарах (logout) бөгөөд тэр товч дээр нь бий.
              Энд байвал зөвхөн андуурал төрүүлнэ.
            */}
            {!s.current && (
              <button
                onClick={() => void revoke(s)}
                disabled={busy === s.id}
                aria-label={`${s.deviceName} гаргах`}
                className="shrink-0 rounded-lg p-2 text-foreground/40 transition-colors hover:bg-destructive/12 hover:text-destructive disabled:opacity-50"
              >
                {busy === s.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <LogOut size={15} />
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {/*
        ⚠️ ТАЙЛБАР ЗААВАЛ — хязгаарыг УРЬДЧИЛАН мэдэгдэхгүй бол хэрэглэгч
        гэнэт гарахдаа «хакердуулсан» гэж бодож дэмжлэг рүү залгадаг.
      */}
      <p className="mt-3 text-[11px] leading-relaxed text-foreground/40">
        {full
          ? `Нэг эрхээр зэрэг ${max} төхөөрөмж ашиглана. Шинэ төхөөрөмжөөс нэвтэрвэл хамгийн удаан ашиглаагүй нь автоматаар гарна.`
          : `Нэг эрхээр зэрэг ${max} төхөөрөмж ашиглах боломжтой.`}
      </p>
    </div>
  );
}
