'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@digitalger/shared/ui';
import { Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';

// Нууц үг тохируулсан зочин "Зочноор нэвтрэх" дарахад гарах popup.
// localStorage-д hasPassword:true байгаа тул tempPassword байхгүй —
// хэрэглэгч өөрийн тохируулсан нууц үгээ оруулж хуучин account руугаа орно.
interface GuestPasswordPromptProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}

export function GuestPasswordPrompt({ open, onClose, onSubmit }: GuestPasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Нууц үгээ оруулна уу');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onSubmit(password);
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Нууц үг буруу байна');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Зочин нэвтрэх
          </DialogTitle>
          <DialogDescription>
            Та энэ төхөөрөмж дээр өмнө нь нууц үг тохируулсан байна. Хуучин зочин
            бүртгэл рүүгээ орохын тулд нууц үгээ оруулна уу.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Нууц үг</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                placeholder="Нууц үгээ оруулна уу"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Нэвтрэх'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
