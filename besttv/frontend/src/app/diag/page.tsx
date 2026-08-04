'use client';

import { useEffect, useState } from 'react';

/**
 * ⚠️ ТҮР ОНОШИЛГООНЫ ХУУДАС — /diag
 *
 * Нэвтрэлт зөвхөн ТУХАЙН browser дээр бүтэлгүйтэж байгаа тул (утсан дээр
 * ажилладаг) яг ямар өгөгдөл гацсаныг ХАРУУЛНА. Хэрэглэгч console руу
 * код хуулах шаардлагагүй — хуудас нээхэд л бүх зүйл харагдана.
 *
 * Асуудал шийдэгдмэгц ЭНЭ ХАВТСЫГ УСТГАНА.
 */
export default function DiagPage() {
  const [lines, setLines] = useState<string[]>(['Шалгаж байна…']);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    const out: string[] = [];
    const add = (s: string) => {
      out.push(s);
      setLines([...out]);
    };

    (async () => {
      out.length = 0;

      const cookieNames = document.cookie
        .split('; ')
        .filter(Boolean)
        .map((x) => x.split('=')[0]);
      add(`1) Cookie (JS-ээс харагдах): ${cookieNames.length ? cookieNames.join(', ') : '(байхгүй)'}`);

      const a = localStorage.getItem('btv_access');
      const r = localStorage.getItem('btv_refresh');
      add(
        `2) localStorage: access=${a ? a.slice(0, 16) + '…' : 'алга'} refresh=${r ? 'бий' : 'алга'} кэш=${localStorage.getItem('btv_user_cache') ? 'бий' : 'алга'}`,
      );

      let s: {
        user?: { email?: string };
        accessToken?: string;
        refreshToken?: string;
        expires?: string;
      } = {};
      try {
        s = await (await fetch('/api/auth/session')).json();
      } catch {
        add('3) session уншиж чадсангүй');
      }
      add(
        `3) NextAuth session: ${s?.user?.email ?? 'ХООСОН'} | токен ${s?.accessToken ? 'бий' : 'алга'} | refresh ${s?.refreshToken ? 'бий' : 'алга'}`,
      );

      if (s?.accessToken) {
        try {
          const p = JSON.parse(
            atob(s.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
          ) as { sub?: string; exp?: number };
          const expired = (p.exp ?? 0) * 1000 < Date.now();
          add(
            `4) session токен: sub=${p.sub} дуусах=${new Date((p.exp ?? 0) * 1000).toLocaleString('mn-MN')} ${expired ? '❌ ХУГАЦАА ДУУССАН' : '✅ хүчинтэй'}`,
          );
        } catch {
          add('4) session токен ЗАДРАХГҮЙ — эвдэрсэн');
        }
        const me = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${s.accessToken}` },
        });
        add(`5) session токеноор /auth/me → ${me.status} ${me.status === 401 ? '❌' : '✅'}`);
      }

      if (s?.refreshToken) {
        const rr = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: s.refreshToken }),
        });
        add(`6) session refresh → ${rr.status} ${rr.status >= 400 ? '❌ ХҮЧИНГҮЙ' : '✅'}`);
        if (rr.ok) {
          const nd = (await rr.json()) as { accessToken?: string };
          const m2 = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${nd.accessToken}` },
          });
          add(`7) шинэ токеноор /auth/me → ${m2.status} ${m2.status === 401 ? '❌ БУРУУ' : '✅ ЗӨВ'}`);
        }
      }

      if (a) {
        const me2 = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${a}` } });
        add(`8) localStorage токеноор /auth/me → ${me2.status} ${me2.status === 401 ? '❌' : '✅'}`);
      }

      // Build мэдээлэл — шинэ код ажиллаж байгаа эсэхийг батлана
      add(`9) Build: ${process.env.NEXT_PUBLIC_BUILD_MARK ?? '(тэмдэггүй)'}`);
      add('10) Дууслаа');
    })();
  }, []);

  /** Бүх нэвтрэлтийн ул мөрийг цэвэрлэнэ — гацсан төлөвөөс гарах баталгаатай зам */
  const hardReset = async () => {
    setFixing(true);
    try {
      localStorage.clear();
      sessionStorage.clear();
      // NextAuth session-ыг СЕРВЕР талд устгана (cookie-г browser өөрөө арилгана)
      const { csrfToken } = await (await fetch('/api/auth/csrf')).json();
      await fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrfToken, json: 'true' }),
      });
      // Үлдсэн cookie бүрийг хугацаа нь дуусгаж арилгана
      for (const c of document.cookie.split('; ')) {
        const name = c.split('=')[0];
        for (const d of ['', '; domain=.besttv.us', '; domain=besttv.us']) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
        }
      }
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <main className="min-h-screen bg-black p-6 font-mono text-sm text-white">
      <h1 className="mb-4 text-lg font-bold">BestTV — нэвтрэлтийн оношилгоо</h1>
      <pre className="whitespace-pre-wrap rounded-lg bg-white/5 p-4 leading-relaxed">
        {lines.join('\n')}
      </pre>
      <button
        onClick={hardReset}
        disabled={fixing}
        className="mt-5 rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
      >
        {fixing ? 'Цэвэрлэж байна…' : 'Бүгдийг цэвэрлээд дахин нэвтрэх'}
      </button>
      <p className="mt-3 text-xs text-white/50">
        Энэ товч localStorage, sessionStorage, бүх cookie болон NextAuth session-ийг
        устгаад /login руу аваачна.
      </p>
    </main>
  );
}
