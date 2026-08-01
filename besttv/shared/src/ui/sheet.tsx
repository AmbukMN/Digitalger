'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  side = 'right',
  className,
  children,
  title,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: 'right' | 'left';
  title?: string;
}) {
  const sideClass = side === 'right'
    ? 'inset-y-0 right-0 border-l sheet-right'
    : 'inset-y-0 left-0 border-r sheet-left';

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="sheet-overlay fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 h-full w-full max-w-md bg-background p-6 shadow-2xl border-border',
          sideClass,
          className,
        )}
        aria-describedby={undefined}
        {...props}
      >
        {title !== undefined && (
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        )}
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
          <X className="h-4 w-4" />
          <span className="sr-only">Хаах</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 pb-4', className)}
      {...props}
    />
  );
}

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;
