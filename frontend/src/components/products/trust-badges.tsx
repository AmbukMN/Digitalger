'use client';

import { motion } from 'framer-motion';
import { Shield, Zap, Check, Infinity as InfinityIcon } from 'lucide-react';

interface TrustBadgesProps {
  /** compact: жижиг 2 баганат grid (sidebar/purchase-card-д тохиромжтой) */
  variant?: 'grid' | 'inline';
  className?: string;
}

const BADGES = [
  { icon: Shield, label: '100% аюулгүй төлбөр' },
  { icon: Zap, label: 'Шууд татах эрх' },
  { icon: Check, label: 'QPay баталгаатай' },
  { icon: InfinityIcon, label: 'Насан туршийн хандалт' },
] as const;

/**
 * Итгэлийн тэмдгүүд (trust badges) — checkout болон purchase-card-д ашиглах
 * reusable компонент. Бодит худалдан авалтын баталгааг харуулна (хуурамч тоо биш).
 * Brand #022179 navy primary өнгийг icon-д хэрэглэнэ.
 */
export function TrustBadges({ variant = 'grid', className = '' }: TrustBadgesProps) {
  return (
    <div
      className={`${
        variant === 'grid'
          ? 'grid grid-cols-2 gap-x-3 gap-y-2.5'
          : 'flex flex-wrap items-center gap-x-4 gap-y-2'
      } ${className}`}
    >
      {BADGES.map((badge, i) => {
        const Icon = badge.icon;
        return (
          <motion.div
            key={badge.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
            className="flex items-center gap-1.5"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <span className="text-xs font-medium text-muted-foreground leading-tight">
              {badge.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
