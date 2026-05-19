import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
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
    const [theme, site] = await Promise.all([
      this.prisma.themeSetting.findUnique({ where: { id: 'default' } }),
      this.prisma.siteSetting.findUnique({ where: { id: 'default' } }),
    ]);
    return {
      siteName: site?.siteName ?? 'DigitalGer',
      logoUrl: site?.logoUrl ?? null,
      primaryColor: theme?.primaryColor ?? null,
      accentColor: theme?.accentColor ?? null,
    };
  }
}
