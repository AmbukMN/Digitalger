import { cn } from '@besttv/shared';

/**
 * "ШИНЭ" тэмдэглэгээ — жагсаалтын мөрөнд тавина.
 *
 * ⚠️ ЯАГААД ТУСДАА КОМПОНЕНТ ВЭ: sidebar badge нь "3 шинэ" гэдгийг л
 * хэлдэг. Админ хуудас руу орохоор badge цэвэрлэгддэг ч ЯГ АЛЬ мөр шинэ
 * болохыг мэдэхгүй байв. Одоо хуудас бүр ижил харагдацтай тэмдэглэнэ —
 * хуудас тус бүрт markup хуулбарлавал загвар зөрөх нь гарцаагүй.
 *
 * Хэрэглэх: `const isNew = useNewSince('reviews')` → `{isNew(r.createdAt) && <NewBadge />}`
 */
export function NewBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-primary',
        className,
      )}
    >
      шинэ
    </span>
  );
}
