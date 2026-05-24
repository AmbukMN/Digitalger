'use client';

import { useState } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { cn } from '@digitalger/shared';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Heading1, Heading2, Heading3,
  Undo, Redo, Quote, Minus, Highlighter,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Table as TableIcon, ImageIcon, Code, RemoveFormatting, Link2Off, FileCode,
} from 'lucide-react';

// Custom FontSize extension — TextStyle-д fontSize attribute нэмнэ
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
          renderHTML: (attrs) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '48'];

// Custom LineHeight extension
const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() { return { types: ['paragraph', 'heading'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el) => (el as HTMLElement).style.lineHeight || null,
          renderHTML: (attrs) => attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setLineHeight: (lineHeight: string) => ({ commands }: any) =>
        this.options.types.every((type: string) => commands.updateAttributes(type, { lineHeight })),
      unsetLineHeight: () => ({ commands }: any) =>
        this.options.types.every((type: string) => commands.resetAttributes(type, 'lineHeight')),
    } as any;
  },
});

const LINE_HEIGHTS = ['1', '1.2', '1.4', '1.5', '1.6', '1.8', '2', '2.5'];

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

function ToolbarButton({
  onClick, active, disabled, title, children,
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

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border shrink-0" />;
}

export function RichEditor({ value, onChange, placeholder, minHeight = '200px', className }: RichEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlSource, setHtmlSource] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false,
        link: false,
      }),
      Underline,
      TextStyle,
      FontSize,
      LineHeight,
      Color,
      Highlight.configure({ multicolor: true }) as any,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false }),
      Superscript,
      Subscript,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder: placeholder ?? 'Бичих...' }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none prose prose-base max-w-none w-full dark:prose-invert',
      },
    },
  });

  if (!editor) return null;

  const currentFontSize = editor.getAttributes('textStyle').fontSize?.replace('px', '') ?? '';

  const setLink = () => {
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('Холбоос URL:', prev);
    if (url === null) return;
    if (!url) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
  };

  const addImage = () => {
    const url = window.prompt('Зургийн URL:');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const insertTable = () => {
    (editor.chain().focus() as any).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const toggleHtmlMode = () => {
    if (!htmlMode) {
      setHtmlSource(editor.getHTML());
      setHtmlMode(true);
    } else {
      editor.commands.setContent(htmlSource);
      onChange(htmlSource);
      setHtmlMode(false);
    }
  };

  return (
    <div className={cn('rounded-lg border border-input bg-background overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5">

        {/* Undo / Redo */}
        <ToolbarButton title="Буцаах (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Дахин хийх (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Headings */}
        <ToolbarButton title="Гарчиг 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Гарчиг 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Гарчиг 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Font size */}
        <select
          title="Үсгийн хэмжээ"
          value={currentFontSize}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              (editor.chain().focus() as any).unsetFontSize().run();
            } else {
              (editor.chain().focus() as any).setFontSize(`${val}px`).run();
            }
          }}
          className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground hover:bg-muted focus:outline-none cursor-pointer"
        >
          <option value="">Хэмжээ</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>

        {/* Line height */}
        <select
          title="Мөрийн өндөр"
          value={editor.getAttributes('paragraph').lineHeight ?? editor.getAttributes('heading').lineHeight ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              (editor.chain().focus() as any).unsetLineHeight().run();
            } else {
              (editor.chain().focus() as any).setLineHeight(val).run();
            }
          }}
          className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground hover:bg-muted focus:outline-none cursor-pointer"
        >
          <option value="">Мөр</option>
          {LINE_HEIGHTS.map((lh) => (
            <option key={lh} value={lh}>{lh}</option>
          ))}
        </select>

        <Divider />

        {/* Text format */}
        <ToolbarButton title="Тод (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Налуу (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Доогуур зурах (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Дундуур зурах" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Код" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}>
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Дээд индекс" onClick={() => (editor.chain().focus() as any).toggleSuperscript().run()} active={editor.isActive('superscript')}>
          <SuperscriptIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Доод индекс" onClick={() => (editor.chain().focus() as any).toggleSubscript().run()} active={editor.isActive('subscript')}>
          <SubscriptIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Color */}
        <label title="Үсгийн өнгө" className="relative cursor-pointer rounded p-1.5 hover:bg-muted flex items-center gap-0.5">
          <span className="text-[11px] font-bold leading-none" style={{ color: editor.getAttributes('textStyle').color ?? 'currentColor' }}>A</span>
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            value={editor.getAttributes('textStyle').color ?? '#000000'}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <label title="Тодруулах өнгө" className="relative cursor-pointer rounded p-1.5 hover:bg-muted">
          <Highlighter className="h-3.5 w-3.5" />
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            value={typeof editor.getAttributes('highlight').color === 'string' ? editor.getAttributes('highlight').color : '#ffff00'}
            onChange={(e) => (editor.chain().focus() as any).toggleHighlight({ color: e.target.value }).run()}
          />
        </label>
        <ToolbarButton title="Формат арилгах" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

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

        <Divider />

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
        <ToolbarButton title="Тэгшитгэх" onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })}>
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Link */}
        <ToolbarButton title="Холбоос оруулах" onClick={setLink} active={editor.isActive('link')}>
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        {editor.isActive('link') && (
          <ToolbarButton title="Холбоос арилгах" onClick={() => editor.chain().focus().unsetLink().run()}>
            <Link2Off className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}

        <Divider />

        {/* Image & Table */}
        <ToolbarButton title="Зураг оруулах" onClick={addImage}>
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Хүснэгт оруулах" onClick={insertTable}>
          <TableIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* HTML mode */}
        <ToolbarButton title={htmlMode ? 'Визуал горим' : 'HTML засах'} onClick={toggleHtmlMode} active={htmlMode}>
          <FileCode className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      {htmlMode ? (
        <textarea
          value={htmlSource}
          onChange={(e) => setHtmlSource(e.target.value)}
          className="w-full px-4 py-3 text-xs font-mono bg-muted/20 text-foreground focus:outline-none resize-y"
          style={{ minHeight }}
          spellCheck={false}
        />
      ) : (
        <EditorContent
          editor={editor}
          className="w-full px-4 py-3 text-sm [&_.tiptap]:w-full [&_.tiptap]:outline-none"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}
