'use client';

import * as React from 'react';
import { Toaster } from 'sonner';
import { ConfirmDialog, type ConfirmOptions } from './confirm-dialog';
import { PromptDialog, type PromptOptions } from './prompt-dialog';

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
type PromptFn = (options: PromptOptions) => Promise<string | null>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);
const PromptContext = React.createContext<PromptFn | null>(null);

/**
 * `window.confirm()`-ийн орлуулга — Promise буцаадаг модал.
 * ```tsx
 * const ok = await confirm({ title: 'Устгах уу?', tone: 'danger' });
 * ```
 */
export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm нь <UiProvider> дотор л ажиллана');
  return ctx;
}

/** `window.prompt()`-ийн орлуулга — Promise<string | null> */
export function usePrompt(): PromptFn {
  const ctx = React.useContext(PromptContext);
  if (!ctx) throw new Error('usePrompt нь <UiProvider> дотор л ажиллана');
  return ctx;
}

/**
 * Нэгдсэн UI provider — toast (sonner), confirm модал, prompt модал.
 * Admin болон frontend хоёулаа root layout-даа энэ нэгийг л ашиглана.
 */
export function UiProvider({
  children,
  theme = 'dark',
}: {
  children: React.ReactNode;
  theme?: 'dark' | 'light' | 'system';
}) {
  const [confirmState, setConfirmState] = React.useState<{
    open: boolean;
    options: ConfirmOptions | null;
    resolve: ((v: boolean) => void) | null;
  }>({ open: false, options: null, resolve: null });

  const [promptState, setPromptState] = React.useState<{
    open: boolean;
    options: PromptOptions | null;
    resolve: ((v: string | null) => void) | null;
  }>({ open: false, options: null, resolve: null });

  const confirm = React.useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ open: true, options, resolve });
      }),
    [],
  );

  const prompt = React.useCallback<PromptFn>(
    (options) =>
      new Promise<string | null>((resolve) => {
        setPromptState({ open: true, options, resolve });
      }),
    [],
  );

  const closeConfirm = (result: boolean) => {
    confirmState.resolve?.(result);
    setConfirmState((s) => ({ ...s, open: false, resolve: null }));
    // Хаагдах анимац дуустал options үлдээнэ (агуулга анивчихгүй)
    setTimeout(() => setConfirmState({ open: false, options: null, resolve: null }), 200);
  };

  const closePrompt = (result: string | null) => {
    promptState.resolve?.(result);
    setPromptState((s) => ({ ...s, open: false, resolve: null }));
    setTimeout(() => setPromptState({ open: false, options: null, resolve: null }), 200);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      <PromptContext.Provider value={prompt}>
        {children}

        <ConfirmDialog
          open={confirmState.open}
          options={confirmState.options}
          onConfirm={() => closeConfirm(true)}
          onCancel={() => closeConfirm(false)}
        />
        <PromptDialog
          open={promptState.open}
          options={promptState.options}
          onSubmit={(v) => closePrompt(v)}
          onCancel={() => closePrompt(null)}
        />

        <Toaster
          theme={theme}
          position="top-center"
          richColors
          closeButton
          duration={3500}
        />
      </PromptContext.Provider>
    </ConfirmContext.Provider>
  );
}
