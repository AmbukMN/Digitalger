/**
 * Хүснэгтийн skeleton — админ жагсаалтуудад.
 *
 * ⚠️⚠️ ЯАГААД SPINNER БИШ ВЭ (төслийн дүрэм):
 * Эргэлдэх дугуй нь "хэр удах вэ, юу ирэх вэ" гэдгийг ОГТ хэлдэггүй.
 * Skeleton нь (1) ирэх бүтцийг урьдчилж харуулж, (2) дата ирэхэд
 * layout ҮСЭРДЭГГҮЙ, (3) сэтгэл зүйн хувьд хурдан мэдрэгддэг.
 *
 * ⚠️ Багана/мөрийн тоог дуудагч тал өгнө — хүснэгт бүр өөр өргөнтэй тул
 * ижил skeleton хэрэглэвэл дата ирэхэд бүтэц үсэрнэ.
 */
export function TableSkeleton({
  rows = 8,
  cols = 5,
  /** Эхний баганад дугуй зураг (постер/аватар) байгаа эсэх */
  hasAvatar = false,
}: {
  rows?: number;
  cols?: number;
  hasAvatar?: boolean;
}) {
  return (
    <div className="divide-y divide-border" aria-busy aria-label="Ачаалж байна">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {hasAvatar && <div className="skeleton-shimmer h-9 w-9 shrink-0 rounded-full" />}
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="skeleton-shimmer h-4 rounded"
              style={{
                /* ⚠️ Багана бүр өөр өргөнтэй — жинхэнэ хүснэгт шиг
                   харагдана (бүгд ижил бол хиймэл мэдрэгдэнэ) */
                width: c === 0 ? '22%' : `${Math.max(8, 18 - c * 2)}%`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Картан хэлбэрийн жагсаалтад (чат, тохиргоо) */
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-busy aria-label="Ачаалж байна">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4">
          <div className="skeleton-shimmer h-4 w-1/3 rounded" />
          <div className="skeleton-shimmer mt-2 h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  );
}
