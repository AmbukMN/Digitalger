'use client';

import { useState } from 'react';
import { Button, Input } from '@digitalger/shared/ui';
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
      toast.error('Имэйл хаягаа оруулна уу');
      return;
    }
    if (!EMAIL_RE.test(value)) {
      toast.error('Имэйл хаяг буруу байна 📧');
      return;
    }

    setLoading(true);
    try {
      await subscribersApi.subscribe({ email: value, source: 'homepage' });
      toast.success('Амжилттай бүртгэгдлээ! 🎉');
      setEmail('');
    } catch {
      toast.error('Алдаа гарлаа, дахин оролдоно уу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full sm:w-auto">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
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
            className="h-11 border-white/50 bg-white pl-9 text-[#022179] placeholder:text-[#022179]/50 focus-visible:ring-[#ffbe00]"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-11 shrink-0 font-bold bg-[#ffbe00] text-[#022179] hover:bg-[#ffd84d] disabled:opacity-70 dark:bg-[#ffbe00] dark:text-[#022179] dark:hover:bg-[#ffd84d]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Илгээж байна...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Илгээх
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
