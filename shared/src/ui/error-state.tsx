import { AlertCircle } from 'lucide-react';
import { Button } from './button';
import { cn } from '../lib/utils';

export function ErrorState({
  title = 'Алдаа гарлаа',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-12 text-center',
        className,
      )}
    >
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold">{title}</h3>
      {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          Дахин оролдох
        </Button>
      )}
    </div>
  );
}
