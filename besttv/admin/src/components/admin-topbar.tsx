import { NotificationBell } from './notification-bell';

export function AdminTopbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-md sm:gap-4 sm:px-8 sm:py-5">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
      </div>

      {/* Мэдэгдлийн хонх — бүх админ хуудсанд харагдана */}
      <NotificationBell />
    </div>
  );
}
