'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@digitalger/shared';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** Дээд тал tag тоо (заавал биш) */
  max?: number;
  className?: string;
}

/**
 * Tag/Keyword chip input — дахин ашиглах компонент.
 * Enter эсвэл таслал (,) дарахад chip нэмнэ.
 * Backspace хоосон input дээр сүүлийн chip-ийг устгана.
 * x дарж тус бүрийг устгана. Давхардсан tag нэмэхгүй.
 */
export function TagInput({
  value,
  onChange,
  placeholder = 'Бичээд Enter дарна уу...',
  max,
  className,
}: TagInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (max != null && value.length >= max) return;
    // case-insensitive давхардал шалгах
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setInput('');
      return;
    }
    onChange([...value, tag]);
    setInput('');
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      e.preventDefault();
      removeTag(value.length - 1);
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm transition-colors',
        'focus-within:outline-none focus-within:ring-1 focus-within:ring-ring',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-md border border-transparent bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground dark:bg-amber-100 dark:bg-amber-900/40"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
            className="rounded-full text-secondary-foreground/60 transition-colors hover:text-destructive"
            aria-label={`${tag} устгах`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-24 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
