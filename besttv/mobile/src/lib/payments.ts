import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/** Багц */
export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  isVip: boolean;
  features: string[];
  genres?: { genre: { id: string; name: string } }[];
}

/** ⚠️ Аппын тохиргоо — төлбөрийг АЛСААС унтраах боломжтой */
export interface AppConfig {
  minVersion: string;
  /**
   * ⚠️⚠️ Apple нь IAP-ийн дүрмээр QPay-г татгалзвал энэ тугийг
   * `false` болгож төлбөрийн дэлгэцийг АЛСААС хаана — апп дахин build
   * хийхгүй, дахин илгээлтийн 1–2 долоо хоног хэмнэнэ.
   */
  paymentsEnabled: boolean;
  webUrl: string;
  supportUrl: string;
}

/** QPay invoice — 22 банкны deeplink-тэй */
export interface QPayInvoice {
  paymentId: string;
  amount: number;
  /** QR-ийн текст (заримдаа хуулж ашиглана) */
  qrText: string;
  /** ⚠️ base64 PNG — `data:` угтвар БАЙХГҮЙ, өөрөө нэмнэ */
  qrImage: string;
  urls: { name: string; link: string; logo: string }[];
}

export function useConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: () => api<AppConfig>('/mobile/config'),
    /* ⚠️ 5 мин — алсаас унтраахад хэрэглэгч удаан хүлээхгүй */
    staleTime: 5 * 60_000,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => api<Plan[]>('/plans'),
    staleTime: 10 * 60_000,
  });
}

/** Багц худалдаж авах — QPay invoice үүсгэнэ */
export function useCreateInvoice() {
  return useMutation({
    mutationFn: (v: { planId: string; couponCode?: string }) =>
      api<QPayInvoice>('/payments/initiate', {
        method: 'POST',
        /* ⚠️ Хоосон купон илгээхгүй — сервер «буруу код» гэж татгалзана */
        body: JSON.stringify(
          v.couponCode ? { planId: v.planId, couponCode: v.couponCode } : { planId: v.planId },
        ),
      }),
  });
}

/**
 * КУПОН ШАЛГАХ.
 *
 * ⚠️ Хямдралыг ЭНД тооцохгүй — сервер эцсийн үнийг өөрөө бодно.
 * Энэ нь зөвхөн ХАРУУЛАХ зорилготой (хэрэглэгч төлөхийн өмнө хямдрал
 * хэр болохыг мэдэх ёстой).
 */
export interface CouponResult {
  code: string;
  discount: number;
  finalPrice: number;
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: (v: { code: string; price: number }) =>
      api<CouponResult>('/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: v.code.trim().toUpperCase(), price: v.price }),
      }),
  });
}

/**
 * ХЭТЭВЧЭЭР ТӨЛӨХ — QPay дамжихгүй, шууд үлдэгдлээс хасна.
 *
 * ⚠️ Хамгийн хурдан төлөлт: банкны апп руу шилжих, буцаж ирэх,
 * баталгаажуулалт хүлээх шаардлагагүй.
 */
