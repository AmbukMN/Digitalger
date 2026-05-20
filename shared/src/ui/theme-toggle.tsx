'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './theme-provider';
import type { Theme } from './theme-provider';

// Cycle: light → dark → system → light
const NEXT_THEME: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const THEME_LABEL: Record<Theme, string> = {
  light: 'Цайвар горим',
  dark: 'Харанхуй горим',
  system: 'Системийн горим',
};

const THEME_ICON: Record<Theme, React.FC<React.SVGProps<SVGSVGElement>>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

interface ThemeToggleProps {
  /** Compact variant — icon only, no label */
  iconOnly?: boolean;
  className?: string;
}

export function ThemeToggle({ iconOnly = true, className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const Icon = THEME_ICON[theme];
  const label = THEME_LABEL[theme];

  const handleClick = () => setTheme(NEXT_THEME[theme]);

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted text-muted-foreground hover:text-foreground ${className}`}
      >
        <Icon className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted ${className}`}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{label}</span>
    </button>
  );
}
