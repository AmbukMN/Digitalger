'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Check,
  Clock,
  Crown,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Receipt,
  ShieldCheck,
  Ticket,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
/* ⚠️ `formatRentLeft as rentLeft` — доорх дуудлагууд хэвээр ажиллана */
import { cn, formatPrice, formatRentLeft as rentLeft } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { useAuth, hasPremium } from '@/lib/auth-store';
import { useMyPayments, useMyRentals, useWalletTransactions, type WalletTx } from '@/lib/queries';
import { useBankAccounts } from '@/lib/queries';
import { BankTransferModal } from '@/components/payment/bank-transfer-modal';
import { QPayCheckout, type QPayInvoice } from '@/components/payment/qpay-checkout';
import { EmailVerifyCard } from '@/components/email-verify-card';
import { DeviceSessionsCard } from '@/components/device-sessions-card';
import { loginUrl } from '@/lib/auth-intent';
import { api } from '@/lib/api';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PAID: { label: 'Төлсөн', className: 'bg-success/15 text-success' },
  PENDING: { label: 'Хүлээгдэж буй', className: 'bg-foreground/10 text-foreground/60' },
  FAILED: { label: 'Амжилтгүй', className: 'bg-destructive/15 text-destructive' },
  EXPIRED: { label: 'Хугацаа дууссан', className: 'bg-foreground/10 text-foreground/40' },
  CANCELLED: { label: 'Цуцалсан', className: 'bg-foreground/10 text-foreground/40' },
};

const TX_LABEL: Record<WalletTx['type'], { label: string; positive: boolean }> = {
  TOPUP: { label: 'Цэнэглэлт', positive: true },
  ADMIN_CREDIT: { label: 'Админ нэмсэн', positive: true },
  ADMIN_DEBIT: { label: 'Админ хассан', positive: false },
  PURCHASE: { label: 'Багц авсан', positive: false },
  REFUND: { label: 'Буцаалт', positive: true },
};

const TOPUP_PRESETS = [10000, 15000, 25000, 50000];

type Tab = 'profile' | 'wallet' | 'orders';

