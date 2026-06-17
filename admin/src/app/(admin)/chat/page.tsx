'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Bot, MessageCircle, Send, User as UserIcon, X, Loader2, HeadphonesIcon,
} from 'lucide-react';
import {
  Avatar, Button, Card, CardContent, Dialog, DialogContent, DialogHeader,
  DialogTitle, ErrorState, Input, Loading,
} from '@digitalger/shared/ui';
import { adminApi, errMsg } from '@/lib/api';
import type { AdminChatListItem, AdminChatConversationDetail, AdminChatMessage } from '@/types/admin';

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Чат дэлгэрэнгүй modal (мессеж + хариу бичих + handoff toggle) ──────────
function ChatDetailDialog({
  convId, onClose, onChanged,
}: { convId: string | null; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'chat', 'detail', convId],
    queryFn: () => adminApi.chat.detail(convId!),
    enabled: !!convId,
    refetchInterval: convId ? 8000 : false, // нээлттэй үед хэрэглэгчийн шинэ мессеж автоматаар
  });

  useEffect(() => {
    if (data && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data]);

  const replyMut = useMutation({
    mutationFn: () => adminApi.chat.reply(convId!, reply.trim()),
    onSuccess: () => {
      setReply('');
      refetch();
      onChanged();
    },
    onError: (e) => toast.error(errMsg(e, 'Илгээхэд алдаа')),
  });

  const handoffMut = useMutation({
    mutationFn: (v: boolean) => adminApi.chat.handoff(convId!, v),
    onSuccess: () => { refetch(); onChanged(); },
    onError: (e) => toast.error(errMsg(e, 'Алдаа гарлаа')),
  });

  const conv: AdminChatConversationDetail | undefined = data;

  return (
    <Dialog open={!!convId} onOpenChange={(o) => { if (!o) { onClose(); qc.invalidateQueries({ queryKey: ['admin', 'chat'] }); } }}>
      <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col p-0">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-primary" />
            {conv?.user?.name || conv?.userName || 'Зочин'}
            {conv?.handedOff && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Багтай ярьж байна
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? <Loading className="py-10" /> : isError ? (
          <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />
        ) : (
          <>
            {/* Мессежүүд */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
              {conv?.messages.map((m: AdminChatMessage) => {
                const isUser = m.role === 'user';
                const isAdmin = m.role === 'admin';
                return (
                  <div key={m.id} className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isAdmin ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-muted text-primary'}`}>
                        {isAdmin ? <HeadphonesIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </div>
                    )}
                    <div className={`flex max-w-[78%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                      {isAdmin && <span className="px-1 text-[10px] font-semibold text-green-600">Багийн гишүүн</span>}
                      <div className={`whitespace-pre-wrap wrap-break-word rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        isUser ? 'rounded-br-sm bg-[#ffbe00] text-[#022179]'
                          : isAdmin ? 'rounded-bl-sm bg-green-50 ring-1 ring-green-200 dark:bg-green-900/20'
                            : 'rounded-bl-sm bg-card ring-1 ring-border'
                      }`}>
                        {m.text}
                      </div>
                      {/* AI санал болгосон бүтээгдэхүүний card (хэрэглэгчийн харсан) */}
                      {!isUser && Array.isArray(m.products) && m.products.length > 0 && (
                        <div className="mt-1.5 flex max-w-full gap-2 overflow-x-auto pb-1">
                          {m.products.map((p, pi) => (
                            <a key={p.id ?? pi} href={p.url ?? '#'} target="_blank" rel="noopener noreferrer"
                              className="flex w-28 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-background hover:border-primary/40">
                              <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                                {p.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                ) : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Bot className="h-4 w-4" /></div>}
                              </div>
                              <div className="p-1.5">
                                <p className="line-clamp-2 text-[10px] font-semibold">{p.title}</p>
                                {(p.salePrice ?? p.price) != null && (
                                  <span className="text-[11px] font-bold text-primary">{Math.round((p.salePrice ?? p.price)!).toLocaleString()}₮</span>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                      <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">{fmtTime(m.createdAt)}</span>
                    </div>
                    {isUser && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#022179] text-white">
                        <UserIcon className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Доод хэсэг — handoff toggle + хариу бичих */}
            <div className="border-t border-border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {conv?.handedOff ? 'AI унтарсан — та хариулж байна' : 'AI автоматаар хариулж байна'}
                </span>
                <Button
                  size="sm"
                  variant={conv?.handedOff ? 'outline' : 'default'}
                  disabled={handoffMut.isPending}
                  onClick={() => handoffMut.mutate(!conv?.handedOff)}
                >
                  {conv?.handedOff ? 'AI-д буцаах' : 'Чат авах (гар хариулах)'}
                </Button>
              </div>
              <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) replyMut.mutate(); }}>
                <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Хариу бичих..." disabled={replyMut.isPending} className="flex-1" />
                <Button type="submit" size="icon" disabled={!reply.trim() || replyMut.isPending} aria-label="Илгээх">
                  {replyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ChatPage() {
  const qc = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'chat', 'list', onlyUnread],
    queryFn: () => adminApi.chat.list({ pageSize: 50, onlyUnread }),
    staleTime: 0,
    refetchInterval: 30000, // 30с — шинэ чат/мессеж автоматаар
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <Loading label="Чат ачаалж байна..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Чат</h1>
          <p className="text-muted-foreground">Хэрэглэгчийн AI чат — харах, гар хариулах</p>
        </div>
        <div className="flex gap-2">
          <Button variant={onlyUnread ? 'default' : 'outline'} size="sm" onClick={() => setOnlyUnread((v) => !v)}>
            {onlyUnread ? 'Бүгд харах' : `Уншаагүй (${data?.unreadTotal ?? 0})`}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{onlyUnread ? 'Уншаагүй чат алга' : 'Чат байхгүй байна'}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((c: AdminChatListItem) => {
            const last = c.messages[0];
            return (
              <Card
                key={c.id}
                className={`cursor-pointer transition-colors hover:border-primary/40 ${c.adminUnread ? 'border-primary/50 bg-primary/5' : ''}`}
                onClick={() => setOpenId(c.id)}
              >
                <CardContent className="flex items-center gap-3 p-3.5">
                  <Avatar src={c.user?.image} name={c.user?.name || c.userName || 'Зочин'} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{c.user?.name || c.userName || 'Зочин'}</p>
                      {c.adminUnread && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />}
                      {c.handedOff && <span className="rounded-full bg-green-100 px-1.5 text-[9px] font-semibold text-green-700 dark:bg-green-900/30">Гар</span>}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{fmtTime(c.lastMessageAt)}</span>
                    </div>
                    {c.user?.email && <p className="truncate text-[11px] text-muted-foreground">{c.user.email}</p>}
                    {last && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        <span className="font-medium">{last.role === 'user' ? '👤 ' : last.role === 'admin' ? '🎧 ' : '🤖 '}</span>
                        {last.text}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{c._count.messages} мессеж</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ChatDetailDialog
        convId={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => qc.invalidateQueries({ queryKey: ['admin', 'chat', 'list'] })}
      />
    </div>
  );
}