export function usePurchaseWithWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { planId: string; couponCode?: string }) =>
      api<{ ok: boolean }>('/payments/wallet/purchase', {
        method: 'POST',
        body: JSON.stringify(
          v.couponCode ? { planId: v.planId, couponCode: v.couponCode } : { planId: v.planId },
        ),
      }),
    onSuccess: () => {
      /* ⚠️ Эрх ШУУД идэвхжинэ — профайл, хэтэвч, эрхийн мэдээлэл
         бүгдийг шинэчилнэ, эс бөгөөс хэрэглэгч «болоогүй» гэж бодно */
      void qc.invalidateQueries({ queryKey: ['wallet'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

/** ХЭТЭВЧ ЦЭНЭГЛЭХ — QPay invoice үүсгэнэ */
export function useTopup() {
  return useMutation({
    mutationFn: (v: { amount: number; method?: string }) =>
      api<QPayInvoice>('/payments/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: v.amount, ...(v.method ? { method: v.method } : {}) }),
      }),
  });
}

/**
 * Төлбөр төлөгдсөн эсэхийг шалгана.
 *
 * ⚠️⚠️ POLLING ЗААВАЛ: хэрэглэгч банкны апп руу шилжээд буцаж ирэхэд
 * төлбөр баталгаажсан эсэхийг МЭДЭХ ёстой. QPay-ийн webhook нь сервер
 * рүү ирдэг ч апп түүнийг сонсдоггүй.
 *
 * ⚠️ `enabled` — зөвхөн invoice байгаа үед. Дэмий polling нь батарей
 * иднэ.
 */
export function usePaymentStatus(paymentId: string | null) {
  /**
   * ⚠️⚠️ ХЯЗГААР — 10 минут.
   *
   * Өмнө нь `paid` болтол ҮҮРД 3 секунд тутам дуудна. Хэрэглэгч
   * төлөхгүй орхиод дэлгэцээ хаахгүй бол апп батарей, дата зарцуулсаар
   * байна. QPay-ийн invoice ч ойролцоо хугацаанд хүчингүй болдог.
   */
  const startedAt = useRef(Date.now());
  useEffect(() => {
    startedAt.current = Date.now();
  }, [paymentId]);

  return useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => api<{ paid: boolean }>(`/payments/${paymentId}/check`),
    enabled: !!paymentId,
    /* ⚠️ 3 сек — QPay-ийн баталгаажуулалт ихэвчлэн 5-15 сек авдаг.
       Түүнээс богино бол сервер дэмий ачаална. */
    refetchInterval: (q) => {
      if (q.state.data?.paid) return false;
      if (Date.now() - startedAt.current > 600_000) return false;
      return 3000;
    },
    staleTime: 0,
  });
}

/* ══════════ ТҮРЭЭС ══════════ */

export interface RentPrice {
  price: number;
  hours: number;
  /** ⚠️ Түрээс идэвхтэй эсэх — админ унтраасан байж болно */
  available: boolean;
}

/** Киноны түрээсийн үнэ — `available: false` бол UI харуулахгүй */
export function useRentPrice(titleId: string | undefined) {
  return useQuery({
    queryKey: ['rent-price', titleId],
    queryFn: () => api<RentPrice>(`/rentals/price/${titleId}`),
    enabled: !!titleId,
    staleTime: 5 * 60_000,
  });
}

/** Идэвхтэй түрээс — үлдсэн хугацаа харуулахад */
export function useMyRental(titleId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['rental', titleId],
    queryFn: () => api<{ expiresAt: string } | null>(`/rentals/mine/${titleId}`),
    /* ⚠️ Зөвхөн нэвтэрсэн үед — зочинд 401 */
    enabled: !!titleId && enabled,
    staleTime: 60_000,
  });
}

/**
 * ХЭТЭВЧЭЭР ТҮРЭЭСЛЭХ — QPay дамжихгүй, шууд идэвхжинэ.
 */
export function useRentWithWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (titleId: string) =>
      api<{ ok: boolean }>(`/rentals/${titleId}/wallet`, { method: 'POST' }),
    onSuccess: () => {
      /* ⚠️ Эрх ШУУД нээгдэнэ — киноны хуудас, хэтэвч шинэчилнэ */
      void qc.invalidateQueries({ queryKey: ['title'] });
      void qc.invalidateQueries({ queryKey: ['rental'] });
      void qc.invalidateQueries({ queryKey: ['wallet'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

/** QPay-ээр түрээслэх — банкны апп руу шилжинэ */
export function useRentWithQpay() {
  return useMutation({
    mutationFn: (titleId: string) =>
      api<QPayInvoice>('/payments/rental/initiate', {
        method: 'POST',
        body: JSON.stringify({ titleId }),
      }),
  });
}
