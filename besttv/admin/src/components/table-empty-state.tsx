import type { LucideIcon } from 'lucide-react';

export function TableEmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
      <Icon size={28} className="opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
