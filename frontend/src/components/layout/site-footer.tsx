import Link from 'next/link';
import { SITE_NAME } from '@/lib/constants';
import {
  FacebookIcon,
  InstagramIcon,
  TwitterXIcon,
  ThreadsIcon,
  TelegramIcon,
  WhatsAppIcon,
  TikTokIcon,
  YouTubeIcon,
  LinkedInIcon,
} from '@/components/social-icons';

interface SocialLinks {
  socialFacebook?: string | null;
  socialInstagram?: string | null;
  socialTwitter?: string | null;
  socialThreads?: string | null;
  socialTelegram?: string | null;
  socialWhatsapp?: string | null;
  socialTiktok?: string | null;
  socialYoutube?: string | null;
  socialLinkedin?: string | null;
}

async function getSocialLinks(): Promise<SocialLinks> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/settings/public`, { next: { revalidate: 300 } });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

const SOCIAL_ITEMS = [
  { key: 'socialFacebook' as const, label: 'Facebook', Icon: FacebookIcon },
  { key: 'socialInstagram' as const, label: 'Instagram', Icon: InstagramIcon },
  { key: 'socialTwitter' as const, label: 'Twitter / X', Icon: TwitterXIcon },
  { key: 'socialThreads' as const, label: 'Threads', Icon: ThreadsIcon },
  { key: 'socialTelegram' as const, label: 'Telegram', Icon: TelegramIcon },
  { key: 'socialWhatsapp' as const, label: 'WhatsApp', Icon: WhatsAppIcon },
  { key: 'socialTiktok' as const, label: 'TikTok', Icon: TikTokIcon },
  { key: 'socialYoutube' as const, label: 'YouTube', Icon: YouTubeIcon },
  { key: 'socialLinkedin' as const, label: 'LinkedIn', Icon: LinkedInIcon },
];

export async function SiteFooter() {
  const social = await getSocialLinks();
  const activeSocials = SOCIAL_ITEMS.filter(({ key }) => !!social[key]);

  const links = (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      <Link href="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        Холбоо барих
      </Link>
      <Link href="/privacy-policy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        Нууцлалын бодлого
      </Link>
      <Link href="/terms-of-use" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        Үйлчилгээний нөхцөл
      </Link>
      <Link href="/data-deletion" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        Мэдээлэл устгах
      </Link>
    </div>
  );

  const socialIcons = activeSocials.length > 0 ? (
    <div className="flex items-center justify-center gap-3">
      {activeSocials.map(({ key, label, Icon }) => (
        <Link
          key={key}
          href={social[key]!}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon className="h-4 w-4" />
        </Link>
      ))}
    </div>
  ) : null;

  return (
    <footer className="bg-muted/30" style={{ borderTop: '2px solid oklch(0.847 0.178 85.87)' }}>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">

        {/* Mobile layout */}
        <div className="flex flex-col items-center gap-2 sm:hidden">
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} {SITE_NAME}. Бүх эрх хуулиар хамгаалагдсан.
          </p>
          {socialIcons}
          {links}
        </div>

        {/* Desktop layout */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground shrink-0">
            © {new Date().getFullYear()} {SITE_NAME}. Бүх эрх хуулиар хамгаалагдсан.
          </p>
          <div className="flex items-center gap-4 shrink-0">
            <Link href="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Холбоо барих
            </Link>
            <Link href="/privacy-policy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Нууцлалын бодлого
            </Link>
            <Link href="/terms-of-use" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Үйлчилгээний нөхцөл
            </Link>
            <Link href="/data-deletion" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Мэдээлэл устгах
            </Link>
            {activeSocials.length > 0 && (
              <>
                <div className="w-px h-4 bg-border" />
                {activeSocials.map(({ key, label, Icon }) => (
                  <Link
                    key={key}
                    href={social[key]!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>

      </div>
    </footer>
  );
}
