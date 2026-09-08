import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-6xl font-black text-primary">404</h1>
      <p className="mt-3 text-foreground/70">Хайсан хуудас олдсонгүй</p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:brightness-110"
      >
        Нүүр рүү буцах
      </Link>
    </main>
  );
}
