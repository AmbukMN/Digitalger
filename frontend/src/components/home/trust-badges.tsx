import { Card, CardContent } from '@digitalger/shared/ui';
import { Download, Shield, Zap } from 'lucide-react';

const BADGES = [
  {
    icon: Zap,
    title: 'Нэн Даруй Татах',
    desc: 'Захиалга батлагдмагц нэн даруй файлд хандана',
  },
  {
    icon: Shield,
    title: 'Аюулгүй Төлбөр',
    desc: 'QPay-ийн баталгаат хамгаалалтаар, санаа зовох зүйлгүй',
  },
  {
    icon: Download,
    title: 'Баталгаат Чанар',
    desc: 'Бүх бүтээгдэхүүн шалгуур хангаж, чанараар баталгаажсан',
  },
];

export function TrustBadges() {
  return (
    <section className="border-y border-border bg-muted/20 py-12">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
        {BADGES.map((b) => (
          <Card key={b.title} className="border-0 bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center p-4 text-center">
              <b.icon className="mb-3 h-10 w-10 text-primary" />
              <h3 className="font-semibold">{b.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
