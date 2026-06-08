'use client';

import { motion } from 'framer-motion';
import { Shield, Zap, Check, Infinity as InfinityIcon, PlayCircle, CalendarClock } from 'lucide-react';

interface TrustBadgesProps {
  /** grid: 2 баганат (sidebar/purchase-card), inline: нэг мөр (checkout) */
  variant?: 'grid' | 'inline';
  /** Видео хичээлтэй бүтээгдэхүүн эсэх — "Шууд татах"→"Шууд үзэх" болгоно */
  isVideoCourse?: boolean;
  /** Хандалтын төрөл — LIFETIME = насан туршийн, DAYS = хязгаартай хоног */
  accessType?: 'LIFETIME' | 'DAYS' | null;
  /** accessType=DAYS үед хандалтын хоног (90→3 сар, 180→6 сар, 365→1 жил) */
  accessDays?: number | null;
  /** ♾️ хандалтын badge-ийг нуух (purchase-card-д "Хандалт" мөр давхцахаас) */
  hideAccessBadge?: boolean;
  className?: string;
}

/** accessType/accessDays-аас хандалтын текстийг тооцоолно (purchase-card-д ч reuse) */
export function accessLabel(accessType?: 'LIFETIME' | 'DAYS' | null, accessDays?: number | null): string {
  if (accessType === 'DAYS' && accessDays && accessDays > 0) {
    if (accessDays % 365 === 0) {
      const years = accessDays / 365;
      return `${years} жилийн хандалт`;
    }
    if (accessDays % 30 === 0) {
      const months = accessDays / 30;
      return `${months} сарын хандалт`;
    }
    return `${accessDays} хоногийн хандалт`;
  }
  // LIFETIME эсвэл тодорхойгүй — насан туршийн
  return 'Насан туршийн хандалт';
}

/**
 * Итгэлийн тэмдгүүд (trust badges) — checkout болон purchase-card-д ашиглах
 * reusable компонент. Бодит худалдан авалтын баталгааг харуулна (хуурамч тоо биш).
 *
 * Eco/усан цэнхэр зөөлөн background — доорх "баталгааны мессеж" box-оос ялгарна,
 * толгой эргэхээс сэргийлнэ. accessType/isVideoCourse-аар динамик label.
 */
export function TrustBadges({
  variant = 'grid',
  isVideoCourse = false,
  accessType,
  accessDays,
  hideAccessBadge = false,
  className = '',
}: TrustBadgesProps) {
  const isDaysLimited = accessType === 'DAYS' && !!accessDays && accessDays > 0;

  const badges: { icon: typeof Shield; label: string }[] = [
    { icon: Shield, label: '100% аюулгүй төлбөр' },
    // Видео хичээл бол "Шууд үзэх", файл/template бол "Шууд татах эрх"
    isVideoCourse
      ? { icon: PlayCircle, label: 'Шууд үзэх' }
      : { icon: Zap, label: 'Шууд татах эрх' },
    { icon: Check, label: 'QPay баталгаатай' },
  ];

  // Хандалтын badge — purchase-card-д "Хандалт" мөртэй давхцвал нуух (hideAccessBadge)
  if (!hideAccessBadge) {
    badges.push(
      isDaysLimited
        ? { icon: CalendarClock, label: accessLabel(accessType, accessDays) }
        : { icon: InfinityIcon, label: 'Насан туршийн хандалт' },
    );
  }

  return (
    <div
      className={`${
        variant === 'grid'
          ? 'grid grid-cols-2 gap-x-3 gap-y-2.5'
          : 'flex flex-wrap items-center gap-x-4 gap-y-2'
      } ${className}`}
    >
      {badges.map((badge, i) => {
        const Icon = badge.icon;
        return (
          <motion.div
            key={badge.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
            className="flex items-center gap-1.5"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-teal-600 dark:bg-teal-400/15 dark:text-teal-400">
              <Icon className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <span className="text-xs font-medium text-foreground/70 leading-tight">
              {badge.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
