'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Italic,
  Link as LinkIcon,
  Link2Off,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { usePrompt } from '@besttv/shared/ui';
import { api } from '@/lib/api';

/**
 * Rich text editor (TipTap) — админ HTML бичихгүй, Word шиг форматлана.
 * Гаралт нь HTML тул одоо байгаа `dangerouslySetInnerHTML` харагдац хэвээр.
 */
export function RichEditor({
  value,
  onChange,
  placeholder = 'Энд бичнэ үү...',
  minHeight = 400,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const prompt = usePrompt();

  const editor = useEditor({
    immediatelyRender: false, // Next.js SSR hydration зөрчлөөс сэргийлнэ
    extensions: [
      StarterKit.configure({ link: false }),
      Underline,
      TextStyle,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Image.configure({ HTMLAttributes: { class: 'rounded-lg' } }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'rich-editor-content focus:outline-none',
        style: `min-height:${minHeight}px`,
      },
    },
  });

  // Гаднаас value өөрчлөгдвөл (жишээ нь backend-с ачаалагдахад) editor-т тусгана
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const setLink = useCallback(async () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = await prompt({
      title: previous ? 'Холбоос засах' : 'Холбоос нэмэх',
      label: 'Хаяг (URL)',
      placeholder: 'https://example.com',
      defaultValue: previous ?? 'https://',
      description: 'Хоосон үлдээвэл холбоос салгагдана.',
      confirmLabel: 'Холбох',
      allowEmpty: true,
    });
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, prompt]);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'gallery');
      const res = await api<{ key: string; url: string }>('/admin/uploads/image', {
        method: 'POST',
        body: form,
      });
      editor?.chain().focus().setImage({ src: res.url }).run();
    } catch {
      toast.error('Зураг оруулж чадсангүй');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!editor) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-input bg-card text-muted-foreground"
        style={{ minHeight }}
      >
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-card">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-accent/30 p-1.5">
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Тод (Ctrl+B)"
        >
          <Bold size={15} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Налуу (Ctrl+I)"
        >
          <Italic size={15} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Доогуур зураас"
        >
          <UnderlineIcon size={15} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Дарж зурсан"
        >
          <Strikethrough size={15} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive('highlight')}
          title="Тодруулах"
        >
          <Highlighter size={15} />
        </Btn>

        <Sep />

        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Гарчиг"
        >
          <Heading2 size={15} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Дэд гарчиг"
        >
          <Heading3 size={15} />
        </Btn>

        <Sep />

        <Btn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Цэгт жагсаалт"
        >
          <List size={15} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Дугаартай жагсаалт"
        >
          <ListOrdered size={15} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Ишлэл"
        >
          <Quote size={15} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Код"
        >
          <Code size={15} />
        </Btn>

        <Sep />

        <Btn
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Зүүн"
        >
          <AlignLeft size={15} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Голлуулах"
        >
          <AlignCenter size={15} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Баруун"
        >
          <AlignRight size={15} />
        </Btn>

        <Sep />

        <Btn onClick={setLink} active={editor.isActive('link')} title="Холбоос нэмэх">
          <LinkIcon size={15} />
        </Btn>
        {editor.isActive('link') && (
          <Btn onClick={() => editor.chain().focus().unsetLink().run()} title="Холбоос салгах">
            <Link2Off size={15} />
          </Btn>
        )}
        <Btn onClick={() => fileRef.current?.click()} title="Зураг оруулах" disabled={uploading}>
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Зураас">
          <Minus size={15} />
        </Btn>

        <Sep />

        <Btn
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Формат арилгах"
        >
          <RemoveFormatting size={15} />
        </Btn>

        <div className="ml-auto flex items-center gap-0.5">
          <Btn
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Буцаах (Ctrl+Z)"
          >
            <Undo size={15} />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Дахин хийх (Ctrl+Y)"
          >
            <Redo size={15} />
          </Btn>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadImage(file);
        }}
      />

      <EditorContent editor={editor} className="px-4 py-3" />
    </div>
  );
}

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-40',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}
