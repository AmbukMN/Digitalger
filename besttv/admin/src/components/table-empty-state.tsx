import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Хүснэгт хоосон үеийн төлөв.
 *
 * ⚠️ `description` + `action` нь ЗААВАЛ БИШ ч ХЭРЭГТЭЙ: өмнө нь зөвхөн
 * icon + нэг мөр текст байсан тул шинэ админ "Жанр байхгүй байна" гэж
 * хараад ДАРАА НЬ ЮУ ХИЙХЭЭ мэдэхгүй байв ("нэмэх" товч нь хүснэгтээс
 * ГАДНА, дээд талд тусад нь байдаг тул нүд шууд холбохгүй).
 */
export function TableEmptyState({
  icon: Icon,
  message,
  description,
  action,
}: {
  icon: LucideIcon;
  message: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-muted-foreground">
      <Icon size={28} className="opacity-40" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {description && <p className="max-w-sm text-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