export default function ProfilePage() {
  const { user, loading, logout, updateProfile, changePassword, uploadAvatar, refreshMe } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const premium = hasPremium(user);
  /** ⚠️ VIP бол бүх ангилал нээлттэй — нэмэлт багц санал болгох утгагүй */
  const vip = (user?.subscriptions ?? []).some((s) => s.isVip);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  /**
   * ⚠️ URL-ээс таб — `?tab=wallet` руу чиглүүлэхэд ЯГ тэр таб нээгдэнэ.
   * Өмнө нь "үлдэгдэл хүрэлцэхгүй" үед зүгээр `/profile` руу явуулдаг тул
   * хэрэглэгч Профайл табан дээр буугаад ХААНААС цэнэглэхээ олдоггүй байв.
   */
  const initialTab = (useSearchParams().get('tab') ?? 'profile') as Tab;
  const [tab, setTabState] = useState<Tab>(
    ['profile', 'wallet', 'orders'].includes(initialTab) ? initialTab : 'profile',
  );

  /**
   * ⚠️ Таб солиход URL ч шинэчилнэ.
   *
   * Ингэснээр: (1) хэрэглэгч тухайн табын холбоосыг хуваалцаж болно,
   * (2) browser-ийн БУЦАХ товч табын хооронд ажиллана, (3) хуудас
   * дахин ачаалахад ижил таб үлдэнэ.
   *
   * ⚠️ `replace` (push БИШ) — таб солих бүрд түүх бөглөвөл буцах
   * товч 10 удаа дарж байж сайтаас гардаг болно.
   */
  const setTab = (t: Tab) => {
    setTabState(t);
    window.history.replaceState(null, '', t === 'profile' ? '/profile' : `/profile?tab=${t}`);
  };

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Имэйл солих — нууц үгээр баталгаажна (сошиал хаягт боломжгүй)
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [topupAmount, setTopupAmount] = useState('');
  /* ⚠️ Дансаар цэнэглэх — QPay-гүй хэрэглэгчдэд */
  const { data: bank } = useBankAccounts();
  const [bankTopup, setBankTopup] = useState<number | null>(null);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupQr, setTopupQr] = useState<QPayInvoice | null>(null);

  // ⚠️ isLoading ЗААВАЛ — өмнө нь ачаалж байхад `undefined` болж
  // "Гүйлгээ хийгдээгүй байна" гэсэн ХУДАЛ мэдэгдэл гардаг байсан
  const { data: payments, isLoading: paymentsLoading } = useMyPayments();
  const { data: walletTxs, isLoading: txsLoading } = useWalletTransactions();
  const { data: rentals } = useMyRentals(!!user);


  // Хуудаснаас гарахад polling үлдэхгүй
  useEffect(() => {
    return () => {
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push(loginUrl('/profile'));
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setNameInput(user.name ?? '');
      setEmailInput(user.email);
    }
  }, [user]);

  if (loading || !user) return <div className="min-h-screen bg-background" />;

  const initial = (user.name?.[0] ?? user.email[0]).toUpperCase();

  const saveName = async () => {
    setSavingName(true);
    try {
      await updateProfile({ name: nameInput });
      toast.success('Нэр хадгалагдлаа');
      setEditingName(false);
    } catch {
      toast.error('Алдаа гарлаа');
    } finally {
      setSavingName(false);
    }
  };

  /**
   * Имэйл солих.
   * ⚠️ Backend нь одоогийн нууц үг ЗААВАЛ шаардана — нээлттэй үлдсэн
   * session-ээр бүртгэл булаахаас сэргийлнэ. Сошиал хаягаар нэвтэрсэн
   * хэрэглэгч (нууц үггүй) имэйлээ солих боломжгүй.
   */
  const saveEmail = async () => {
    const next = emailInput.trim().toLowerCase();
    if (!next || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast.error('Имэйл хаяг буруу байна');
      return;
    }
    if (next === user.email) {
      setEditingEmail(false);
      return;
    }
    if (!emailPassword) {
      toast.error('Одоогийн нууц үгээ оруулна уу');
      return;
    }
    setSavingEmail(true);
    try {
      await updateProfile({ email: next, currentPassword: emailPassword });
      toast.success('Имэйл солигдлоо');
      setEditingEmail(false);
      setEmailPassword('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSavingEmail(false);
    }
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      toast.success('Зураг шинэчлэгдлээ');
    } catch {
      toast.error('Зураг upload амжилтгүй боллоо');
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submitPasswordChange = async () => {
    if (newPassword.length < 8) {
      toast.error('Шинэ нууц үг 8-с дээш тэмдэгттэй байх ёстой');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setChangingPassword(false);
      /**
       * ⚠️⚠️ Backend нь нууц үг солигдоход БҮХ session-ыг устгадаг
       * (халдлагчийн хуучин токен амьд үлдэхээс сэргийлнэ). Тиймээс
       * энэ төхөөрөмж ч мөн хүчингүй болсон.
       *
       * ⚠️ Тайлбаргүй гаргавал хэрэглэгч «эвдэрсэн юм болов уу» гэж
       * бодно — ЯАГААД гэдгийг ХЭЛЖ байж гаргана.
       */
      toast.success('Нууц үг солигдлоо. Аюулгүй байдлын үүднээс дахин нэвтэрнэ үү.');
      setTimeout(() => void logout(), 1800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSavingPassword(false);
    }
  };

  const refreshWallet = async () => {
    await Promise.all([
      refreshMe(),
      qc.invalidateQueries({ queryKey: ['wallet'] }),
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] }),
    ]);
  };

  const startTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount < 1000) {
      toast.error('Хамгийн бага дүн 1,000₮');
      return;
    }
    setTopupLoading(true);
    try {
      const res = await api<QPayInvoice & { devMode?: boolean }>('/payments/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      if (res.devMode) {
        toast.success('Хэтэвч цэнэглэгдлээ (dev mode)');
        setTopupAmount('');
        await refreshWallet();
        return;
      }
      // ⚠️ urls/qrText ЗААВАЛ — мобайл дээр банкны аппын deeplink үүсгэнэ
      setTopupQr({
        paymentId: res.paymentId,
        qrImage: res.qrImage,
        qrText: res.qrText,
        urls: res.urls,
        amount,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-28 md:px-8">
      <div className="mx-auto max-w-lg">
        {/* ── Толгой хэсэг ── */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div
              className={cn(
                'relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-black ring-4',
                premium ? 'bg-premium-solid text-premium-foreground ring-premium/25' : 'bg-primary text-primary-foreground ring-primary/25',
              )}
            >
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt="" fill sizes="64px" className="object-cover" />
              ) : (
                initial
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 size={18} className="animate-spin text-foreground" />
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Зураг солих"
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background shadow-md hover:scale-110"
            >
              <Camera size={12} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
          </div>

          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-foreground/14 bg-black/30 px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
                <button onClick={saveName} disabled={savingName} aria-label="Хадгалах" className="shrink-0 rounded-md p-1.5 text-success hover:bg-success/15">
                  {savingName ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                </button>
                <button onClick={() => setEditingName(false)} aria-label="Цуцлах" className="shrink-0 rounded-md p-1.5 text-foreground/40 hover:bg-foreground/10">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-xl font-bold text-foreground">{user.name ?? 'Хэрэглэгч'}</h1>
                <button onClick={() => setEditingName(true)} aria-label="Нэр засах" className="shrink-0 rounded-md p-1 text-foreground/30 hover:bg-foreground/10 hover:text-foreground/70">
                  <Pencil size={13} />
                </button>
              </div>
            )}
            <p className="truncate text-sm text-foreground/50">{user.email}</p>
          </div>
        </div>

        {/* ── Хэтэвчийн үлдэгдэл (үргэлж харагдана) ── */}
        <button
          onClick={() => setTab('wallet')}
          className="mt-6 flex w-full items-center justify-between rounded-2xl border border-foreground/10 bg-linear-to-br from-primary/12 to-transparent p-4 text-left transition-colors hover:border-primary/30"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Wallet size={17} />
            </span>
            <span>
              <span className="block text-xs text-foreground/45">Хэтэвчийн үлдэгдэл</span>
              <span className="block text-lg font-black text-foreground">{formatPrice(user.walletBalance)}</span>
            </span>
          </span>
          <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
            {tab === 'wallet' ? 'Гүйлгээ харах' : 'Цэнэглэх'}
          </span>
        </button>

        {/* ── Табууд ── */}
        <div className="mt-6 flex gap-1 rounded-xl bg-foreground/5 p-1">
          {([
            { id: 'profile', label: 'Профайл' },
            { id: 'wallet', label: 'Хэтэвч' },
            { id: 'orders', label: 'Захиалга' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                tab === t.id ? 'bg-foreground/12 text-foreground' : 'text-foreground/50 hover:text-foreground/80',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ПРОФАЙЛ таб ── */}
        {tab === 'profile' && (
          <div className="mt-5 space-y-5">
            {/* ⚠️ Имэйл баталгаажаагүй бол ЭХЭНД анхааруулна */}
            <EmailVerifyCard />
            <div
              className={cn(
                'rounded-2xl border p-5',
                premium ? 'border-premium/35 bg-linear-to-br from-premium/10 to-transparent' : 'border-foreground/10 bg-foreground/3',
              )}
            >
              <div className="flex items-center gap-2">
                <Crown size={17} className={premium ? 'text-premium' : 'text-foreground/40'} />
                <span className="text-sm font-semibold text-foreground/85">Идэвхтэй багц</span>
              </div>

              {user.subscriptions.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {user.subscriptions.map((s) => (
                    <div key={s.planId} className="rounded-lg bg-black/20 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                          {s.isVip && <Crown size={12} className="text-premium" />}
                          {s.planName}
                        </span>
                        <span className="text-xs text-foreground/45">
                          {new Date(s.expiresAt).toLocaleDateString('mn-MN')} хүртэл
                        </span>
                      </div>
                      {/* ⚠️ VIP нь бүх контентыг нээдэг тул бусад багц илүүдэл */}
                      {s.supersededByVip && (
                        <p className="mt-1 text-[11px] text-premium">
                          VIP багцад багтсан — энэ багц идэвхгүй
                        </p>
                      )}
                      {!s.isVip && s.genres.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {s.genres.map((g) => (
                            <span key={g.id} className="rounded bg-foreground/8 px-1.5 py-0.5 text-[11px] text-foreground/50">
                              {g.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-foreground/55">Одоогоор идэвхтэй багц байхгүй байна.</p>
              )}

              {/*
                ⚠️ ҮРГЭЛЖ харагдана (VIP-ээс бусад). Өмнө нь зөвхөн багцгүй
                хэрэглэгчид харагддаг байсан тул НЭГ багцтай хүн нэмэлт багц
                авах гарцгүй болж, зөвхөн footer-ийн линк үлддэг байв.
                VIP бол бүх ангилал нээлттэй тул илүүдэл.
              */}
              {!vip && (
                <Link
                  href="/pricing"
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-premium-solid py-2.5 text-sm font-bold text-premium-foreground transition-transform hover:scale-[1.01] hover:brightness-105"
                >
                  <Crown size={15} />
                  {user.subscriptions.length > 0 ? 'Багц нэмэх / сунгах' : 'Багц авах'}
                </Link>
              )}
            </div>

            {/*
              ⚠️ ТӨХӨӨРӨМЖ — багцын картын ЯГ ДАРАА. Хязгаар нь багцтай
              шууд холбоотой (нэг эрх = хэдэн төхөөрөмж) тул хэрэглэгч
              хоёуланг зэрэг хардаг байх ёстой.
            */}
            <DeviceSessionsCard />

            {/* Идэвхтэй түрээс — ширхэгээр авсан кинонууд */}
            {rentals && rentals.length > 0 && (
              <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
                <div className="flex items-center gap-2">
                  <Ticket size={17} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground/85">Түрээсэлсэн кино</span>
                </div>
                <div className="mt-3 space-y-2">
                  {rentals.map((r) => (
                    <Link
                      key={r.id}
                      href={`/movie/${r.title.slug}`}
                      className="flex items-center gap-3 rounded-lg bg-black/20 p-2.5 transition-colors hover:bg-black/35"
                    >
                      {/* ⚠️ `<img>` БИШ `next/image` — постер нь ихэвчлэн
                          500×750+, харин энд 40×56px-д шахагдана. 5 кино
                          түрээсэлсэн хүн ~1.5MB татдаг байсныг (хэрэгтэй
                          нь ~5KB) `sizes="40px"` шийднэ. */}
                      {r.title.posterUrl && (
                        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded">
                          <Image
                            src={r.title.posterUrl}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground/90">{r.title.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-foreground/45">
                          <Clock size={11} /> {rentLeft(r.expiresAt)} үлдлээ
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-foreground/40">{formatPrice(r.amount)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/3">
              {/* Имэйл — зөвхөн имэйл/нууц үгээр бүртгүүлсэн хэрэглэгч сольж чадна */}
              {editingEmail ? (
                <div className="p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground/80">
                    <Mail size={16} /> Имэйл солих
                  </p>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Шинэ имэйл"
                    aria-label="Шинэ имэйл"
                    className="w-full rounded-lg border border-foreground/14 bg-black/30 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/35 outline-none focus:border-primary"
                  />
                  <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Одоогийн нууц үг"
                    aria-label="Одоогийн нууц үг"
                    autoComplete="current-password"
                    className="mt-2 w-full rounded-lg border border-foreground/14 bg-black/30 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/35 outline-none focus:border-primary"
                  />
                  <p className="mt-2 text-xs text-foreground/40">
                    Аюулгүй байдлын үүднээс нууц үгээ баталгаажуулна уу
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={saveEmail}
                      disabled={savingEmail}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
                    >
                      {savingEmail && <Loader2 size={14} className="animate-spin" />} Хадгалах
                    </button>
                    <button
                      onClick={() => {
                        setEditingEmail(false);
                        setEmailInput(user.email);
                        setEmailPassword('');
                      }}
                      className="rounded-lg bg-foreground/8 px-4 py-2 text-sm text-foreground/70 hover:bg-foreground/12"
                    >
                      Болих
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-foreground/40">
                      <Mail size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-foreground/40">Имэйл хаяг</p>
                      <p className="truncate text-sm text-foreground/85">{user.email}</p>
                    </div>
                  </div>
                  {user.provider === 'LOCAL' && (
                    <button
                      onClick={() => setEditingEmail(true)}
                      className="shrink-0 rounded-lg bg-foreground/8 px-3 py-1.5 text-xs font-medium text-foreground/75 hover:bg-foreground/14"
                    >
                      Солих
                    </button>
                  )}
                </div>
              )}
              <InfoRow
                icon={<ShieldCheck size={16} />}
                label="Нэвтрэх төрөл"
                value={
                  user.provider === 'GOOGLE' ? 'Google' : user.provider === 'FACEBOOK' ? 'Facebook' : 'Имэйл'
                }
              />
            </div>

            {user.provider === 'LOCAL' && (
              <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
                <div className="flex items-center gap-2">
                  <KeyRound size={16} className="text-foreground/40" />
                  <span className="text-sm font-semibold text-foreground/85">Нууц үг</span>
                </div>

                {!changingPassword ? (
                  <button
                    onClick={() => setChangingPassword(true)}
                    className="mt-3 rounded-lg bg-foreground/8 px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-foreground/12"
                  >
                    Нууц үг солих
                  </button>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Одоогийн нууц үг"
                    aria-label="Одоогийн нууц үг"
                      className="w-full rounded-lg border border-foreground/14 bg-black/30 px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 outline-none focus:border-primary"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Шинэ нууц үг (8+ тэмдэгт)"
                    aria-label="Шинэ нууц үг"
                      className="w-full rounded-lg border border-foreground/14 bg-black/30 px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 outline-none focus:border-primary"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={submitPasswordChange}
                        disabled={savingPassword}
                        className="flex-1 rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"
                      >
                        {savingPassword ? <Loader2 size={15} className="mx-auto animate-spin" /> : 'Хадгалах'}
                      </button>
                      <button
                        onClick={() => { setChangingPassword(false); setCurrentPassword(''); setNewPassword(''); }}
                        className="rounded-lg bg-foreground/8 px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-foreground/12"
                      >
                        Цуцлах
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ХЭТЭВЧ таб ── */}
        {tab === 'wallet' && (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
              <p className="text-sm font-semibold text-foreground/85">Хэтэвч цэнэглэх</p>
              <p className="mt-1 text-xs text-foreground/45">QPay-ээр цэнэглээд багц худалдан авахад ашиглана</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {TOPUP_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(String(amt))}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      Number(topupAmount) === amt
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-foreground/8 text-foreground/70 hover:bg-foreground/12',
                    )}
                  >
                    {formatPrice(amt)}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="Дүн (₮)"
                  aria-label="Цэнэглэх дүн"
                  className="flex-1 rounded-lg border border-foreground/14 bg-black/30 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/35 outline-none focus:border-primary"
                />
                <button
                  onClick={startTopup}
                  disabled={topupLoading || !topupAmount}
                  className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"
                >
                  {topupLoading ? <Loader2 size={15} className="animate-spin" /> : 'Цэнэглэх'}
                </button>
              </div>

              {/*
                ⚠️⚠️ ДАНСААР ЦЭНЭГЛЭХ — QPay-гүй хэрэглэгчдэд.
                Дансаар төлөх боломж асаалттай атал ХЭТЭВЧИНД байхгүй
                байсан нь дутуу байв: хэрэглэгч багцыг дансаар авч
                чадаж байхад хэтэвчээ цэнэглэж чадахгүй.
              */}
              {bank?.enabled && (
                <button
                  onClick={() => {
                    const n = Number(topupAmount);
                    if (!Number.isFinite(n) || n < 1000) {
                      toast.error('Дүнг оруулна уу (хамгийн бага 1,000₮)');
                      return;
                    }
                    setBankTopup(Math.floor(n));
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-foreground/12 py-2 text-xs font-semibold text-foreground/55 transition-colors hover:border-foreground/25 hover:text-foreground/85"
                >
                  <Building2 size={13} />
                  Дансаар цэнэглэх
                </button>
              )}

              {/* QPay төлбөр — QR + мобайл дээр банкны аппын deeplink товчнууд */}
              {topupQr && (
                <QPayCheckout
                  invoice={topupQr}
                  subtitle="Хэтэвч цэнэглэх"
                  successText="Үлдэгдэл шинэчлэгдэж байна…"
                  onPaid={async () => {
                    setTopupAmount('');
                    await refreshWallet();
                    setTimeout(() => setTopupQr(null), 1500);
                  }}
                  onClose={() => setTopupQr(null)}
                />
              )}
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
              <p className="text-sm font-semibold text-foreground/85">Гүйлгээний түүх</p>

              {walletTxs?.length ? (
                <div className="mt-3 space-y-2">
                  {walletTxs.map((tx) => {
                    const meta = TX_LABEL[tx.type];
                    return (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                              meta.positive ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
                            )}
                          >
                            {meta.positive ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground/85">
                              {tx.planName ?? meta.label}
                            </p>
                            <p className="truncate text-xs text-foreground/40">
                              {new Date(tx.createdAt).toLocaleString('mn-MN')}
                              {tx.description && ` · ${tx.description}`}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn('text-sm font-bold', meta.positive ? 'text-success' : 'text-foreground/85')}>
                            {meta.positive ? '+' : ''}
                            {formatPrice(tx.amount)}
                          </p>
                          <p className="text-[11px] text-foreground/35">
                            Үлдэгдэл: {formatPrice(tx.balanceAfter)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : txsLoading ? (
                <div className="mt-3 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton-shimmer h-14 rounded-lg" />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-foreground/40">Гүйлгээ хийгдээгүй байна</p>
              )}
            </div>
          </div>
        )}

        {/* ── ЗАХИАЛГА таб ── */}
        {tab === 'orders' && (
          <div className="mt-5 rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-foreground/40" />
              <span className="text-sm font-semibold text-foreground/85">Захиалгын түүх</span>
            </div>

            {payments?.length ? (
              <div className="mt-3 space-y-2">
                {payments.map((p) => {
                  const st = STATUS_LABEL[p.status] ?? { label: p.status, className: 'bg-foreground/10 text-foreground/50' };
                  /**
                   * ⚠️⚠️ MOBILE-Д БАГАНААР ӨРНӨ (`flex-col`).
                   * Өмнө нь нэг эгнээнд нэр + үнэ + төлөв гурвуулаа шахагдаж,
                   * багцын нэр таслагдаж ("Монгол кино ..."), төлөвийн шошго
                   * картаас халиад эвгүй харагддаг байв.
                   * Одоо: нэр/огноо ДЭЭД мөр, үнэ+төлөв ДООД мөр.
                   * sm-ээс дээш хуучин нэг эгнээ хэвээр.
                   */
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col gap-1.5 rounded-lg bg-black/20 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground/85">{p.plan?.name ?? 'Хэтэвч цэнэглэлт'}</p>
                        <p className="text-[11px] leading-snug text-foreground/40 sm:text-xs">
                          {new Date(p.createdAt).toLocaleDateString('mn-MN')}
                          {p.couponCode && ` · Купон: ${p.couponCode}`}
                          {/* ⚠️ Админаас гараар олгосон эрх — төлбөр байхгүй */}
                          {p.grantedByAdmin && ' · Админаас олгосон'}
                          {p.grantedByAdmin && p.expiresAt &&
                            ` · ${new Date(p.expiresAt).toLocaleDateString('mn-MN')} хүртэл`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                        <span className="font-semibold text-foreground/85">
                          {p.grantedByAdmin ? 'Үнэгүй' : formatPrice(p.amount)}
                        </span>
                        <span className={cn('shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium sm:text-xs', st.className)}>
                          {st.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : paymentsLoading ? (
              <div className="mt-3 space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton-shimmer h-14 rounded-lg" />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-foreground/40">Захиалга хийгдээгүй байна</p>
            )}
          </div>
        )}

        {/* ⚠️ Дансаар цэнэглэх модал — QPay-тэй зэрэг нээгдэхгүй */}
        {bankTopup && bank?.enabled && (
          <BankTransferModal
            open
            info={bank}
            topupAmount={bankTopup}
            label={`Хэтэвч цэнэглэх — ${bankTopup.toLocaleString()}₮`}
            onClose={() => setBankTopup(null)}
            onClaimed={() => void refreshWallet()}
          />
        )}

        <button
          onClick={async () => {
            // Санамсаргүй дарахаас сэргийлж баталгаажуулна
            const ok = await confirm({
              title: 'Гарах уу?',
              description: 'Дахин үзэхийн тулд нэвтрэх шаардлагатай болно.',
              confirmLabel: 'Гарах',
              tone: 'warning',
            });
            if (!ok) return;
            logout();
            toast.success('Амжилттай гарлаа');
            router.push('/');
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground/6 py-3 font-semibold text-foreground/80 transition-colors hover:bg-destructive/15 hover:text-destructive"
        >
          <LogOut size={17} /> Гарах
        </button>
      </div>
    </main>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="text-foreground/35">{icon}</span>
      <span className="flex-1 text-sm text-foreground/50">{label}</span>
      <span className="text-sm font-medium text-foreground/85">{value}</span>
    </div>
  );
}

/* ⚠️ `rentLeft` ХАСАГДАВ — `@besttv/shared`-ийн `formatRentLeft`-тэй
   мөр мөрөөрөө ижил байв (доорх import-оор нэрлэн авав) */
