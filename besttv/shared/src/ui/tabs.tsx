'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../lib/utils';

const Tabs = TabsPrimitive.Root;

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        /**
         * ⚠️ ТАБ НЬ БЛОК ДОТОР — хүрээ + дотоод дэвсгэр нь «нэг бүлэг»
         * гэдгийг харуулна. Хүрээгүй бол товчнууд зүгээр зэрэгцэж,
         * тусдаа элемент мэт харагдана.
         */
        'inline-flex h-11 items-center justify-center rounded-xl border border-border bg-muted/60 p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        /**
         * ⚠️⚠️ СОНГОГДСОН ТАБ «ДЭЭШ ГАРСАН» мэт харагдана.
         *
         * Өмнө нь зөвхөн `bg-background` + `shadow-sm` байсан тул
         * бараан горимд ялгаа БАРАГ мэдэгдэхгүй — админ аль табан
         * дээр байгаагаа андуурдаг байв.
         *
         * Одоо: илүү тод сүүдэр + хүрээ + өтгөн фонт.
         */
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium ring-offset-background transition-all hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-md',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
