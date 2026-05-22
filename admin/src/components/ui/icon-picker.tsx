'use client';

import { useState, useMemo } from 'react';
import {
  File, FileText, FileCode, FileImage, FileVideo, FileAudio, FileArchive,
  BookOpen, BookMarked, Newspaper, PenLine, Pencil, ClipboardList,
  Video, Play, Music, Mic, Image, Images, Camera,
  Code, Terminal, Globe, Cpu, Database, Server, Cloud,
  Briefcase, Building, BarChart2, TrendingUp, PieChart, LineChart, DollarSign, CreditCard,
  GraduationCap, School, Award, Trophy, Star, Lightbulb,
  Layers, Layout, Palette,
  Package, Box, ShoppingBag, Tag, Gift, Gem,
  Wrench, Settings, Zap, Rocket, Shield, Lock, Key, Link,
  Map, MapPin, Navigation, Compass,
  User, Users, Heart, Smile,
  Folder, FolderOpen, Archive, Download, Upload, Share2, Search, Filter,
  Brush, Monitor, Smartphone, Headphones,
  Beef, Sprout, Utensils, Scissors, Factory, Plane, Milk, Wheat, FlaskConical,
  UtensilsCrossed, Shirt, Home, Car, TreePine, Fish, Egg, Cookie,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';

const ICON_COLORS = [
  'from-blue-500/20 to-blue-600/10 text-blue-600',
  'from-amber-500/20 to-amber-600/10 text-amber-600',
  'from-emerald-500/20 to-emerald-600/10 text-emerald-600',
  'from-violet-500/20 to-violet-600/10 text-violet-600',
  'from-rose-500/20 to-rose-600/10 text-rose-600',
  'from-cyan-500/20 to-cyan-600/10 text-cyan-600',
  'from-orange-500/20 to-orange-600/10 text-orange-600',
  'from-indigo-500/20 to-indigo-600/10 text-indigo-600',
];

/** icon нэрнээс тогтмол gradient color class буцаана */
export function iconColorClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ICON_COLORS[h % ICON_COLORS.length];
}

