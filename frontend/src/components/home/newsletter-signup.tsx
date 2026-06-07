'use client';

import { useState } from 'react';
import { Input } from '@digitalger/shared/ui';
import { subscribersApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Mail, Send } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const value = email.trim();
    if (!value) {
      toast.error('Зөв и-мэйл оруулна уу');
      return;
    }
    if (!EMAIL_RE.test(value)) {
      toast.error('Зөв и-мэйл оруулна уу');
      return;
    }

    setLoading(true);
    try {
      await subscribersApi.subscribe({ email: value, source: 'homepage' });
      toast.success('Амжилттай бүртгэгдлээ! 10% хөнгөлөлтийн купоныг таны и-мэйл рүү илгээлээ 🎁');
      setEmail('');
    } catch {
      toast.error('Алдаа гарлаа, дахин оролдоно уу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full sm:w-auto">
      <div className="relative w-full sm:w-80">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#022179]/60" />
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="имэйл хаягаа оруулна уу"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          aria-label="Имэйл хаяг"
          className="h-12 border-white/50 bg-white pl-9 pr-12 text-[#022179] placeholder:text-[#022179]/50 focus-visible:ring-[#ffbe00]"
        />
        <button
          type="submit"
          disabled={loading}
          aria-label="Бүртгүүлэх"
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md bg-[#ffbe00] text-[#022179] transition-colors hover:bg-[#ffd84d] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </form>
  );
}
