import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * ⚠️⚠️ НЭВТРЭЛТ СЭРГЭЭХ "ГҮҮР" — NextAuth session → ШИНЭ backend JWT.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ (бодит гомдол):
 * NextAuth session cookie нь 30 ХОНОГ амьдардаг ч, түүн дотор хадгалагдсан
 * backend accessToken нь ердөө 15 МИНУТ бөгөөд `jwt` callback нь зөвхөн
 * ЭХНИЙ нэвтрэлтэд бичдэг тул ХЭЗЭЭ Ч ШИНЭЧЛЭГДДЭГГҮЙ.
 *
 * Иймд localStorage дахь хоёр токен хоёулаа хугацаа дуусахад:
 *   - refresh хийх боломжгүй (refresh ч хүчингүй)
 *   - session доторх токен ч аль эрт хуучирсан тул түүгээр ч сэргэхгүй
 * → хэрэглэгч session хүчинтэй БАЙХАД "нэвтрэх боломжгүй" гацдаг байв.
 *   (DevTools: btv_access, btv_refresh БАЙГАА ч /auth/me 401)
 *
 * Энэ route нь session-ийг СЕРВЕР ТАЛД баталгаажуулаад, backend-ээс
 * ЦОО ШИНЭ токен хос авч буцаана. Session хүчинтэй л бол хэрэглэгч
 * хэзээ ч гацахгүй.
 *
 * ⚠️ АЮУЛГҮЙ БАЙДАЛ: `getServerSession` нь NextAuth-ийн гарын үсэгтэй
 * cookie-г шалгана — хуурамчаар үүсгэх боломжгүй. Session-д байгаа
 * хэрэглэгчийн ID-аар л токен олгоно, өөр хэрэглэгчийнхийг олгохгүй.
 */
const BACKEND_URL = process.env.API_URL ?? 'http://localhost:4100';

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string; name?: string } | undefined;

  if (!user?.id || !user.email) {
    return NextResponse.json({ message: 'Session байхгүй' }, { status: 401 });
  }

  /**
   * Backend-ийн OAuth endpoint нь `providerAccountId`-аар хэрэглэгчийг
   * олж, ШИНЭ токен хос буцаана. Session-д provider хадгалагддаггүй тул
   * имэйлээр таниулна — backend нь имэйлээр аль хэдийн бүртгэлтэй
   * хэрэглэгчийг холбодог.
   */
  const res = await fetch(`${BACKEND_URL}/api/auth/oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'google',
      providerAccountId: user.id,
      email: user.email,
      name: user.name ?? undefined,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ message: 'Токен сэргээж чадсангүй' }, { status: 502 });
  }

  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  return NextResponse.json({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
}
