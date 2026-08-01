'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, Plus, Trash2, User } from 'lucide-react';
import { uploadImage } from '@/lib/upload';

export interface CastEntry {
  name: string;
  character?: string;
  photoKey?: string;
  photoUrl?: string | null;
}

export function CastEditor({
  cast,
  onChange,
}: {
  cast: CastEntry[];
  onChange: (cast: CastEntry[]) => void;
}) {
  const add = () => onChange([...cast, { name: '', character: '' }]);
  const update = (i: number, patch: Partial<CastEntry>) =>
    onChange(cast.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(cast.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {cast.map((c, i) => (
        <CastRow key={i} entry={c} onChange={(patch) => update(i, patch)} onRemove={() => remove(i)} />
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/70"
      >
        <Plus size={15} /> Жүжигчин нэмэх
      </button>
    </div>
  );
}

function CastRow({
  entry,
  onChange,
  onRemove,
}: {
  entry: CastEntry;
  onChange: (patch: Partial<CastEntry>) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadImage(file, 'cast').promise;
      onChange({ photoKey: res.key, photoUrl: res.url });
    } catch {
      // toast-ыг helper харуулсан
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-2.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadPhoto(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted"
      >
        {uploading ? (
          <Loader2 size={16} className="absolute inset-0 m-auto animate-spin text-muted-foreground" />
        ) : entry.photoUrl ? (
          <Image src={entry.photoUrl} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <User size={20} className="absolute inset-0 m-auto text-muted-foreground" />
        )}
      </button>
      <input
        value={entry.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Жүжигчний нэр"
        className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
      />
      <input
        value={entry.character ?? ''}
        onChange={(e) => onChange({ character: e.target.value })}
        placeholder="Дүрийн нэр"
        className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
      />
      <button type="button" onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-destructive">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
