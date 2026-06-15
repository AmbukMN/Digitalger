'use client';

import { useRef, useState } from 'react';
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
  Link as LinkIcon, Heading1, Heading2, Heading3, Pilcrow,
  Undo, Redo, Quote, Minus, Highlighter, ChevronDown, Check,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Table as TableIcon, ImageIcon, Code, Code2, RemoveFormatting, Link2Off, FileCode,
  Baseline, PaintBucket, Palette, Upload, Video, MousePointerClick, Loader2,
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

// Имэйлийн CTA товч/видеоны inline-style болон data-* маркерыг линк дээр хадгалах
// нэмэлт Link extension. (Стандарт Link нь зөвхөн href/target хадгалдаг тул товч стиль
// алдагддаг.) products editor-т нөлөөгүй — энгийн линкэд эдгээр attribute null хэвээр.
const EmailLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('style'),
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
      'data-email-button': {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-email-button'),
        renderHTML: (attrs) =>
          attrs['data-email-button'] ? { 'data-email-button': attrs['data-email-button'] } : {},
      },
      'data-email-video': {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-email-video'),
        renderHTML: (attrs) =>
          attrs['data-email-video'] ? { 'data-email-video': attrs['data-email-video'] } : {},
      },
    };
  },
});

// Хурдан сонгох preset өнгөний палитр (брэндийн өнгө + түгээмэл)
const PRESET_COLORS: { label: string; value: string }[] = [
  { label: 'Хар', value: '#000000' },
  { label: 'Бараан саарал', value: '#374151' },
  { label: 'Саарал', value: '#6b7280' },
  { label: 'Цагаан', value: '#ffffff' },
  { label: 'Navy (брэнд)', value: '#022179' },
  { label: 'Цэнхэр', value: '#2563eb' },
  { label: 'Тэнгэрийн', value: '#0ea5e9' },
  { label: 'Gold (брэнд)', value: '#ffbe00' },
  { label: 'Улбар шар', value: '#f97316' },
  { label: 'Улаан', value: '#dc2626' },
  { label: 'Ягаан', value: '#db2777' },
  { label: 'Ягаан-нил', value: '#7c3aed' },
  { label: 'Ногоон', value: '#16a34a' },
  { label: 'Хүрэн-ногоон', value: '#0d9488' },
];

// Тодруулах (highlight) өнгөний preset — цайвар өнгөнүүд
const PRESET_HIGHLIGHTS: { label: string; value: string }[] = [
  { label: 'Шар', value: '#fef08a' },
  { label: 'Ногоон', value: '#bbf7d0' },
  { label: 'Цэнхэр', value: '#bfdbfe' },
  { label: 'Ягаан', value: '#fbcfe8' },
  { label: 'Улбар', value: '#fed7aa' },
  { label: 'Ягаан-нил', value: '#ddd6fe' },
  { label: 'Саарал', value: '#e5e7eb' },
  { label: 'Gold', value: '#ffe9a8' },
];

