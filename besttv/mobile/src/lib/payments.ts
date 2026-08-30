import { useMutation, useQuery } from '@tanstack/react-query';
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
    mutationFn: (planId: string) =>
      api<QPayInvoice>('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({ planId }),
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
  return useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => api<{ paid: boolean }>(`/payments/${paymentId}/check`),
    enabled: !!paymentId,
    /* ⚠️ 3 сек — QPay-ийн баталгаажуулалт ихэвчлэн 5-15 сек авдаг.
       Түүнээс богино бол сервер дэмий ачаална. */
    refetchInterval: (q) => (q.state.data?.paid ? false : 3000),
    staleTime: 0,
  });
}
