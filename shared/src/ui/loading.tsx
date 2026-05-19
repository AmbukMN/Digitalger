import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function Loading({
  label = 'Ачааллаж байна...',
  className,
  fullScreen,
}: {
  label?: string;
  className?: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        fullScreen && 'min-h-[40vh]',
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
