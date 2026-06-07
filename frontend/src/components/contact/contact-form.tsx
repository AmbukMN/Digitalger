'use client';

import { useState, useCallback } from 'react';
import { Button, Input, Label } from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import { contactApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Send, User, Mail, Phone, MessageSquare } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 1-9 хооронд санамсаргүй тоо
function rand() {
  return Math.floor(Math.random() * 9) + 1;
}

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [captcha, setCaptcha] = useState(() => ({ a: rand(), b: rand() }));
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshCaptcha = useCallback(() => {
    setCaptcha({ a: rand(), b: rand() });
    setCaptchaAnswer('');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      toast.error('Нэрээ оруулна уу');
      return;
    }
    if (!trimmedEmail) {
      toast.error('И-мэйл хаягаа оруулна уу');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      toast.error('Зөв и-мэйл оруулна уу 📧');
      return;
    }
    if (!trimmedPhone) {
      toast.error('Утасны дугаараа оруулна уу');
      return;
    }
    // Зөвхөн цифрээр 6-8 орон шалгана
    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    if (phoneDigits.length < 6 || phoneDigits.length > 8) {
      toast.error('Утасны дугаар буруу байна (6-8 орон)');
      return;
    }
    if (!trimmedMessage) {
      toast.error('Зурвасаа бичнэ үү');
      return;
    }

    const answer = Number(captchaAnswer);
    if (!Number.isInteger(answer) || answer !== captcha.a + captcha.b) {
      toast.error('Баталгаажуулалтын тооцоо буруу байна');
      refreshCaptcha();
      return;
    }

    setLoading(true);
    try {
      await contactApi.submit({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        message: trimmedMessage,
        captchaA: captcha.a,
        captchaB: captcha.b,
        captchaAnswer: answer,
      });
      toast.success('Хүсэлт амжилттай илгээгдлээ! Удахгүй хариу өгнө.');
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      refreshCaptcha();
    } catch {
      toast.error('Илгээхэд алдаа гарлаа, дахин оролдоно уу');
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Бидэнд хүсэлт илгээх</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Доорх маягтыг бөглөөд илгээгээрэй — бид удахгүй хариу өгнө.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Нэр */}
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">
            Нэр <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Таны нэр"
              disabled={loading}
              autoComplete="name"
              className="pl-9"
            />
          </div>
        </div>

        {/* И-мэйл */}
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">
            И-мэйл <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="contact-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={loading}
              autoComplete="email"
              className="pl-9"
            />
          </div>
        </div>

        {/* Утас (заавал) */}
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">
            Утас <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="contact-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="99XXXXXX"
              disabled={loading}
              autoComplete="tel"
              className="pl-9"
            />
          </div>
        </div>

        {/* Зурвас */}
        <div className="space-y-1.5">
          <Label htmlFor="contact-message">
            Зурвас <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Асуулт, санал хүсэлтээ бичнэ үү..."
              disabled={loading}
              rows={5}
              className={cn(
                'flex min-h-[120px] w-full resize-y rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-sm',
                'transition-[colors,shadow,border-color] duration-150 ease-out',
                'placeholder:text-muted-foreground',
                'hover:border-border/80',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
          </div>
        </div>

        {/* Math captcha */}
        <div className="space-y-1.5">
          <Label htmlFor="contact-captcha">
            Баталгаажуулалт <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-3">
            <span
              className="select-none rounded-lg border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground"
              aria-hidden="true"
            >
              {captcha.a} + {captcha.b} = ?
            </span>
            <Input
              id="contact-captcha"
              type="text"
              inputMode="numeric"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Хариу"
              disabled={loading}
              aria-label={`${captcha.a} нэмэх ${captcha.b} хэдтэй тэнцэх вэ?`}
              className="w-28"
            />
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full font-semibold sm:w-auto">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Илгээж байна...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Хүсэлт илгээх
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
