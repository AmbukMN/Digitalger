import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageService } from '../../storage/storage.service';
import { TranslateService } from './translate.service';

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
    /* ⚠️ Бөөнөөр нөхөхөд (enrichExisting) DB-д бичнэ */
    private readonly prisma: PrismaService,
    /* ⚠️ TMDB бүх текст АНГЛИ ирнэ — монгол сайтад тэр чигээр нь тавьж болохгүй */
    private readonly translate: TranslateService,
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
      /**
       * ⚠️⚠️ ГАРАЛ ҮҮСЭЛ — АВТОМАТ нөхөлтөд ЗААВАЛ шаардлагатай.
       *
       * Бодит алдаа: манай "Love MAP" (Монгол кино) нь TMDB-ийн
       * америк "Love Map (2021)"-тэй нэр нь ЯГ таарсан тул шалгуур
       * давж, америк жүжигчид/backdrop/он бүгд орж ирсэн.
       * Нэр таарах нь ХАНГАЛТГҮЙ — улс нь ч таарах ёстой.
       *
       * ⚠️ Админ ГАРААР сонгоход энэ нь ЗӨВХӨН мэдээлэл (хориглохгүй) —
       * хүн харж байгаа тул өөрөө шийднэ.
       */
      originalLanguage: r.original_language ?? null,
      originCountry: r.origin_country ?? null,
    }));
  }

  /** Дэлгэрэнгүй + зургуудыг R2-д татаж хадгална */
  async importDetails(tmdbId: string, type: 'movie' | 'tv') {
    const url = `${this.base}/${type}/${tmdbId}?api_key=${this.apiKey}&language=en-US&append_to_response=credits,videos`;
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

    /* ⚠️ Зэрэг татна — 8 зураг дараалан татвал импорт удаан */
    const castWithPhotos = await Promise.all(
      (d.credits?.cast ?? []).slice(0, 8).map(async (c: { name: string; character?: string; profile_path?: string | null }) => {
        const photoKey = c.profile_path
          ? await this.mirrorImage(`${this.imgBase}/w185${c.profile_path}`, 'cast')
          : null;
        return {
          name: c.name,
          character: c.character ?? '',
          photoKey,
          /**
           * ⚠️⚠️ `photoUrl` ЗААВАЛ — эс бөгөөс админд ЗУРАГ ХАРАГДАХГҮЙ.
           *
           * Bucket нь PRIVATE тул key-гээр шууд харуулж болдоггүй.
           * `CastEditor` нь `entry.photoUrl`-ыг уншдаг ба зөвхөн `photoKey`
           * буцаавал R2-д зураг БАЙГАА мөртлөө хоосон дүрс харагдана
           * (бодит алдаа байсан).
           */
          photoUrl: photoKey ? await this.storage.publicAssetUrl(photoKey, 7200) : null,
        };
      }),
    );

    const englishDescription: string = d.overview ?? '';
    const trailerYoutubeKey: string | null =
      (d.videos?.results ?? []).find(
        (v: { site?: string; type?: string; key?: string }) =>
          v.site === 'YouTube' && v.type === 'Trailer',
      )?.key ?? null;

    /**
     * ⚠️⚠️ AI ОРЧУУЛГА — TMDB бүх текстийг АНГЛИ өгдөг.
     *
     * Монгол сайтад англи тайлбар тавих нь хэрэглэгчийн туршлагыг
     * унагаана. Тиймээс тайлбар/дүрийн нэр/SEO-г монгол руу утгачилж
     * хөрвүүлнэ. Англи эх хувилбарыг `descriptionEn`-д хадгална
     * (EN UI дараа нэмэхэд бэлэн, мөн орчуулга буруу гарвал эхтэй нь тулгана).
     *
     * ⚠️ AI тохируулаагүй бол `null` ирнэ — англи хэвээр үлдэнэ, алдаа биш.
     */
    const tr = await this.translate.translateTitle({
      title: d.title ?? d.name ?? '',
      description: englishDescription,
      characters: castWithPhotos.map((c) => c.character),
    });

    /* ⚠️ Дүрийн нэрийг орчуулсан бол СОЛИНО — тоо таарсан эсэхийг
       TranslateService дотор шалгасан (таарахгүй бол эхийг буцаана) */
    const cast = tr
      ? castWithPhotos.map((c, i) => ({ ...c, character: tr.characters[i] ?? c.character }))
      : castWithPhotos;

    return {
      titleEn: d.title ?? d.name,
      /** ⚠️ Орчуулсан МОНГОЛ тайлбар (AI байхгүй бол англи эх) */
      description: tr?.description || englishDescription,
      /** ⚠️ Англи ЭХ хувилбар — орчуулгаас үл хамааран ҮРГЭЛЖ хадгална */
      descriptionEn: englishDescription,
      /** SEO — монголоор (AI байхгүй бол хоосон, админ гараар бичнэ) */
      metaTitle: tr?.metaTitle ?? '',
      metaDescription: tr?.metaDescription ?? '',
      /** Орчуулга ҮНЭХЭЭР хийгдсэн эсэх — админд toast-оор мэдэгдэнэ */
      translated: !!tr,
      year: Number((d.release_date ?? d.first_air_date ?? '').slice(0, 4)) || null,
      rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      durationSec: d.runtime ? d.runtime * 60 : null,
      /**
       * ⚠️ НАЙРУУЛАГЧ — `credits.crew` дотроос салгана.
       * ⚠️ Цуврал (`tv`) дээр "Director" ховор, "Creator"-ыг ч авна —
       * эс бөгөөс цувралын найруулагч ҮРГЭЛЖ хоосон үлдэнэ.
       */
      director:
        (d.credits?.crew ?? []).find(
          (c: { job?: string }) => c.job === 'Director' || c.job === 'Creator',
        )?.name ??
        (d.created_by ?? [])[0]?.name ??
        null,
      actors: (d.credits?.cast ?? []).slice(0, 10).map((c: any) => c.name),
      /**
       * ⚠️ ДЭЛГЭРЭНГҮЙ CAST — нэр + дүр + ЗУРАГ.
       *
       * `actors` нь зөвхөн нэрсийн жагсаалт (хуучин талбар). Кино
       * дэлгэрэнгүй хуудсанд жүжигчдийн зураг харуулдаг тул `cast`-ыг
       * бөглөвөл админ гараар нэг бүрчлэн оруулах шаардлагагүй болно.
       *
       * ⚠️ Зөвхөн ЭХНИЙ 8 — зураг бүр R2 руу mirror хийгддэг тул илүү
       * олон бол импорт удаан болж, сан дэмий дүүрнэ.
       */
      cast,
      genreNames: (d.genres ?? []).map((g: any) => g.name),
      seasonCount: d.number_of_seasons ?? null,
      posterKey,
      backdropKey,
      /**
       * ⚠️ ТРЕЙЛЕР — YouTube-ийн key (`dQw4w9WgXcQ` гэх мэт).
       *
       * `Title.trailerKey` нь МАНАЙ R2 дээрх HLS m3u8 зам тул тэнд
       * ХАДГАЛАХГҮЙ — тусдаа `trailerYoutubeKey` талбарт орно.
       * Манай HLS трейлер байхгүй үед л энийг тоглуулна.
       */
      trailerYoutubeKey,
      posterUrl: posterKey ? await this.storage.publicAssetUrl(posterKey, 7200) : null,
      backdropUrl: backdropKey ? await this.storage.publicAssetUrl(backdropKey, 7200) : null,
    };
  }

  /**
   * ОДОО БАЙГАА кинонуудын ДУТУУ мэдээллийг TMDB-ээс нөхнө.
   *
   * ⚠️⚠️ ЗӨВХӨН ХООСОН талбарыг бөглөнө — админ гараар оруулсан
   * тайлбар/зураг/жүжигчдийг ХЭЗЭЭ Ч дарж бичихгүй. Монгол киноны
   * тайлбар нь ихэвчлэн гараар бичигдсэн, TMDB-ийнх англи тул
   * дарж бичвэл ажил үрэгдэнэ.
   *
   * ⚠️ TMDB-д Монгол киноны ~50% л байдаг (хэмжилтээр). Олдоогүйг
   * АЛГАСНА — алдаа биш.
   *
   * ⚠️ Нэрээр хайхдаа `titleEn` байвал ТҮҮГЭЭР (илүү нарийн таарна),
   * эс бөгөөс кирилл нэрээр.
   */
  async enrichExisting(limit = 5, dryRun = false, offset = 0) {
    const titles = await this.prisma.title.findMany({
      /**
       * ⚠️⚠️ ШҮҮЛТҮҮРТ ЗӨВХӨН TMDB БӨГЛӨДӨГ талбарыг тавина.
       *
       * `director` нь `importDetails`-д ОГТ бөглөгддөггүй (TMDB-ийн
       * `credits.crew`-ээс салгадаггүй) тул шүүлтүүрт байвал бүх кино
       * ҮҮРД тааран, олдохгүй хэдий ч дахин дахин API дуудагдана.
       * `trailerYoutubeKey`/`metaDescription` ч мөн адил: TMDB-д
       * БАЙХГҮЙ 73 Монгол киног үүрд татсаар байх болно.
       *
       * Тиймээс тэднийг ХАСАВ — тэдгээрийг нөхөх өөр зам бий:
       * SEO нь `/admin/tmdb/seo` (AI, TMDB-гүй), трейлер/найруулагч нь
       * админ гараар. Ингэснээр `/enrich` нь ҮНЭХЭЭР дутуу кинонд л
       * хүрч, дэмий API дуудалт/хязгаар зарцуулахгүй.
       */
      where: {
        OR: [
          { rating: null },
          { year: null },
          { backdropKey: null },
          { cast: { equals: Prisma.DbNull } },
          { descriptionEn: null },
        ],
      },
      select: {
        id: true, title: true, titleEn: true, type: true,
        year: true, rating: true, description: true,
        backdropKey: true, director: true, cast: true,
        descriptionEn: true, trailerYoutubeKey: true,
        metaTitle: true, metaDescription: true,
      },
      /**
       * ⚠️ `skip` — олдоогүй кино `where`-д ҮЛДСЭЭР байдаг тул тогтмол
       * эрэмбээр дуудвал ҮРГЭЛЖ ижил эхний N-ийг шалгана. Дуудагч тал
       * `offset` нэмж бүх кинонд хүрнэ.
       */
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    });

    const done: { title: string; filled: string[] }[] = [];
    const skipped: string[] = [];

    for (const t of titles) {
      const q = t.titleEn?.trim() || t.title;
      const type = t.type === 'SERIES' ? 'tv' : 'movie';

      /**
       * ⚠️⚠️ ТААРЛЫГ ХАТУУ ШАЛГАНА — БУРУУ ДАТА ОРУУЛАХААС СЭРГИЙЛНЭ.
       *
       * Бодит жишээ: "Хүсэл" гэж хайхад TMDB нь `Lust and Caution (1993)`
       * гэсэн ОГТ ӨӨР кино буцаадаг. Эхний үр дүнг сохроор авбал 77
       * Монгол кинонд гадаад киноны жүжигчид/он/зураг орж, дата бохирдоно.
       *
       * Шалгуур:
       *   1) `titleEn` тохирсон бол — нэр нь ОЙРОЛЦООХ байх ёстой
       *   2) `titleEn` байхгүй (кирилл нэрээр хайсан) бол — TMDB-ийн
       *      үр дүнгийн нэр нь ГАЛИГ таарах ёстой (жишээ: "49 хоног"
       *      → "49 Khonog"). Эс бөгөөс АЛГАСНА.
       */
      type Cand = {
        tmdbId: number;
        title?: string;
        year?: string;
        originalLanguage?: string | null;
        originCountry?: string[] | null;
      };
      let hit: Cand | undefined;
      try {
        const results = (await this.search(q, type as 'movie' | 'tv')) as Cand[];
        /**
         * ⚠️⚠️ ЭХНИЙ үр дүнг СОХРООР авахгүй — МОНГОЛ гаралтайг ЭРЖ олно.
         *
         * Бодит алдаа: манай "Love MAP" (Монгол кино) нь TMDB-ийн америк
         * "Love Map (2021)"-тэй нэр ЯГ таарсан тул шалгуур давж, америк
         * жүжигчид/backdrop/он бүгд орсон. "Litsoneras" дээр филиппин
         * кино орсон. Нэр таарах нь ХАНГАЛТГҮЙ БАЙВ.
         *
         * Тиймээс автомат нөхөлт нь ЗӨВХӨН Монгол гаралтай (`mn` хэл
         * эсвэл `MN` улс) үр дүнг хүлээн авна. Бусад тохиолдолд админ
         * гараар сонгоно — тэнд хүн харж байгаа тул хориглох шаардлагагүй.
         */
        hit = results.find(
          (r) =>
            this.isLikelyMatch(q, r.title ?? '') &&
            (r.originalLanguage === 'mn' || (r.originCountry ?? []).includes('MN')),
        );
      } catch {
        /* хайлт унавал алгасна */
      }
      if (!hit) { skipped.push(t.title); continue; }

      let d: Awaited<ReturnType<typeof this.importDetails>>;
      try {
        d = await this.importDetails(String(hit.tmdbId), type as 'movie' | 'tv');
      } catch {
        skipped.push(t.title); continue;
      }

      /* ⚠️ ЗӨВХӨН хоосон талбар — байгааг хөндөхгүй */
      const data: Record<string, unknown> = {};
      const filled: string[] = [];
      if (t.rating == null && d.rating != null) { data.rating = d.rating; filled.push('үнэлгээ'); }
      if (t.year == null && d.year != null) { data.year = d.year; filled.push('он'); }
      if (!t.backdropKey && d.backdropKey) { data.backdropKey = d.backdropKey; filled.push('backdrop'); }
      if (!t.titleEn && d.titleEn) { data.titleEn = d.titleEn; filled.push('англи нэр'); }
      if (!t.director && d.director) { data.director = d.director; filled.push('найруулагч'); }
      if ((!t.cast || (Array.isArray(t.cast) && t.cast.length === 0)) && d.cast?.length) {
        /**
         * ⚠️ `photoUrl`-ыг DB-д ХАДГАЛАХГҮЙ — presign URL нь 2 цагийн
         * дараа хүчингүй болно. Зөвхөн `photoKey` үлдээж, харуулах үед
         * шинээр presign хийнэ (уншихад `titles.service` хөрвүүлдэг).
         */
        data.cast = d.cast.map(({ name, character, photoKey }) => ({
          name, character, photoKey,
        })) as unknown as Prisma.InputJsonValue;
        filled.push(`${d.cast.length} жүжигчин`);
      }
      /* ⚠️ Англи эх тайлбар — орчуулга шалгах/EN UI-д хэрэгтэй */
      if (!t.descriptionEn && d.descriptionEn) {
        data.descriptionEn = d.descriptionEn;
        filled.push('англи тайлбар');
      }
      if (!t.trailerYoutubeKey && d.trailerYoutubeKey) {
        data.trailerYoutubeKey = d.trailerYoutubeKey;
        filled.push('трейлер');
      }
      /* ⚠️ SEO — AI орчуулга идэвхтэй үед л утга ирнэ (эс бөгөөс хоосон) */
      if (!t.metaTitle && d.metaTitle) { data.metaTitle = d.metaTitle; filled.push('SEO гарчиг'); }
      if (!t.metaDescription && d.metaDescription) {
        data.metaDescription = d.metaDescription;
        filled.push('SEO тайлбар');
      }
      /**
       * ⚠️⚠️ ТАЙЛБАРЫГ ЗӨВХӨН ХООСОН үед бөглөнө.
       * Монгол киноны тайлбарыг админ ГАРААР бичсэн байдаг — TMDB-ийн
       * орчуулгаар дарж бичвэл тэр ажил үрэгдэнэ.
       */
      if (!t.description?.trim() && d.description?.trim()) {
        data.description = d.description;
        filled.push(d.translated ? 'тайлбар (орчуулсан)' : 'тайлбар');
      }

      if (!filled.length) { skipped.push(t.title); continue; }
      if (!dryRun) await this.prisma.title.update({ where: { id: t.id }, data });
      done.push({ title: t.title, filled });
    }

    return { done, skipped, checked: titles.length };
  }

  /**
   * TMDB-д БАЙХГҮЙ Монгол кинонуудад AI-аар SEO бичнэ.
   *
   * ⚠️⚠️ ЯАГААД ЭНЭ ХЭРЭГТЭЙ ВЭ: манай 77 киноны 73 нь TMDB-д байхгүй
   * тул `enrichExisting` тэдэнд хүрэхгүй. Тэдний тайлбар МОНГОЛ бөгөөс
   * SEO нь ХООСОН — Google-д огт индексжихгүй. Энэ нь TMDB-ээс огт
   * хамааралгүй, зөвхөн байгаа тайлбар дээр тулгуурлаж SEO үүсгэнэ.
   *
   * ⚠️ Тайлбаргүй киног АЛГАСНА — юунаас ч үүсгэх аргагүй.
   */
  async generateMissingSeo(limit = 10, dryRun = false) {
    if (!this.translate.enabled) {
      throw new BadRequestException(
        'AI тохируулаагүй байна — .env-д OPENAI_API_KEY эсвэл ANTHROPIC_API_KEY нэмнэ үү',
      );
    }

    const titles = await this.prisma.title.findMany({
      where: {
        /* ⚠️ Тайлбартай МӨРТЛӨӨ SEO-гүй кинонууд */
        description: { not: '' },
        OR: [{ metaDescription: null }, { metaDescription: '' }],
      },
      select: {
        id: true, title: true, description: true, year: true,
        genres: { select: { genre: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    /**
     * ⚠️ ЗӨВХӨН нэрийг биш, БИЧИГДЭХ ТЕКСТИЙГ буцаана — эс бөгөөс
     * `dry=1` нь утгагүй: админ юу бичигдэхийг харалгүй баталгаажуулна.
     */
    const done: { title: string; metaTitle: string; metaDescription: string }[] = [];
    const skipped: string[] = [];

    for (const t of titles) {
      const seo = await this.translate.generateSeo({
        title: t.title,
        description: t.description,
        year: t.year,
        genres: t.genres.map((g) => g.genre.name),
      });
      if (!seo) { skipped.push(t.title); continue; }

      if (!dryRun) {
        await this.prisma.title.update({
          where: { id: t.id },
          data: { metaTitle: seo.metaTitle, metaDescription: seo.metaDescription },
        });
      }
      done.push({ title: t.title, ...seo });
    }

    /**
     * ⚠️ Үлдсэн тоог хэлнэ — админ дахин ажиллуулах эсэхээ мэдэхэд.
     * ⚠️ Бичсэний ДАРАА тоолж байгаа тул `done`-ыг ДАХИН ХАСАХГҮЙ
     * (DB аль хэдийн шинэчлэгдсэн). `dryRun` үед л тэд тоонд үлдэнэ.
     */
    const remaining = await this.prisma.title.count({
      where: {
        description: { not: '' },
        OR: [{ metaDescription: null }, { metaDescription: '' }],
      },
    });

    return { done, skipped, checked: titles.length, remaining };
  }

  /**
   * Хайсан нэр ↔ TMDB-ийн нэр ҮНЭХЭЭР нэг кино мөн эсэх.
   *
   * ⚠️ Монгол нэрийг ГАЛИГААР харьцуулна ("49 хоног" ↔ "49 Khonog").
   * Тоо/үг давхцаж байвал л зөвшөөрнө — эс бөгөөс огт өөр кино орно.
   */
  private isLikelyMatch(query: string, tmdbTitle: string): boolean {
    const TR: Record<string, string> = {
      а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'i',к:'k',
      л:'l',м:'m',н:'n',о:'o',ө:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ү:'u',ф:'f',
      х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya',
    };
    const norm = (v: string) =>
      v.toLowerCase()
        .split('').map((c) => TR[c] ?? c).join('')
        .replace(/kh/g, 'h')
        .replace(/[^a-z0-9]/g, '');

    const a = norm(query);
    const b = norm(tmdbTitle);
    if (!a || !b) return false;

    /**
     * ⚠️⚠️ ЗӨВХӨН ЯГ ТААРАХ эсвэл БҮТЭН АГУУЛАГДАХ үед л зөвшөөрнө.
     *
     * "Эхний 6 тэмдэгт таарвал болно" гэсэн ЗӨӨЛӨН дүрэм байсан нь
     * production дээр БУРУУ ДАТА оруулсан (бодит жишээ):
     *   "Шим"   → "Мегащенки Электролапы и Шиммер и Шайн"  ❌
     *   "RHYME" → "Nursery Rhyme"                          ❌
     * Ийм алдаа нь хэрэглэгчид ХАРАГДАХ тул хатуу байх нь зөв —
     * олдохгүй өнгөрөх нь буруу дата оруулахаас ХАМААГҮЙ дээр.
     *
     * ⚠️ Богино нэр (<5 тэмдэгт) нь санамсаргүй таарах магадлал өндөр
     * тул ЯГ ТААРАХЫГ шаардана ("shim" ⊄ "shimmer").
     */
    if (a === b) return true;
    if (a.length < 5 || b.length < 5) return false;

    /**
     * ⚠️ АГУУЛАГДАХ нь ГАНЦААРАА ХАНГАЛТГҮЙ — урт нь хэт зөрвөл өөр кино:
     *   "rhyme"  ⊂ "nurseryrhyme"  → ӨӨР кино ❌ (2.4 дахин урт)
     *   "49honog" ⊂ "49honog2024"  → ИЖИЛ кино ✅ (1.6 дахин)
     * Тиймээс богино нь уртынхаа 60%-иас багагүй байхыг шаардана.
     */
    if (!(a.includes(b) || b.includes(a))) return false;
    const [shortLen, longLen] = a.length < b.length ? [a.length, b.length] : [b.length, a.length];
    return shortLen / longLen >= 0.6;
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
  constructor(
    private readonly svc: TmdbService,
    private readonly translate: TranslateService,
  ) {}

  @Get('search')
  search(@Query('q') q: string, @Query('type') type: 'movie' | 'tv' = 'movie') {
    return this.svc.search(q ?? '', type);
  }

  /**
   * AI орчуулга идэвхтэй эсэх — админ UI-д "орчуулна/орчуулахгүй" гэдгийг
   * УРЬДЧИЛЖ харуулна (импорт хийсний дараа англи гарч ирвэл гайхахгүй).
   */
  @Get('status')
  status() {
    return { translation: this.translate.enabled };
  }

  /**
   * Бөөнөөр нөхөх — дутуу мэдээлэлтэй кинонуудыг TMDB-ээс бөглөнө.
   * ⚠️ Удаан (кино бүрд 2 API дуудалт + зураг татах) тул `limit` багаар.
   */
  @Post('enrich')
  enrich(
    @Query('limit') limit?: string,
    @Query('dry') dry?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.enrichExisting(
      Math.min(20, Number(limit) || 5),
      dry === '1',
      Math.max(0, Number(offset) || 0),
    );
  }

  /**
   * TMDB-д БАЙХГҮЙ Монгол кинонуудад AI-аар SEO бичнэ.
   * ⚠️ `/enrich`-ЭЭС ӨӨР: энэ нь TMDB огт дуудахгүй, зөвхөн байгаа
   * монгол тайлбар дээр тулгуурлана.
   */
  @Post('seo')
  seo(@Query('limit') limit?: string, @Query('dry') dry?: string) {
    return this.svc.generateMissingSeo(Math.min(30, Number(limit) || 10), dry === '1');
  }

  @Get('import/:id')
  import(@Param('id') id: string, @Query('type') type: 'movie' | 'tv' = 'movie') {
    return this.svc.importDetails(id, type);
  }
}

@Module({
  controllers: [TmdbController],
  providers: [TmdbService, TranslateService],
})
export class TmdbModule {}
