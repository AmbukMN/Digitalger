'use client';

import {
  Activity,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  MousePointerClick,
  PlayCircle,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { cn, formatDate } from '@besttv/shared';
import { Badge } from '@besttv/shared/ui';
import { useUserInsight, type UserInsight } from '@/lib/queries';

/** Секундыг "2ц 15м" хэлбэрт */
function humanDuration(sec: number): string {
  if (!sec || sec < 60) return `${Math.max(0, Math.round(sec))} сек`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}ц ${m}м` : `${m} мин`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Тодорхойгүй';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Дөнгөж сая';
  if (min < 60) return `${min} мин өмнө`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} цаг өмнө`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} хоног өмнө`;
  return formatDate(iso);
}

const EVENT_LABEL: Record<string, { label: string; className: string }> = {
  view: { label: 'Нээсэн', className: 'text-muted-foreground' },
  play: { label: 'Тоглуулсан', className: 'text-primary' },
  progress: { label: 'Үзсээр', className: 'text-muted-foreground' },
  complete: { label: 'Дуусгасан', className: 'text-success' },
  mylist_add: { label: 'Жагсаалтад нэмсэн', className: 'text-premium' },
  mylist_remove: { label: 'Жагсаалтаас хассан', className: 'text-muted-foreground' },
};

const AUDIT_LABEL: Record<string, string> = {
  login: 'Нэвтэрсэн',
  register: 'Бүртгүүлсэн',
  oauth_login: 'Сошиалаар нэвтэрсэн',
  logout: 'Гарсан',
  password: 'Нууц үг сольсон',
  email: 'Имэйл сольсон',
  name: 'Нэр сольсон',
  avatar: 'Зураг сольсон',
  role: 'Эрх өөрчлөгдсөн',
  blocked: 'Хаагдсан/нээгдсэн',
  wallet_credit: 'Хэтэвч цэнэглэгдсэн',
  wallet_debit: 'Хэтэвчнээс хасагдсан',
  plan_granted: 'Багц олгогдсон',
};

export function UserInsightTab({ userId, active }: { userId: string; active: boolean }) {
  const { data, isLoading, isError } = useUserInsight(userId, active);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-14 text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-border bg-accent/30 py-10 text-center text-sm text-muted-foreground">
        Мэдээлэл ачаалж чадсангүй
      </div>
    );
  }

  const s = data.summary;
  const noData =
    s.pageViewCount === 0 && s.titleEventCount === 0 && data.watching.length === 0;

  return (
    <div className="space-y-4">
      {/* ── Хураангуй карт ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat icon={Clock} label="Үзсэн хугацаа" value={humanDuration(s.totalWatchSec)} />
        <Stat icon={PlayCircle} label="Эхэлсэн кино" value={`${s.titlesStarted}`} />
        <Stat icon={CheckCircle2} label="Дуусгасан" value={`${s.titlesCompleted}`} />
        <Stat icon={Eye} label="Хуудас үзсэн" value={`${s.pageViewCount}`} />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-accent/25 px-3 py-2 text-xs text-muted-foreground">
        <Activity size={13} className="shrink-0 text-primary" />
        Сүүлд идэвхтэй байсан:{' '}
        <strong className="text-foreground">{timeAgo(s.lastActive)}</strong>
      </div>

      {noData && (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Энэ хэрэглэгчийн үйл хөдлөл хараахан бүртгэгдээгүй байна
        </div>
      )}

      {/* ── Одоо үзэж байгаа ── */}
      {data.watching.length > 0 && (
        <Section icon={PlayCircle} title="Үзэж байгаа / сүүлд үзсэн" count={data.watching.length}>
          <div className="space-y-2">
            {data.watching.map((w) => (
              <div key={w.titleId} className="rounded-lg border border-border bg-card p-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{w.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.type === 'SERIES' && w.episode
                        ? `${w.episode.number}-р анги${w.episode.name ? ` · ${w.episode.name}` : ''}`
                        : w.type === 'SERIES'
                          ? 'Олон ангит'
                          : 'Кино'}
                      {' · '}
                      {humanDuration(w.positionSec)} / {humanDuration(w.durationSec)}
                    </p>
                  </div>
                  <Badge variant={w.percent >= 90 ? 'success' : 'secondary'}>{w.percent}%</Badge>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      w.percent >= 90 ? 'bg-success' : 'bg-primary',
                    )}
                    style={{ width: `${Math.min(100, w.percent)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{timeAgo(w.updatedAt)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Кино дээрх үйлдлүүд ── */}
      {data.titleEvents.length > 0 && (
        <Section icon={MousePointerClick} title="Сүүлийн үйлдлүүд" count={data.titleEvents.length}>
          <ScrollList>
            {data.titleEvents.map((e) => {
              const meta = EVENT_LABEL[e.type] ?? { label: e.type, className: 'text-muted-foreground' };
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-foreground">
                    <span className={cn('font-medium', meta.className)}>{meta.label}</span>
                    {' · '}
                    {e.titleName ?? e.titleSlug ?? e.titleId}
                    {e.positionSec != null && e.durationSec ? (
                      <span className="text-muted-foreground">
                        {' '}
                        ({humanDuration(e.positionSec)})
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(e.createdAt)}</span>
                </li>
              );
            })}
          </ScrollList>
        </Section>
      )}

      {/* ── Хамгийн их зочилсон хуудас ── */}
      {data.topPages.length > 0 && (
        <Section icon={FileText} title="Хамгийн их зочилсон хуудас" hint="сүүлийн 30 хоног">
          <div className="space-y-1.5">
            {data.topPages.map((p) => {
              const max = data.topPages[0]?.count || 1;
              return (
                <div key={p.path} className="flex items-center gap-2.5">
                  <code className="w-0 flex-1 truncate rounded bg-accent px-1.5 py-1 text-xs text-muted-foreground">
                    {p.path}
                  </code>
                  <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-accent sm:block">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(p.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-semibold text-foreground">
                    {p.count}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Хайлтын түүх ── */}
      {data.searches.length > 0 && (
        <Section icon={Search} title="Хайлтын түүх" count={data.searches.length}>
          <ScrollList>
            {data.searches.map((q, i) => (
              <li key={`${q.query}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-foreground">&ldquo;{q.query}&rdquo;</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={q.results > 0 ? 'secondary' : 'destructive'}>
                    {q.results} үр дүн
                  </Badge>
                  {timeAgo(q.createdAt)}
                </span>
              </li>
            ))}
          </ScrollList>
        </Section>
      )}

      {/* ── Сүүлд зочилсон хуудсууд (цагийн дараалал) ── */}
      {data.recentPages.length > 0 && (
        <Section icon={Eye} title="Сүүлд зочилсон хуудсууд" count={data.recentPages.length}>
          <ScrollList>
            {data.recentPages.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <code className="min-w-0 truncate text-xs text-muted-foreground">{p.path}</code>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {p.device && <Badge variant="secondary">{p.device}</Badge>}
                  {timeAgo(p.createdAt)}
                </span>
              </li>
            ))}
          </ScrollList>
        </Section>
      )}

      {/* ── Аккаунтын түүх ── */}
      {data.auditLogs.length > 0 && (
        <Section icon={ShieldAlert} title="Аккаунтын түүх" count={data.auditLogs.length}>
          <ScrollList>
            {data.auditLogs.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {AUDIT_LABEL[a.field] ?? a.field}
                  {a.actor === 'admin' && (
                    <Badge variant="warning" className="ml-1.5">
                      админ
                    </Badge>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ScrollList>
        </Section>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  hint,
  children,
}: {
  icon: typeof Clock;
  title: string;
  count?: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icon size={14} className="text-primary" />
        {title}
        {count != null && <span className="text-xs font-normal text-muted-foreground">({count})</span>}
        {hint && <span className="ml-auto text-xs font-normal text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** 10+ мөр байвал дотроо гүйлгэнэ — dialog хэт уртсахгүй */
function ScrollList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="max-h-52 divide-y divide-border overflow-y-auto overscroll-contain rounded-lg border border-border bg-card">
      {children}
    </ul>
  );
}
