'use client';

import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * ⚠️ НУУЦ ҮГ ХАРАХ ТОВЧТОЙ INPUT — нэг эх сурвалж.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *
 * Нууц үг харагдахгүй тул хэрэглэгч буруу бичсэнээ мэдэхгүй. Админ
 * «нууц үг зөв хийсэн» гээд нэвтэрч чадахгүй байсан бодит тохиолдол
 * гарсан (2026-09-08) — үнэндээ нууц үг нь солигдсон байсан ч
 * шалгах ямар ч арга байгаагүй.
 *
 * ⚠️ Хуулбарлахгүй: `frontend/login`, `reset-password`,
 * `admin/profile` гурав нь ижил кодыг ГУРВАН ТУСДАА бичсэн байсан
 * (нийт 12 мөр × 3). Бусад 7 талбар нь товчгүй үлдсэн. Тиймээс
 * нэг компонент болгож бүгдэд хэрэглэнэ.
 *
 * ⚠️ `type` нь `password` ↔ `text` солигддог тул `autoComplete`-ыг
 * ЗААВАЛ дамжуул — эс бөгөөс browser-ийн нууц үг хадгалагч ажиллахаа
 * болино.
 *
 * ⚠️ `className`-д `pr-11` автоматаар нэмэгдэнэ (товчны зай). Дуудаж
 * буй тал өөрөө нэмэх шаардлагагүй.
 */
export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Товчны байрлалыг тохируулах (жишээ: `right-2`) */
  toggleClassName?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, toggleClassName, ...props }, ref) {
    const [show, setShow] = useState(false);
    const id = useId();

    return (
      <div className="relative">
        <input
          {...props}
          ref={ref}
          id={props.id ?? id}
          type={show ? 'text' : 'password'}
          className={cn('pr-11', className)}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Нууц үг нуух' : 'Нууц үг харах'}
          aria-pressed={show}
          className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2',
            'text-muted-foreground transition-colors hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            toggleClassName,
          )}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);
