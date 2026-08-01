'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Facebook, Instagram, Loader2, Mail, Phone, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Socials {
  facebook: string;
  instagram: string;
  youtube: string;
  twitter: string;
  tiktok: string;
  email: string;
  phone: string;
}

const EMPTY: Socials = {
  facebook: '',
  instagram: '',
  youtube: '',
  twitter: '',
  tiktok: '',
  email: '',
  phone: '',
};

/** Сүлжээ бүрийн талбарын тодорхойлолт */
const FIELDS: {
  key: keyof Socials;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  type?: string;
}[] = [
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/besttv',
    icon: <Facebook size={16} />,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/besttv',
    icon: <Instagram size={16} />,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@besttv',
    icon: <Youtube size={16} />,
  },
  {
    key: 'twitter',
    label: 'X (Twitter)',
    placeholder: 'https://x.com/besttv',
    icon: <span className="text-sm font-black">𝕏</span>,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@besttv',
    icon: <span className="text-xs font-bold">TT</span>,
  },
  {
    key: 'email',
    label: 'Холбоо барих имэйл',
    placeholder: 'info@besttv.us',
    icon: <Mail size={16} />,
    type: 'email',
  },
  {
    key: 'phone',
    label: 'Утас',
    placeholder: '+976 9911 2233',
    icon: <Phone size={16} />,
  },
];

/**
 * Сошиал сүлжээ / холбоо барих — footer-т харагдана.
 *
 * ⚠️ ХООСОН талбар = тухайн icon огт харагдахгүй. Хэрэглэхгүй сүлжээгээ
 * хоосон орхиход л хангалттай (устгах товч хэрэггүй).
 */
export function SocialsSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-socials'],
    queryFn: () => api<Socials>('/admin/settings/socials'),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const [form, setForm] = useState<Socials>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...EMPTY, ...data });
  }, [data]);

  const dirty = !!data && FIELDS.some((f) => (data[f.key] ?? '') !== form[f.key]);

  const save = async () => {
    // URL талбарууд http(s):// эхлэх ёстой (backend @IsUrl require_protocol)
    const urlKeys: (keyof Socials)[] = ['facebook', 'instagram', 'youtube', 'twitter', 'tiktok'];
    for (const k of urlKeys) {
      const v = form[k].trim();
      if (v && !/^https?:\/\//i.test(v)) {
        toast.error(`${FIELDS.find((f) => f.key === k)?.label}: https:// -ээр эхлэх ёстой`);
        return;
      }
    }
    setSaving(true);
    try {
      await api('/admin/settings/socials', {
        method: 'PUT',
        body: JSON.stringify(
          Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])),
        ),
      });
      qc.invalidateQueries({ queryKey: ['admin-socials'] });
      toast.success('Сошиал холбоос хадгалагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card rounded-xl p-6">
      <div>
        <h2 className="font-bold text-foreground">Сошиал сүлжээ / Холбоо барих</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Footer-т харагдана. <strong className="text-foreground">Хоосон талбар харагдахгүй</strong> —
          хэрэглэхгүй сүлжээгээ хоосон орхино уу.
        </p>
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="text-primary">{f.icon}</span> {f.label}
                </span>
                <input
                  type={f.type ?? 'text'}
                  value={form[f.key]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="admin-input"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              Хадгалах
            </button>
          </div>
        </>
      )}
    </div>
  );
}
