import Link from 'next/link';

/**
 * ⚠️⚠️ ROUTE-ИЙН ДЭРГЭДЭХ `not-found.tsx` — root-ынх ХАНГАЛТГҮЙ байв.
 *
 * Киноны хуудсанд бодитоор хэмжсэн: `notFound()` дуудагдаж root
 * `app/not-found.tsx` рендерлэгдсэн МӨРТЛӨӨ HTTP статус **200**
 * үлдсэн. Шалтгаан: энэ route-д `loading.tsx` байгаа тул Next нь
 * STREAMING горимд ажиллаж, хариуны толгойг эрт илгээдэг.
 *
 * ⚠️ Root `app/not-found.tsx` нь бусад замд хэвээр ажиллана.
 */
export default function BlogNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-6xl font-black text-primary">404</h1>
      <p className="mt-3 text-foreground/70">Энэ нийтлэл олдсонгүй</p>
      <p className="mt-1 text-sm text-foreground/45">
        Устсан эсвэл хаяг нь буруу байж магадгүй.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/blog"
          className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:brightness-110"
        >
          Бүх нийтлэл
        </Link>
        <Link
          href="/"
          className="rounded-md border border-foreground/15 px-5 py-2.5 font-semibold text-foreground hover:bg-foreground/5"
        >
          Нүүр хуудас
        </Link>
      </div>
    </main>
  );
}
