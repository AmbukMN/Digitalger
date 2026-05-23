import { cn } from '@digitalger/shared';

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  className?: string;
}

export function PageHeader({ title, description, badge, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-10', className)}>
      {badge && (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
          {badge}
        </span>
      )}
      <div className="inline-block">
        <h1 className="text-3xl font-bold sm:text-4xl tracking-tight">{title}</h1>
        <div className="mt-2 h-1 w-full rounded-full bg-primary" />
      </div>
      {description && (
        <p className="mt-2 text-muted-foreground text-base sm:text-lg max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
