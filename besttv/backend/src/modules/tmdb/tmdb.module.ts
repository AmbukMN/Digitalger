import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Logger,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageService } from '../../storage/storage.service';

/**
 * TMDB import — админ контент оруулах хурдасгагч.
 * Хайлт → сонгох → poster/backdrop-ийг TMDB-ээс ТАТАЖ R2-д хадгална
 * (hotlink хийхгүй), тайлбар/оноо/он/жанр автомат бөглөгдөнө.
 */
@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);
  private readonly base = 'https://api.themoviedb.org/3';
  private readonly imgBase = 'https://image.tmdb.org/t/p';

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  private get apiKey(): string {
    const key = this.config.get<string>('tmdb.apiKey');
    if (!key) throw new BadRequestException('TMDB_API_KEY тохируулаагүй байна');
    return key;
  }

  async search(q: string, type: 'movie' | 'tv') {
    const url = `${this.base}/search/${type}?api_key=${this.apiKey}&query=${encodeURIComponent(q)}&language=en-US`;
    const res = await fetch(url);
    if (!res.ok) throw new BadRequestException('TMDB хайлт амжилтгүй');
    const data = await res.json();
    return (data.results ?? []).slice(0, 10).map((r: any) => ({
      tmdbId: r.id,
      title: r.title ?? r.name,
      year: (r.release_date ?? r.first_air_date ?? '').slice(0, 4) || null,
      rating: r.vote_average,
      overview: r.overview,
      posterUrl: r.poster_path ? `${this.imgBase}/w342${r.poster_path}` : null,
    }));
  }

  /** Дэлгэрэнгүй + зургуудыг R2-д татаж хадгална */
  async importDetails(tmdbId: string, type: 'movie' | 'tv') {
    const url = `${this.base}/${type}/${tmdbId}?api_key=${this.apiKey}&language=en-US&append_to_response=credits`;
    const res = await fetch(url);
    if (!res.ok) throw new BadRequestException('TMDB мэдээлэл татаж чадсангүй');
    const d = await res.json();

    const [posterKey, backdropKey] = await Promise.all([
      d.poster_path
        ? this.mirrorImage(`${this.imgBase}/w780${d.poster_path}`, 'poster')
        : null,
      d.backdrop_path
        ? this.mirrorImage(`${this.imgBase}/original${d.backdrop_path}`, 'backdrop')
        : null,
    ]);

    return {
      titleEn: d.title ?? d.name,
      description: d.overview ?? '',
      year: Number((d.release_date ?? d.first_air_date ?? '').slice(0, 4)) || null,
      rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      durationSec: d.runtime ? d.runtime * 60 : null,
      actors: (d.credits?.cast ?? []).slice(0, 10).map((c: any) => c.name),
      genreNames: (d.genres ?? []).map((g: any) => g.name),
      seasonCount: d.number_of_seasons ?? null,
      posterKey,
      backdropKey,
      posterUrl: posterKey ? await this.storage.publicAssetUrl(posterKey, 7200) : null,
      backdropUrl: backdropKey ? await this.storage.publicAssetUrl(backdropKey, 7200) : null,
    };
  }

  private async mirrorImage(url: string, kind: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const sharp = (await import('sharp')).default;
      const webp = await sharp(buf).webp({ quality: 86 }).toBuffer();
      const key = `images/${kind}/tmdb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      await this.storage.upload(key, webp, 'image/webp');
      return key;
    } catch (err) {
      this.logger.warn(`TMDB зураг татаж чадсангүй: ${url}`, err);
      return null;
    }
  }
}

@Controller('admin/tmdb')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TmdbController {
  constructor(private readonly svc: TmdbService) {}

  @Get('search')
  search(@Query('q') q: string, @Query('type') type: 'movie' | 'tv' = 'movie') {
    return this.svc.search(q ?? '', type);
  }

  @Get('import/:id')
  import(@Param('id') id: string, @Query('type') type: 'movie' | 'tv' = 'movie') {
    return this.svc.importDetails(id, type);
  }
}

@Module({
  controllers: [TmdbController],
  providers: [TmdbService],
})
export class TmdbModule {}
