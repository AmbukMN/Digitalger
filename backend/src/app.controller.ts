import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { AppCacheService, CacheKeys } from './common/cache/app-cache.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async health() {
    return this.appService.health();
  }

  @Get('settings/public')
  async publicSettings() {
    // Settings ховор өөрчлөгддөг ч navbar/footer/SSR-д байнга уншигддаг тул
    // 5 мин Redis cache. Admin тохиргоо засахад admin модуль cache-г del хийнэ.
    return this.cache.getOrSet(CacheKeys.publicSettings, 5 * 60_000, () =>
      this.buildPublicSettings(),
    );
  }

  private async buildPublicSettings() {
    const [theme, site] = await Promise.all([
      this.prisma.themeSetting.findUnique({ where: { id: 'default' } }),
      this.prisma.siteSetting.findUnique({ where: { id: 'default' } }),
    ]);
    return {
      siteName: site?.siteName ?? 'DigitalGer',
      logoUrl: site?.logoUrl ?? null,
      primaryColor: theme?.primaryColor ?? null,
      accentColor: theme?.accentColor ?? null,
      defaultTheme: theme?.defaultTheme ?? 'system',
      metaTitle: site?.metaTitle ?? null,
      metaDescription: site?.metaDescription ?? null,
      metaKeywords: site?.metaKeywords ?? null,
      ogTitle: site?.ogTitle ?? null,
      ogDescription: site?.ogDescription ?? null,
      ogImageUrl: site?.ogImageUrl ?? null,
      twitterCardType: site?.twitterCardType ?? 'summary_large_image',
      googleAnalyticsId: site?.googleAnalyticsId ?? null,
      googleTagManagerId: site?.googleTagManagerId ?? null,
      fbPixelId: site?.fbPixelId ?? null,
      socialFacebook: site?.socialFacebook ?? null,
      socialInstagram: site?.socialInstagram ?? null,
      socialTwitter: site?.socialTwitter ?? null,
      socialThreads: site?.socialThreads ?? null,
      socialTelegram: site?.socialTelegram ?? null,
      socialWhatsapp: site?.socialWhatsapp ?? null,
      socialTiktok: site?.socialTiktok ?? null,
      socialYoutube: site?.socialYoutube ?? null,
      socialLinkedin: site?.socialLinkedin ?? null,
    };
  }

  @Get('product-types')
  async productTypes() {
    // Product type config бараг өөрчлөгддөггүй ч product-card бүрд уншигддаг.
    return this.cache.getOrSet(CacheKeys.productTypes, 10 * 60_000, () =>
      this.prisma.productTypeConfig.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, value: true, label: true, description: true, icon: true, sortOrder: true },
      }),
    );
  }
}