// Preset өнгөний палитр + custom color сонгогч (popover)
function ColorPickerDropdown({
  title, icon, presets, currentColor, onPick, onClear, includeCustom = true,
}: {
  title: string;
  icon: React.ReactNode;
  presets: { label: string; value: string }[];
  currentColor?: string | null;
  onPick: (color: string) => void;
  onClear?: () => void;
  includeCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        title={title}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-0.5 rounded p-1.5 transition-colors hover:bg-muted"
      >
        <span className="flex flex-col items-center leading-none">
          {icon}
          <span
            className="mt-0.5 h-1 w-4 rounded-sm border border-border/40"
            style={{ backgroundColor: currentColor || 'transparent' }}
          />
        </span>
        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover p-2 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="grid grid-cols-7 gap-1">
            {presets.map((c) => {
              const isActive = currentColor?.toLowerCase() === c.value.toLowerCase();
              return (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => { onPick(c.value); setOpen(false); }}
                  className={cn(
                    'relative flex h-5 w-5 items-center justify-center rounded border border-border/50 transition-transform hover:scale-110',
                    isActive && 'ring-2 ring-primary ring-offset-1 ring-offset-popover',
                  )}
                  style={{ backgroundColor: c.value }}
                >
                  {isActive && (
                    <Check
                      className="h-3 w-3"
                      style={{ color: c.value === '#ffffff' || c.value === '#fef08a' || c.value === '#ffbe00' ? '#000' : '#fff' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {includeCustom && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded border border-input bg-background px-2 py-1 text-xs text-foreground hover:bg-muted">
              <Palette className="h-3.5 w-3.5" />
              <span>Өөрийн өнгө</span>
              <input
                type="color"
                value={currentColor || '#000000'}
                onChange={(e) => onPick(e.target.value)}
                className="ml-auto h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </label>
          )}

          {onClear && (
            <button
              type="button"
              onClick={() => { onClear(); setOpen(false); }}
              className="mt-1 flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              <RemoveFormatting className="h-3.5 w-3.5" />
              Өнгө арилгах
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  /** R2 руу зураг upload хийх функц — өгвөл toolbar-т "Зураг байршуулах" товч идэвхждэг */
  onImageUpload?: (file: File) => Promise<string>;
  /** Email element-үүд (CTA товч, видео embed) toolbar-т нэмэх — зөвхөн имэйл editor-д */
  emailMode?: boolean;
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
        active && 'bg-muted text-primary',
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

export function RichEditor({ value, onChange, placeholder, minHeight = '200px', className, onImageUpload, emailMode }: RichEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlSource, setHtmlSource] = useState('');
  const [uploading, setUploading] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

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
      EmailLink.configure({ openOnClick: false, autolink: true }),
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

  // R2 руу зураг байршуулаад editor-д оруулна (onImageUpload өгсөн үед)
  const handleImageFile = async (file: File) => {
    if (!onImageUpload) return;
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } finally {
      setUploading(false);
    }
  };

  // Имэйлд тохирох CTA товч — линкэн дотор inline-styled товч (email-friendly).
  // TipTap зөвхөн бүртгэгдсэн node-уудыг хадгалдаг тул paragraph дотор styled link insert хийнэ.
  const insertCtaButton = () => {
    const label = window.prompt('Товчны текст:', 'Дэлгэрэнгүй үзэх');
    if (label === null) return;
    const href = window.prompt('Товчны холбоос (URL):', 'https://digitalger.mn');
    if (!href) return;
    const safeLabel = label.trim() || 'Дэлгэрэнгүй';
    // data-email-button attribute-аар backend sanitize/styling-д таних боломжтой
    const buttonHtml =
      `<p style="text-align:center"><a href="${href}" target="_blank" rel="noopener" ` +
      `data-email-button="true" ` +
      `style="display:inline-block;background:#022179;color:#ffbe00;font-weight:700;` +
      `font-size:15px;padding:13px 30px;border-radius:10px;text-decoration:none">${safeLabel}</a></p>`;
    editor.chain().focus().insertContent(buttonHtml).run();
  };

  // Видео embed — YouTube/Vimeo линк → thumbnail зураг + "тоглуулах" линк (имэйлд iframe ажилладаггүй).
  const insertVideo = () => {
    const url = window.prompt('Видеоны холбоос (YouTube/Vimeo/MP4):');
    if (!url) return;
    // YouTube ID-г олж thumbnail авах
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    const thumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg` : null;
    const chain = editor.chain().focus();
    // Thumbnail зураг (байвал) — тусдаа image node
    if (thumb) {
      chain.setImage({ src: thumb, alt: 'Видео' });
    }
    // "Видео тоглуулах" линк — data-email-video маркертай (backend playable болгоно)
    const linkHtml =
      `<p style="text-align:center"><a href="${url}" target="_blank" rel="noopener" ` +
      `data-email-video="true" style="color:#022179;font-weight:600;text-decoration:none">` +
      `▶ Видео тоглуулах</a></p>`;
    chain.insertContent(linkHtml).run();
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
      {/* Нуугдмал зураг upload input (R2) */}
      {onImageUpload && (
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImageFile(f);
            e.target.value = '';
          }}
        />
      )}

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
        <ToolbarButton title="Энгийн текст (paragraph)" onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')}>
          <Pilcrow className="h-3.5 w-3.5" />
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

        {/* Үсгийн өнгө — preset палитр + custom */}
        <ColorPickerDropdown
          title="Үсгийн өнгө"
          icon={<Baseline className="h-3.5 w-3.5" />}
          presets={PRESET_COLORS}
          currentColor={editor.getAttributes('textStyle').color ?? null}
          onPick={(color) => editor.chain().focus().setColor(color).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
        />

        {/* Тодруулах (background) өнгө — preset палитр + custom */}
        <ColorPickerDropdown
          title="Тодруулах өнгө"
          icon={<Highlighter className="h-3.5 w-3.5" />}
          presets={PRESET_HIGHLIGHTS}
          currentColor={typeof editor.getAttributes('highlight').color === 'string' ? editor.getAttributes('highlight').color : null}
          onPick={(color) => (editor.chain().focus() as any).setHighlight({ color }).run()}
          onClear={() => (editor.chain().focus() as any).unsetHighlight().run()}
        />

        {/* Линкийн өнгө — линк дээр сонголтгүй бол идэвхгүй */}
        <ColorPickerDropdown
          title="Линкийн өнгө (линк сонгоно уу)"
          icon={<PaintBucket className="h-3.5 w-3.5" />}
          presets={PRESET_COLORS}
          currentColor={editor.isActive('link') ? editor.getAttributes('textStyle').color ?? null : null}
          onPick={(color) => {
            // Линк сонгогдсон үед линкийн текстэд өнгө онооно
            if (editor.isActive('link')) {
              editor.chain().focus().extendMarkRange('link').setColor(color).run();
            } else {
              editor.chain().focus().setColor(color).run();
            }
          }}
          onClear={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().extendMarkRange('link').unsetColor().run();
            } else {
              editor.chain().focus().unsetColor().run();
            }
          }}
        />

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
        <ToolbarButton title="Кодын блок" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}>
          <Code2 className="h-3.5 w-3.5" />
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
        <ToolbarButton title="Зураг (URL-ээр)" onClick={addImage}>
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        {onImageUpload && (
          <ToolbarButton
            title="Зураг байршуулах (R2)"
            onClick={() => imgInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          </ToolbarButton>
        )}
        <ToolbarButton title="Хүснэгт оруулах" onClick={insertTable}>
          <TableIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        {/* Имэйлийн element-үүд (CTA товч, видео) */}
        {emailMode && (
          <>
            <Divider />
            <ToolbarButton title="CTA товч оруулах" onClick={insertCtaButton}>
              <MousePointerClick className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Видео оруулах" onClick={insertVideo}>
              <Video className="h-3.5 w-3.5" />
            </ToolbarButton>
          </>
        )}

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
