'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@digitalger/shared';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Quote,
  Minus,
} from 'lucide-react';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 transition-colors hover:bg-muted',
        active && 'bg-primary/15 text-primary',
        disabled && 'opacity-30 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

// RichEditor is intentionally uncontrolled after mount.
// Use a `key` prop from the parent to force remount when content must change externally
// (e.g. dialog open, "Default" button, AI generate). User edits always call onChange.
export function RichEditor({ value, onChange, placeholder, minHeight = '160px', className }: RichEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false,
        link: false,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Бичих...' }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none prose prose-sm max-w-none',
      },
    },
  });

  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt('URL оруулах:');
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className={cn('rounded-lg border border-input bg-background overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5">
        {/* Undo / Redo */}
        <ToolbarButton title="Буцаах" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Дахин хийх" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Headings */}
        <ToolbarButton title="Гарчиг 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Гарчиг 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Text format */}
        <ToolbarButton title="Тод" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Налуу" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Доогуур зурах" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Үсгэн дундуур зурах" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Lists */}
        <ToolbarButton title="Цэгтэй жагсаалт" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Дугаарлагдсан жагсаалт" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Иш татах" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Хэвтээ зураас" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Alignment */}
        <ToolbarButton title="Зүүн" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Голлосон" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Баруун" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Link */}
        <ToolbarButton title="Холбоос" onClick={setLink} active={editor.isActive('link')}>
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="px-4 py-3 text-sm"
        style={{ minHeight }}
      />
    </div>
  );
}