const ICON_LIST: { name: string; Icon: LucideIcon; label: string }[] = [
  // Файл & Документ
  { name: 'file', Icon: File, label: 'Файл' },
  { name: 'file-text', Icon: FileText, label: 'Текст файл' },
  { name: 'file-code', Icon: FileCode, label: 'Код файл' },
  { name: 'file-image', Icon: FileImage, label: 'Зургийн файл' },
  { name: 'file-video', Icon: FileVideo, label: 'Видео файл' },
  { name: 'file-audio', Icon: FileAudio, label: 'Аудио файл' },
  { name: 'file-archive', Icon: FileArchive, label: 'Архив файл' },
  // Контент
  { name: 'book-open', Icon: BookOpen, label: 'Ном' },
  { name: 'book-marked', Icon: BookMarked, label: 'Тэмдэглэсэн ном' },
  { name: 'newspaper', Icon: Newspaper, label: 'Сонин' },
  { name: 'pen-line', Icon: PenLine, label: 'Бичих' },
  { name: 'pencil', Icon: Pencil, label: 'Харандаа' },
  { name: 'clipboard-list', Icon: ClipboardList, label: 'Жагсаалт' },
  // Медиа
  { name: 'video', Icon: Video, label: 'Видео' },
  { name: 'play', Icon: Play, label: 'Тоглуулах' },
  { name: 'music', Icon: Music, label: 'Хөгжим' },
  { name: 'mic', Icon: Mic, label: 'Микрофон' },
  { name: 'image', Icon: Image, label: 'Зураг' },
  { name: 'images', Icon: Images, label: 'Зургийн цомог' },
  { name: 'camera', Icon: Camera, label: 'Камер' },
  { name: 'headphones', Icon: Headphones, label: 'Чихэвч' },
  // Технологи
  { name: 'code', Icon: Code, label: 'Код' },
  { name: 'terminal', Icon: Terminal, label: 'Терминал' },
  { name: 'globe', Icon: Globe, label: 'Интернэт' },
  { name: 'cpu', Icon: Cpu, label: 'Процессор' },
  { name: 'database', Icon: Database, label: 'Мэдээллийн сан' },
  { name: 'server', Icon: Server, label: 'Сервер' },
  { name: 'cloud', Icon: Cloud, label: 'Клауд' },
  { name: 'monitor', Icon: Monitor, label: 'Монитор' },
  { name: 'smartphone', Icon: Smartphone, label: 'Утас' },
  // Бизнес
  { name: 'briefcase', Icon: Briefcase, label: 'Хэрэг' },
  { name: 'building', Icon: Building, label: 'Байгууллага' },
  { name: 'bar-chart-2', Icon: BarChart2, label: 'Диаграм' },
  { name: 'trending-up', Icon: TrendingUp, label: 'Өсөлт' },
  { name: 'pie-chart', Icon: PieChart, label: 'Дугуй диаграм' },
  { name: 'line-chart', Icon: LineChart, label: 'Шугаман диаграм' },
  { name: 'dollar-sign', Icon: DollarSign, label: 'Мөнгө' },
  { name: 'credit-card', Icon: CreditCard, label: 'Карт' },
  // Боловсрол
  { name: 'graduation-cap', Icon: GraduationCap, label: 'Боловсрол' },
  { name: 'school', Icon: School, label: 'Сургууль' },
  { name: 'award', Icon: Award, label: 'Шагнал' },
  { name: 'trophy', Icon: Trophy, label: 'Цом' },
  { name: 'star', Icon: Star, label: 'Од' },
  { name: 'lightbulb', Icon: Lightbulb, label: 'Санаа' },
  // Дизайн
  { name: 'layers', Icon: Layers, label: 'Давхарга' },
  { name: 'layout', Icon: Layout, label: 'Загвар' },
  { name: 'palette', Icon: Palette, label: 'Өнгийн самбар' },
  { name: 'brush', Icon: Brush, label: 'Бийр' },
  // Бүтээгдэхүүн
  { name: 'package', Icon: Package, label: 'Багц' },
  { name: 'box', Icon: Box, label: 'Хайрцаг' },
  { name: 'shopping-bag', Icon: ShoppingBag, label: 'Дэлгүүр' },
  { name: 'tag', Icon: Tag, label: 'Шошго' },
  { name: 'gift', Icon: Gift, label: 'Бэлэг' },
  { name: 'gem', Icon: Gem, label: 'Эрдэнэ' },
  // Хэрэгсэл
  { name: 'wrench', Icon: Wrench, label: 'Багаж' },
  { name: 'settings', Icon: Settings, label: 'Тохиргоо' },
  { name: 'zap', Icon: Zap, label: 'Хурд' },
  { name: 'rocket', Icon: Rocket, label: 'Пуужин' },
  { name: 'shield', Icon: Shield, label: 'Хамгаалалт' },
  { name: 'lock', Icon: Lock, label: 'Түгжих' },
  { name: 'key', Icon: Key, label: 'Түлхүүр' },
  { name: 'link', Icon: Link, label: 'Линк' },
  // Газар зүй
  { name: 'map', Icon: Map, label: 'Газрын зураг' },
  { name: 'map-pin', Icon: MapPin, label: 'Байршил' },
  { name: 'navigation', Icon: Navigation, label: 'Навигаци' },
  { name: 'compass', Icon: Compass, label: 'Компас' },
  // Хүн
  { name: 'user', Icon: User, label: 'Хэрэглэгч' },
  { name: 'users', Icon: Users, label: 'Хэрэглэгчид' },
  { name: 'heart', Icon: Heart, label: 'Дуртай' },
  { name: 'smile', Icon: Smile, label: 'Инээмсэглэл' },
  // Бусад
  { name: 'folder', Icon: Folder, label: 'Хавтас' },
  { name: 'folder-open', Icon: FolderOpen, label: 'Нээлттэй хавтас' },
  { name: 'archive', Icon: Archive, label: 'Архив' },
  { name: 'download', Icon: Download, label: 'Татах' },
  { name: 'upload', Icon: Upload, label: 'Байршуулах' },
  { name: 'share-2', Icon: Share2, label: 'Хуваалцах' },
  { name: 'search', Icon: Search, label: 'Хайх' },
  { name: 'filter', Icon: Filter, label: 'Шүүлт' },
  // Хөдөө аж ахуй & хүнс
  { name: 'sheep', Icon: Beef, label: 'Мал (хонь/үхэр)' },
  { name: 'beef', Icon: Beef, label: 'Мах' },
  { name: 'milk', Icon: Milk, label: 'Сүү' },
  { name: 'sprout', Icon: Sprout, label: 'Тариалан' },
  { name: 'wheat', Icon: Wheat, label: 'Улаан буудай' },
  { name: 'tree-pine', Icon: TreePine, label: 'Мод' },
  { name: 'fish', Icon: Fish, label: 'Загас' },
  { name: 'egg', Icon: Egg, label: 'Өндөг' },
  { name: 'cookie', Icon: Cookie, label: 'Талх, боов' },
  // Хоол & ресторан
  { name: 'utensils', Icon: Utensils, label: 'Ресторан, хоол' },
  { name: 'utensils-crossed', Icon: UtensilsCrossed, label: 'Хоолны газар' },
  { name: 'flask-conical', Icon: FlaskConical, label: 'Дарс, ундаа' },
  // Үйлдвэр & барилга
  { name: 'factory', Icon: Factory, label: 'Үйлдвэр' },
  { name: 'home', Icon: Home, label: 'Орон сууц' },
  { name: 'car', Icon: Car, label: 'Авто' },
  // Оёдол
  { name: 'scissors', Icon: Scissors, label: 'Оёдол, нэхмэл' },
  { name: 'shirt', Icon: Shirt, label: 'Хувцас' },
  // Аялал
  { name: 'plane', Icon: Plane, label: 'Аялал' },
];

interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return ICON_LIST;
    return ICON_LIST.filter(
      (i) => i.name.includes(q) || i.label.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="space-y-2">
      <Input
        placeholder="Хайх... (жнэ: file, video, design)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-xs"
      />
      <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto rounded-lg border border-border p-1.5">
        <button
          type="button"
          title="Дүрсгүй"
          onClick={() => onChange('')}
          className={cn(
            'flex h-9 w-full items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-muted',
            !value && 'ring-2 ring-primary',
          )}
        >
          —
        </button>
        {filtered.map(({ name, Icon, label }, idx) => {
          const colorCls = ICON_COLORS[idx % ICON_COLORS.length];
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              title={label}
              onClick={() => onChange(name)}
              className={cn(
                'flex h-9 w-full items-center justify-center rounded-md transition-all hover:scale-110',
                `bg-linear-to-br ${colorCls}`,
                selected && 'ring-2 ring-primary scale-110',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
      {value && (() => {
        const found = ICON_LIST.find(i => i.name === value);
        if (!found) return null;
        const idx = ICON_LIST.indexOf(found);
        const colorCls = ICON_COLORS[idx % ICON_COLORS.length];
        return (
          <div className="flex items-center gap-2 mt-1">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br shrink-0', colorCls)}>
              <found.Icon className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">
              Сонгосон: <code className="bg-muted px-1 rounded">{value}</code>
            </p>
          </div>
        );
      })()}
    </div>
  );
}

/** Plain icon — icon only, no background */
export function LucideIcon({ name, className }: { name: string; className?: string }) {
  const found = ICON_LIST.find((i) => i.name === name);
  if (!found) return null;
  const { Icon } = found;
  return <Icon className={className} />;
}

/** Icon inside gradient circle — same look as frontend swiper cards */
export function IconBadge({
  name,
  size = 'md',
}: {
  name: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeMap = {
    sm: { wrap: 'h-7 w-7 rounded-md',  icon: 'h-3.5 w-3.5' },
    md: { wrap: 'h-9 w-9 rounded-lg',  icon: 'h-5 w-5' },
    lg: { wrap: 'h-12 w-12 rounded-xl', icon: 'h-6 w-6' },
  };
  const { wrap, icon } = sizeMap[size];
  const colorCls = name ? iconColorClass(name) : 'from-muted to-muted text-muted-foreground';
  const found = name ? ICON_LIST.find((i) => i.name === name) : null;
  return (
    <div className={cn('flex shrink-0 items-center justify-center bg-linear-to-br', wrap, colorCls)}>
      {found
        ? <found.Icon className={icon} />
        : <span className="text-[10px] font-bold">—</span>
      }
    </div>
  );
}
