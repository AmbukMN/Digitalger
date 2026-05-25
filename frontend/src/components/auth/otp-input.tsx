'use client';

import { useRef, useState, KeyboardEvent, ClipboardEvent } from 'react';
import { cn } from '@digitalger/shared';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function OtpInput({ length = 6, value, onChange, disabled, autoFocus }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, '').slice(0, length).split('');

  const focus = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const handleChange = (index: number, char: string) => {
    const d = char.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[index] = d;
    const newVal = next.join('').replace(/\s/g, '');
    onChange(newVal);
    if (d && index < length - 1) {
      focus(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = digits.slice();
        next[index] = '';
        onChange(next.join('').replace(/\s/g, ''));
      } else if (index > 0) {
        focus(index - 1);
        const next = digits.slice();
        next[index - 1] = '';
        onChange(next.join('').replace(/\s/g, ''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focus(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focus(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, length - 1);
    focus(focusIdx);
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[i] || ''}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'w-11 h-13 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all duration-150',
            'border-border bg-background text-foreground',
            'focus:border-primary focus:ring-2 focus:ring-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            digits[i] ? 'border-primary/60 bg-primary/5' : '',
          )}
          style={{ height: '52px', fontSize: '22px' }}
        />
      ))}
    </div>
  );
}
