'use client';

// ─── Багийн админ (Staff management) — зөвхөн SUPERADMIN ──────────────────────
// EDITOR/ADMIN дүртэй админ ажилтнуудыг үүсгэх / эрх солих / блоклох / устгах.
// Backend бүх endpoint нь зөвхөн SUPERADMIN-д нээлттэй; UI талд ч SUPERADMIN
// мөрийг онцолж, түүн дээр role/block/delete товчийг нуудаг.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  Loading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@digitalger/shared/ui';
import { Ban, CheckCircle2, Crown, Plus, Shield, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { adminApi, ApiError } from '@/lib/api';
import type { AdminStaff } from '@/types/admin';

type StaffRole = 'EDITOR' | 'ADMIN';

function StaffAvatar({ staff }: { staff: AdminStaff }) {
  const initials = (staff.name ?? staff.email).charAt(0).toUpperCase();
  if (staff.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={staff.image}
        alt={staff.name ?? staff.email}
        className="h-9 w-9 rounded-full object-cover ring-2 ring-border shrink-0"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/20">
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'SUPERADMIN') {
    return (
      <Badge variant="amber" className="gap-1">
        <Crown className="h-3 w-3" />Эзэн (Superadmin)
      </Badge>
    );
  }
  if (role === 'ADMIN') {
    return (
      <Badge variant="info" className="gap-1">
        <ShieldCheck className="h-3 w-3" />Админ
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Shield className="h-3 w-3" />Засварлагч
    </Badge>
  );
}

export function StaffPanel() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('EDITOR');
  const [password, setPassword] = useState('');
  const [blockTarget, setBlockTarget] = useState<AdminStaff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminStaff | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: () => adminApi.staff.list(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });
  }

  function errMsg(e: unknown, fallback: string) {
    return e instanceof ApiError && e.message ? e.message : fallback;
  }

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.staff.create({
        email: email.trim(),
        name: name.trim() || undefined,
        role,
        password: password.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Шинэ админ нэмэгдлээ');
      setCreateOpen(false);
      setEmail('');
      setName('');
      setRole('EDITOR');
      setPassword('');
    },
    onError: (e) => {
      const raw = errMsg(e, '').toLowerCase();
      if (raw.includes('email') || raw.includes('имэйл'))
        toast.error('Энэ имэйл аль хэдийн бүртгэлтэй байна');
      else toast.error(errMsg(e, 'Админ нэмэхэд алдаа гарлаа'));
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: StaffRole }) =>
      adminApi.staff.updateRole(id, role),
    onSuccess: () => {
      invalidate();
      toast.success('Эрх шинэчлэгдлээ');
    },
    onError: (e) => toast.error(errMsg(e, 'Эрх солиход алдаа гарлаа')),
  });

  const blockMutation = useMutation({
    mutationFn: (s: AdminStaff) => adminApi.staff.block(s.id, !s.blocked),
    onSuccess: (_, s) => {
      invalidate();
      toast.success(s.blocked ? 'Админ идэвхжүүлэгдлээ' : 'Админ блоклогдлоо');
      setBlockTarget(null);
    },
    onError: (e) => toast.error(errMsg(e, 'Алдаа гарлаа')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.staff.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Админ устгагдлаа');
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(errMsg(e, 'Устгахад алдаа гарлаа')),
  });

  if (isLoading) return <Loading label="Багийн админ..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  const staff = data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Багийн админ
          </h2>
          <p className="text-sm text-muted-foreground">
            Нийт {staff.length} админ ажилтан (EDITOR / ADMIN)
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 w-fit">
          <Plus className="h-4 w-4" />
          Шинэ админ нэмэх
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Админ</th>
              <th className="px-4 py-3 font-medium">Эрх</th>
              <th className="px-4 py-3 font-medium">Төлөв</th>
              <th className="px-4 py-3 font-medium">Бүртгүүлсэн</th>
              <th className="px-4 py-3 font-medium text-right">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Багийн админ алга. "Шинэ админ нэмэх" товчоор нэмнэ үү.
                </td>
              </tr>
            )}
            {staff.map((s) => {
              const isSuper = s.role === 'SUPERADMIN';
              return (
                <tr
                  key={s.id}
                  className={`border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${
                    isSuper ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <StaffAvatar staff={s} />
                      <div className="min-w-0">
                        <p className="font-semibold truncate leading-tight">
                          {s.name ?? <span className="text-muted-foreground font-normal">Нэргүй</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isSuper ? (
                      <RoleBadge role={s.role} />
                    ) : (
                      <Select
                        value={s.role}
                        onValueChange={(v) => roleMutation.mutate({ id: s.id, role: v as StaffRole })}
                        disabled={roleMutation.isPending}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Засварлагч</SelectItem>
                          <SelectItem value="ADMIN">Админ</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.blocked ? (
                      <Badge variant="destructive" className="gap-1">
                        <Ban className="h-3 w-3" />Блоклогдсон
                      </Badge>
                    ) : (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />Идэвхтэй
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString('mn-MN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {isSuper ? (
                        <span className="text-xs text-muted-foreground italic pr-1">Эзэн — өөрчлөх боломжгүй</span>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${
                              s.blocked
                                ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950'
                                : 'text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950'
                            }`}
                            onClick={() => setBlockTarget(s)}
                            title={s.blocked ? 'Идэвхжүүлэх' : 'Блоклох'}
                          >
                            {s.blocked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(s)}
                            title="Устгах"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Шинэ админ нэмэх dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Шинэ админ нэмэх</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="staffEmail">И-мэйл *</Label>
              <Input
                id="staffEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@digitalger.mn"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staffName">Нэр</Label>
              <Input
                id="staffName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Нэр (заавал биш)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Эрх</Label>
              <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR">Засварлагч (EDITOR)</SelectItem>
                  <SelectItem value="ADMIN">Админ (ADMIN)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staffPassword">Нууц үг (заавал биш)</Label>
              <Input
                id="staffPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Хоосон бол автоматаар үүснэ"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Цуцлах
            </Button>
            <Button
              disabled={createMutation.isPending || !email.trim()}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Нэмж байна...' : 'Нэмэх'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block/Unblock баталгаажуулах */}
      <Dialog open={!!blockTarget} onOpenChange={(o) => !o && setBlockTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{blockTarget?.blocked ? 'Админ идэвхжүүлэх үү?' : 'Админ блоклох уу?'}</DialogTitle>
          </DialogHeader>
          {blockTarget && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <StaffAvatar staff={blockTarget} />
              <div>
                <p className="text-sm font-semibold">{blockTarget.name ?? 'Нэргүй'}</p>
                <p className="text-xs text-muted-foreground">{blockTarget.email}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {blockTarget?.blocked
              ? 'Энэ админ дахин нэвтрэх боломжтой болно.'
              : 'Блоклосны дараа тухайн админ удирдлагын самбарт нэвтрэх боломжгүй болно.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockTarget(null)}>
              Цуцлах
            </Button>
            <Button
              variant={blockTarget?.blocked ? 'default' : 'destructive'}
              disabled={blockMutation.isPending}
              onClick={() => blockTarget && blockMutation.mutate(blockTarget)}
            >
              {blockMutation.isPending
                ? 'Түр хүлээнэ үү...'
                : blockTarget?.blocked
                  ? 'Идэвхжүүлэх'
                  : 'Блоклох'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete баталгаажуулах */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Админ устгах уу?</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <StaffAvatar staff={deleteTarget} />
              <div>
                <p className="text-sm font-semibold">{deleteTarget.name ?? 'Нэргүй'}</p>
                <p className="text-xs text-muted-foreground">{deleteTarget.email}</p>
              </div>
            </div>
          )}
          <Separator />
          <p className="text-sm text-muted-foreground">
            Энэ админы удирдлагын эрх бүрмөсөн устгагдана. Буцаах боломжгүй.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Цуцлах
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
