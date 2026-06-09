import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CloudflareStreamService } from '../../storage/cloudflare-stream.service';
import { pickActiveOrder } from '../../common/access-expiry';
import { QA_ALLOWED_MIME_TYPES, QA_ATTACHMENT_MAX_SIZE } from './dto/qa.dto';

/** Q&A асуулт/хариултад дамжуулах хавсралтын мета (uploads-аар R2-д хуулсан key). */
export interface QaAttachmentInput {
  attachmentKey?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
}

@Injectable()
export class CoursesService {
  // Сертификатын HTML дотор лого/баталгаажуулах линкэд ашиглах frontend url.
  private readonly siteUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly stream: CloudflareStreamService,
    private readonly config: ConfigService,
  ) {
    this.siteUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://digitalger.mn';
  }

  /**
   * Тухайн курсын product-д хэрэглэгчид ИДЭВХТЭЙ (хугацаа дуусаагүй) хандах эрх
   * байгаа эсэх. Бүх PAID захиалгаас аль нэг идэвхтэй (expiresAt null=насан
   * туршийн ЭСВЭЛ ирээдүйд) байвал true. Хугацаа дууссан/эзэмшээгүй бол false.
   */
  private async hasActiveCourseAccess(userId: string, productId: string): Promise<boolean> {
    const orders = await this.prisma.order.findMany({
      where: { userId, status: OrderStatus.PAID, items: { some: { productId } } },
      select: { id: true, expiresAt: true },
    });
    return !!pickActiveOrder(orders);
  }

  /**
   * Хичээлийн poster (thumbnail) URL resolve хийнэ — нийтийн жагсаалт + видео хариуд.
   * Эрэмбэ:
   *  1) lesson.posterKey (admin upload) → R2 PUBLIC url (getAssetUrl, social share OK).
   *  2) videoStreamId (Cloudflare Stream) → автомат thumbnail (эхний 10сек frame).
   *  3) R2 видео (videoKey) → null (frontend видеоны эхний frame-ийг харуулна).
   * @returns public poster url эсвэл null.
   */
  private resolvePosterUrl(lesson: {
    posterKey?: string | null;
    videoStreamId?: string | null;
  }): string | null {
    if (lesson.posterKey) {
      return this.storage.getAssetUrl(lesson.posterKey);
    }
    if (lesson.videoStreamId) {
      return this.stream.getThumbnailUrl(lesson.videoStreamId);
    }
    return null;
  }

  async getLessonsByProductSlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, published: true },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: {
                  orderBy: { sortOrder: 'asc' },
                  include: { _count: { select: { resources: true } } },
                },
              },
            },
            lessons: {
              orderBy: { sortOrder: 'asc' },
              include: { _count: { select: { resources: true } } },
            },
          },
        },
      },
    });

    if (!product?.course) {
      throw new NotFoundException('Course not found for this product');
    }

    // ⚠️ content нь зөвхөн entitlement (худалдан авсан/preview) шалгасны дараа —
    // нийтийн жагсаалтад content БҮҮ оруул. Энд зөвхөн meta + хавсралтын тоо.
    const mapLesson = (lesson: any) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      durationSec: lesson.durationSec,
      sortOrder: lesson.sortOrder,
      isFreePreview: lesson.isFreePreview,
      moduleId: lesson.moduleId ?? null,
      hasVideo: Boolean(lesson.videoKey || lesson.videoUrl || lesson.videoStreamId),
      // Poster: admin upload (posterKey) → Stream автомат thumbnail → null (R2 видео).
      posterUrl: this.resolvePosterUrl(lesson),
      resourceCount: lesson._count?.resources ?? 0,
      hasResources: (lesson._count?.resources ?? 0) > 0,
    });

    // Lessons with no module (ungrouped)
    const ungroupedLessons = product.course.lessons
      .filter((l) => !l.moduleId)
      .map(mapLesson);

    return {
      productId: product.id,
      productTitle: product.title,
      courseId: product.course.id,
      modules: product.course.modules.map((m) => ({
        id: m.id,
        title: m.title,
        sortOrder: m.sortOrder,
        lessons: m.lessons.map(mapLesson),
      })),
      lessons: ungroupedLessons,
    };
  }

  async getLessonVideoUrl(productSlug: string, lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        course: { product: { slug: productSlug } },
      },
      include: {
        course: { include: { product: true } },
        resources: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Entitlement шалгалт — preview биш бол ИДЭВХТЭЙ (хугацаа дуусаагүй) PAID
    // order заавал (бүх эх сурвалжид адил). Дууссан бол хандах эрхгүй.
    if (!lesson.isFreePreview) {
      const active = await this.hasActiveCourseAccess(userId, lesson.course.productId);
      if (!active) {
        throw new NotFoundException('Access denied');
      }
    }

    // Entitlement аль хэдийн шалгасан тул content + resources meta аюулгүй буцаана.
    // Resource-ийн ТАТАХ signed url-г энд буцаахгүй — frontend тусдаа
    // GET :productSlug/resources/:resourceId/download endpoint дуудна.
    const extras = {
      content: lesson.content ?? null,
      // Poster: admin upload (posterKey) → Stream автомат thumbnail → null (R2 видео).
      posterUrl: this.resolvePosterUrl(lesson),
      resources: lesson.resources.map((r) => ({
        id: r.id,
        fileName: r.fileName,
        sizeBytes: r.sizeBytes,
        mimeType: r.mimeType,
      })),
    };

    // 1) Cloudflare Stream (ШИНЭ) — signed playback token.
    if (lesson.videoStreamId) {
      if (!this.stream.configured) {
        throw new NotFoundException('Stream тохируулаагүй байна');
      }
      const ttl = 7200;
      let token: string;
      try {
        token = await this.stream.getSignedPlaybackToken(lesson.videoStreamId, ttl);
      } catch {
        throw new NotFoundException('Playback token үүсгэж чадсангүй');
      }
      return {
        lessonId: lesson.id,
        type: 'stream' as const,
        streamToken: token,
        hlsUrl: this.stream.hlsUrl(lesson.videoStreamId, token),
        iframeUrl: this.stream.iframeUrl(token),
        expiresIn: ttl,
        ...extras,
      };
    }

    // 2) Гадаад линк (YouTube/Vimeo) — хэвээр.
    if (lesson.videoUrl) {
      return { lessonId: lesson.id, type: 'external' as const, url: lesson.videoUrl, expiresIn: null, ...extras };
    }

    // 3) R2 видео — НИЙТИЙН public URL (TTL-гүй, social share/copy-paste OK).
    // ⚠️ R2 нь үнэгүй/нээлттэй контентод (preview), бодит хамгаалалт Cloudflare Stream-д.
    // Тиймээс presigned (хугацаатай) биш public url буцаана — линк хуваалцахад тасрахгүй.
    if (lesson.videoKey) {
      const url = this.storage.getAssetUrl(lesson.videoKey);
      return { lessonId: lesson.id, type: 'r2' as const, url, expiresIn: null, ...extras };
    }

    // 4) Видеогүй хичээл (зөвхөн тэмдэглэл/материал) — АЛДАА БИШ.
    // content + resources буцаана (frontend "Видео хараахан оруулаагүй" + тэмдэглэл харна).
    return { lessonId: lesson.id, type: 'none' as const, expiresIn: null, ...extras };
  }

  /**
   * Тухайн хичээлд хэрэглэгчид хандах эрх (entitlement) байгаа эсэхийг шалгана.
   * isFreePreview бол үргэлж зөвшөөрнө, эс бол PAID order заавал.
   * Хэрэглэлгүй бол ForbiddenException шиднэ.
   */
  private async ensureLessonAccess(productSlug: string, lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, course: { product: { slug: productSlug } } },
      include: { course: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (!lesson.isFreePreview) {
      const active = await this.hasActiveCourseAccess(userId, lesson.course.productId);
      if (!active) {
        throw new ForbiddenException('Access denied');
      }
    }
    return lesson;
  }

  /**
   * Хичээл үзэлтийн явц хадгална (continue watching + дууссан тэмдэглэгээ).
   * watchedSeconds нь сүүлд зогссон байрлал. durationSec*0.9-аас давсан бол completed=true.
   */
  async saveLessonProgress(
    productSlug: string,
    lessonId: string,
    userId: string,
    dto: { watchedSeconds: number; durationSec?: number; completed?: boolean },
  ) {
    const lesson = await this.ensureLessonAccess(productSlug, lessonId, userId);

    const watchedSeconds = Math.max(0, Math.floor(dto.watchedSeconds ?? 0));
    // durationSec: client өгвөл түүнийг, эс бөгөөс хичээлийн (admin тохируулсан)
    // durationSec-ийг fallback болгож ашиглана. Энэ нь 90% threshold ажиллахад чухал
    // (зарим тоглуулагч metadata-гүй бол client duration илгээдэггүй).
    const fallbackDuration =
      lesson.durationSec !== null && lesson.durationSec > 0 ? lesson.durationSec : undefined;
    const durationSec =
      dto.durationSec !== undefined && dto.durationSec !== null && dto.durationSec > 0
        ? Math.max(0, Math.floor(dto.durationSec))
        : fallbackDuration;

    // 90%-аас дээш үзсэн бол автоматаар дууссан гэж тэмдэглэнэ.
    const autoCompleted =
      durationSec && durationSec > 0 ? watchedSeconds >= durationSec * 0.9 : false;
    const completed = dto.completed ?? autoCompleted;

    const progress = await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        watchedSeconds,
        ...(durationSec !== undefined && { durationSec }),
        completed,
      },
      update: {
        watchedSeconds,
        ...(durationSec !== undefined && { durationSec }),
        completed,
      },
    });

    return {
      lessonId: progress.lessonId,
      watchedSeconds: progress.watchedSeconds,
      durationSec: progress.durationSec,
      completed: progress.completed,
    };
  }

  /**
   * Тухайн course-ийн бүх хичээлд хэрэглэгчийн үзэлтийн явц.
   * Continue watching болон явцын мөрөнд ашиглана.
   */
  async getCourseProgress(productSlug: string, userId: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug },
      select: { course: { select: { id: true } } },
    });
    if (!product?.course) {
      throw new NotFoundException('Course not found for this product');
    }

    const progress = await this.prisma.lessonProgress.findMany({
      where: { userId, lesson: { courseId: product.course.id } },
      select: {
        lessonId: true,
        watchedSeconds: true,
        durationSec: true,
        completed: true,
        // Progress-д durationSec байхгүй бол хичээлийн durationSec-ийг fallback болгоно.
        lesson: { select: { durationSec: true } },
      },
    });

    // durationSec баталгаажуулах: progress-д null бол хичээлийн durationSec ашиглах.
    // Frontend бодит үзсэн % (watchedSeconds/durationSec) тооцоход чухал.
    return progress.map((p) => ({
      lessonId: p.lessonId,
      watchedSeconds: p.watchedSeconds,
      durationSec: p.durationSec ?? p.lesson?.durationSec ?? null,
      completed: p.completed,
    }));
  }

  /**
   * Хичээлийн хавсралт файлыг татах signed URL үүсгэнэ.
   * Entitlement (isFreePreview эсвэл PAID order) шалгасны дараа л url буцаана.
   * @returns { url, fileName }
   */
  async getLessonResourceUrl(productSlug: string, resourceId: string, userId: string) {
    const resource = await this.prisma.lessonResource.findFirst({
      where: {
        id: resourceId,
        lesson: { course: { product: { slug: productSlug } } },
      },
      include: {
        lesson: { include: { course: true } },
      },
    });
    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    // Entitlement — preview бус хичээлийн хавсралт бол ИДЭВХТЭЙ PAID order заавал.
    if (!resource.lesson.isFreePreview) {
      const active = await this.hasActiveCourseAccess(userId, resource.lesson.course.productId);
      if (!active) {
        throw new ForbiddenException('Access denied');
      }
    }

    const url = await this.storage.getPresignedUrl(resource.fileKey, 3600, 'get');
    return { url, fileName: resource.fileName, expiresIn: 3600 };
  }

  // ── Certificate (курс 100% дуусахад) ────────────────────────────────────────

  /** Богино unique сертификатын дугаар: DG-XXXXXX (6 тэмдэгт base36). */
  private generateCertNo(): string {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const time = Date.now().toString(36).slice(-2).toUpperCase();
    return `DG-${time}${rand}`;
  }

  /**
   * Сертификатын дугаарыг ХАРУУЛАХ формат — '#' угтвартай (#DG-XXXXXX).
   * ⚠️ DB-д хадгалах утга хэвээр (DG-XXXXXX), зөвхөн HTML-д # угтвар нэмнэ.
   * Аль хэдийн '#' байвал давхар нэмэхгүй.
   */
  private formatCertNoDisplay(certNo: string): string {
    return certNo.startsWith('#') ? certNo : `#${certNo}`;
  }

  /**
   * Курсын бүх хичээл дууссан эсэхийг шалгаад сертификат олгоно (upsert).
   * Аль хэдийн байвал тухайн сертификатыг буцаана. 100% дуусаагүй бол алдаа.
   */
  async issueCertificate(productSlug: string, userId: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug },
      select: {
        id: true,
        title: true,
        course: { select: { id: true } },
      },
    });
    if (!product?.course) {
      throw new NotFoundException('Course not found for this product');
    }

    // Курс авах эрх (PAID order) заавал — preview хичээлээр сертификат олгохгүй.
    const owned = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PAID,
        items: { some: { productId: product.id } },
      },
    });
    if (!owned) {
      throw new ForbiddenException('Access denied');
    }

    // Аль хэдийн олгогдсон бол давтан тооцоолохгүй шууд буцаана.
    const existing = await this.prisma.certificate.findUnique({
      where: { userId_productId: { userId, productId: product.id } },
    });
    if (existing) {
      return existing;
    }

    // Курсын нийт хичээл vs хэрэглэгчийн дууссан хичээлүүд.
    const totalLessons = await this.prisma.lesson.count({
      where: { courseId: product.course.id },
    });
    if (totalLessons === 0) {
      throw new BadRequestException('Курст хичээл байхгүй байна');
    }

    const completedLessons = await this.prisma.lessonProgress.count({
      where: {
        userId,
        completed: true,
        lesson: { courseId: product.course.id },
      },
    });

    if (completedLessons < totalLessons) {
      throw new BadRequestException('Курсыг бүрэн дуусгаагүй байна');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const userName = user?.name?.trim() || user?.email || 'Хэрэглэгч';

    // certNo unique тул мөргөлдвөл хэдэн удаа давтаж оролдоно.
    let certNo = this.generateCertNo();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await this.prisma.certificate.findUnique({ where: { certNo } });
      if (!clash) break;
      certNo = this.generateCertNo();
    }

    // userId_productId дээр upsert — race үед давхар үүсэхээс хамгаална.
    return this.prisma.certificate.upsert({
      where: { userId_productId: { userId, productId: product.id } },
      create: {
        certNo,
        userId,
        productId: product.id,
        courseTitle: product.title,
        userName,
      },
      update: {},
    });
  }

  /**
   * Хэрэглэгчийн тухайн курсын сертификатын meta буцаана.
   * Байхгүй бол null (курс дуусгаагүй эсвэл олгоогүй).
   */
  async getCertificate(productSlug: string, userId: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug },
      select: { id: true, course: { select: { id: true } } },
    });
    if (!product?.course) {
      throw new NotFoundException('Course not found for this product');
    }

    const cert = await this.prisma.certificate.findUnique({
      where: { userId_productId: { userId, productId: product.id } },
    });

    // Дуусгасан явц (progress) — frontend дээр "сертификат авах" товч идэвхжүүлэхэд.
    const [totalLessons, completedLessons] = await Promise.all([
      this.prisma.lesson.count({ where: { courseId: product.course.id } }),
      this.prisma.lessonProgress.count({
        where: { userId, completed: true, lesson: { courseId: product.course.id } },
      }),
    ]);

    return {
      certificate: cert,
      totalLessons,
      completedLessons,
      eligible: totalLessons > 0 && completedLessons >= totalLessons,
    };
  }

  /**
   * Хэрэглэгчийн БҮХ авсан сертификатыг жагсаана ("Миний сертификат").
   * ⚠️ Олон курс дуусгасан бол курс тус бүрд тусдаа сертификат (өөр certNo/
   * courseTitle/issuedAt). issuedAt буурахаар (шинэ нь эхэнд) эрэмбэлнэ.
   * Тус бүрд хэвлэх/харах viewUrl (нийтийн /view линк) дагалдана.
   */
  async listMyCertificates(userId: string) {
    const certs = await this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
    });

    // ⚠️ Certificate model-д product relation БАЙХГҮЙ (зөвхөн productId scalar).
    // Тиймээс холбоотой product-уудыг тусад нь нэг query-ээр татаж map болгоно.
    const productIds = [...new Set(certs.map((c) => c.productId))];
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            slug: true,
            title: true,
            previewUrl: true,
            // primary зураг + thumbnail variant-аас thumbnail url resolve хийнэ.
            images: {
              orderBy: { sortOrder: 'asc' },
              include: { variants: { select: { size: true, fileKey: true } } },
            },
          },
        })
      : [];
    const productById = new Map(products.map((p) => [p.id, p]));

    return certs.map((c) => {
      const product = productById.get(c.productId);
      // products.service-тэй ИЖИЛ логик: primary (видео биш) зураг → thumbnail variant.
      const images = product?.images ?? [];
      const primary =
        images.find((i) => i.isPrimary && !i.videoUrl) ??
        images.filter((i) => !i.videoUrl).sort((a, b) => a.sortOrder - b.sortOrder)[0];
      const thumbVariant = primary?.variants?.find((v) => v.size === 'thumbnail');
      const productThumbnail = primary
        ? this.storage.getAssetUrl(thumbVariant?.fileKey ?? primary.fileKey)
        : (product?.previewUrl ?? null);

      return {
        certNo: c.certNo,
        courseTitle: c.courseTitle,
        userName: c.userName,
        issuedAt: c.issuedAt,
        productSlug: product?.slug ?? null,
        productTitle: product?.title ?? c.courseTitle,
        productThumbnail,
        viewUrl: `${this.siteUrl}/courses/certificate/${encodeURIComponent(c.certNo)}/view`,
      };
    });
  }

  /**
   * Нийтийн баталгаажуулах — certNo-оор сертификат олж сайхан HTML буцаана.
   * ⚠️ PDF биш HTML (кирилл найдвартай); frontend хэвлэх/PDF болгоно.
   * Landscape дизайн (хүрээ, лого, гарын үсэг хэсэг).
   */
  async getCertificateHtml(certNo: string): Promise<string> {
    const cert = await this.prisma.certificate.findUnique({
      where: { certNo },
    });
    if (!cert) {
      throw new NotFoundException('Сертификат олдсонгүй');
    }

    const issued = new Date(cert.issuedAt);
    const dateStr = `${issued.getFullYear()} оны ${String(issued.getMonth() + 1).padStart(2, '0')} сарын ${String(issued.getDate()).padStart(2, '0')}`;
    const verifyUrl = `${this.siteUrl}/courses/certificate/${encodeURIComponent(cert.certNo)}/view`;

    const sig = await this.getCertSignature();

    return this.buildCertificateHtml({
      userName: cert.userName,
      courseTitle: cert.courseTitle,
      certNo: cert.certNo,
      dateStr,
      verifyUrl,
      ...sig,
    });
  }

  /**
   * Сертификатын гарын үсэг тохиргоо (SiteSetting) → footer-т ашиглах.
   * certSignatureUrl байвал R2 public url болгож буцаана.
   */
  private async getCertSignature(): Promise<{
    signatureUrl?: string;
    signerName: string;
    signerTitle: string;
  }> {
    const setting = await this.prisma.siteSetting.findUnique({
      where: { id: 'default' },
      select: { certSignatureUrl: true, certSignerName: true, certSignerTitle: true },
    });

    const rawSig = setting?.certSignatureUrl?.trim();
    return {
      signatureUrl: rawSig ? this.storage.getAssetUrl(rawSig) : undefined,
      signerName: setting?.certSignerName?.trim() || 'Г. Амгаланбаяр',
      signerTitle: setting?.certSignerTitle?.trim() || 'Гүйцэтгэх захирал',
    };
  }

  /**
   * Admin preview — demo дата (жишээ нэр/курс/огноо)-аар сертификат HTML буцаана.
   * Бодит сертификат үүсгэхгүй, зөвхөн дизайн харах зорилготой (admin шинэ tab).
   * @param opts.userName demo хэрэглэгчийн нэр (default "Бат-Эрдэнэ")
   * @param opts.courseTitle demo курсын нэр (default жишээ нэр)
   */
  async getCertificatePreviewHtml(opts?: {
    userName?: string;
    courseTitle?: string;
  }): Promise<string> {
    const userName = opts?.userName?.trim() || 'Бат-Эрдэнэ';
    const courseTitle = opts?.courseTitle?.trim() || 'Дижитал маркетингийн суурь курс';

    // Preview дээр ӨНӨӨДРИЙН огноо.
    const now = new Date();
    const dateStr = `${now.getFullYear()} оны ${String(now.getMonth() + 1).padStart(2, '0')} сарын ${String(now.getDate()).padStart(2, '0')}`;
    const certNo = 'DG-DEMO';
    const verifyUrl = `${this.siteUrl}/courses/certificate/${encodeURIComponent(certNo)}/view`;

    const sig = await this.getCertSignature();

    return this.buildCertificateHtml({
      userName,
      courseTitle,
      certNo,
      dateStr,
      verifyUrl,
      ...sig,
    });
  }

  /**
   * Landscape ENTERPRISE сертификатын HTML дизайн (хэвлэх/баталгаажуулах).
   * QR код (verifyUrl) async тул метод async — дуудагч await хийнэ.
   */
  private async buildCertificateHtml(opts: {
    userName: string;
    courseTitle: string;
    certNo: string;
    dateStr: string;
    verifyUrl: string;
    signatureUrl?: string;
    signerName: string;
    signerTitle: string;
  }): Promise<string> {
    const esc = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // ⚠️ Сертификатын лого — 'DigitalGer-color logo-NoBG.png' (ил тод background, space encode).
    const logoUrl = `${this.siteUrl}/brand/DigitalGer-color%20logo-NoBG.png`;

    // ── Default тамга/гарын үсэг SVG (public/brand) ──
    // Гарын үсэг: admin upload (certSignatureUrl) байвал тэр, байхгүй бол бодит SVG.
    const signatureSrc =
      opts.signatureUrl || `${this.siteUrl}/brand/signature-amgalanbayar.svg`;
    // DigitalGer LLC албан ёсны дугуй тамга (баруун footer — олон улсын маяг).
    const llcSealUrl = `${this.siteUrl}/brand/seal-digitalger-llc.svg`;
    // Харуулах certNo (# угтвартай).
    const certNoDisplay = this.formatCertNoDisplay(opts.certNo);

    // ── QR код (verifyUrl) — скан хийж баталгаажуулна (enterprise стандарт) ──
    // Алдаа гарвал (offline орчин г.м) QR-гүй үргэлжилнэ.
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(opts.verifyUrl, {
        width: 132,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#022179', light: '#ffffff' },
      });
    } catch {
      qrDataUrl = '';
    }

    // ── Курс нэрний font-size автомат тааруулах (overflow засах) ──
    // Урт нэр → жижиг font + 2 мөр зөвшөөрнө; богино → том. Нэг логик.
    const courseLen = opts.courseTitle.length;
    const courseFontPx = courseLen > 78 ? 18 : courseLen > 52 ? 21 : courseLen > 32 ? 25 : 29;

    // ── Footer зүүн багана: гарын үсэг зураг (admin upload эсвэл default SVG) ──
    const signatureBlock = `<img class="sig-img" src="${esc(signatureSrc)}" alt="Г.Амгаланбаяр гарын үсэг" />`;

    // ── QR block (байвал) ──
    const qrBlock = qrDataUrl
      ? `<div class="qr">
           <img src="${qrDataUrl}" alt="Баталгаажуулах QR" />
           <div class="qr-cap">Скан&nbsp;хийж<br/>баталгаажуулна</div>
         </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Сертификат — ${esc(opts.userName)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --navy: #022179;
    --gold: #ffbe00;
    --ink: #2a2f45;
    --muted: #6b7280;
  }
  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Noto Sans', 'Noto Sans Mongolian', Arial, sans-serif;
    background: #e9edf5;
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
  }

  /* ── Хуудас (A4 landscape, цагаан дэвсгэр) ── */
  .sheet {
    width: 1040px;
    max-width: 100%;
    aspect-ratio: 1.414 / 1;
    background: #ffffff;
    position: relative;
    overflow: hidden;
    box-shadow: 0 24px 70px rgba(2,33,121,0.22);
  }

  /* ── Булангийн navy гурвалжингууд (clip-path) ── */
  .corner {
    position: absolute;
    width: 200px;
    height: 200px;
    background: var(--navy);
    z-index: 2;
    pointer-events: none;
  }
  .corner.tr { top: 0; right: 0; clip-path: polygon(100% 0, 0 0, 100% 100%); }
  .corner.bl { bottom: 0; left: 0; clip-path: polygon(0 0, 0 100%, 100% 100%); }
  .corner.br { bottom: 0; right: 0; clip-path: polygon(100% 0, 100% 100%, 0 100%); }
  /* Gold нимгэн accent гурвалжингууд (булан тус бүрд давхар өнгө) */
  .corner-accent {
    position: absolute;
    width: 132px;
    height: 132px;
    background: var(--gold);
    z-index: 1;
    pointer-events: none;
  }
  .corner-accent.tr { top: 0; right: 0; clip-path: polygon(100% 0, 30% 0, 100% 70%); }
  .corner-accent.bl { bottom: 0; left: 0; clip-path: polygon(0 30%, 0 100%, 70% 100%); }
  .corner-accent.br { bottom: 0; right: 0; clip-path: polygon(100% 30%, 100% 100%, 30% 100%); }

  /* ── Gold inner border (цэгтэй нимгэн хүрээ) ── */
  .frame {
    position: absolute;
    inset: 26px;
    border: 2px solid var(--gold);
    z-index: 3;
    pointer-events: none;
  }
  .frame::before {
    content: "";
    position: absolute;
    inset: 6px;
    border: 1px dotted rgba(2,33,121,0.35);
  }

  /* ── Зүүн дээд: GOLD ribbon badge + navy ★ ── */
  .ribbon {
    position: absolute;
    top: 0;
    left: 70px;
    width: 70px;
    z-index: 5;
  }
  .ribbon .flag {
    position: relative;
    width: 70px;
    height: 110px;
    background: var(--gold);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%);
    box-shadow: 0 6px 14px rgba(2,33,121,0.18);
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
  .ribbon .badge {
    margin-top: 14px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    /* Дэвсгэр хуучин navy хэвээр — хэрэглэгч логог өөрөө background-тай тааруулсан */
    background: var(--navy);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: inset 0 0 0 2px var(--gold);
  }
  /* Ribbon badge доторх жижиг лого (★ оронд бодит брэнд лого) */
  .ribbon .badge img {
    width: 38px;
    height: 38px;
    object-fit: contain;
    display: block;
  }

  /* ── Гол агуулга ── */
  .inner {
    position: absolute;
    inset: 0;
    /* доод tald QR/certNo мөр зайтай (давхцахгүй) */
    padding: 56px 84px 112px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    z-index: 4;
  }
  .logo-bar {
    margin-top: 16px;
    /* Дэвсгэр хуучин navy хэвээр — хэрэглэгч логог өөрөө background-тай тааруулсан */
    background: var(--navy);
    border-radius: 14px;
    padding: 13px 32px;
    display: inline-flex;
    align-items: center;
    box-shadow: 0 10px 24px rgba(2,33,121,0.14);
  }
  /* Тод цэвэр NoBG color лого (badge доторх жижиг биш) */
  .logo-bar img { height: 40px; width: auto; display: block; border: 0; }

  .hero {
    margin-top: 26px;
    font-size: 58px;
    font-weight: 900;
    letter-spacing: 8px;
    text-transform: uppercase;
    color: var(--navy);
    line-height: 1;
  }
  .hero-sub {
    margin-top: 12px;
    font-size: 15px;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .hero-en {
    margin-top: 4px;
    font-size: 11px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 700;
  }

  .name {
    margin-top: 24px;
    font-family: 'Georgia', 'Times New Roman', 'Noto Serif', serif;
    font-size: 46px;
    font-weight: 700;
    font-style: italic;
    color: var(--navy);
    padding: 0 16px 12px;
    display: inline-block;
    position: relative;
  }
  .name::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: 78%;
    min-width: 320px;
    height: 3px;
    background: var(--gold);
    border-radius: 3px;
  }

  .for {
    margin-top: 18px;
    font-size: 13px;
    color: var(--muted);
  }
  /* Курс нэр — нэг/2 мөрөнд цэвэр багтана (overflow засах).
     font-size нь нэрний уртаас хамаарч инлайнаар (давхцал арилгана). */
  .course {
    margin-top: 8px;
    font-weight: 800;
    color: var(--navy);
    line-height: 1.25;
    max-width: 780px;
    /* 2 мөрөөс хэтэрвэл таслана (...) — давхцал болохгүй */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .course .quote { color: var(--gold); font-weight: 800; }

  /* ── Footer: зүүн гарын үсэг | төв SEAL | баруун огноо ── */
  .footer {
    margin-top: auto;
    width: 100%;
    max-width: 820px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 28px;
  }
  .col { text-align: center; flex: 1; min-width: 0; }
  /* Гарын үсгийн зураг / нэр — зураасны ДЭЭР */
  .col .sig-img {
    height: 64px;
    width: auto;
    max-width: 230px;
    display: block;
    margin: 0 auto 2px;
    object-fit: contain;
  }
  .col .sig-placeholder { height: 64px; }
  .col .val {
    font-size: 16px;
    font-weight: 700;
    color: var(--navy);
    padding-bottom: 8px;
    white-space: nowrap;
  }
  .col .rule {
    height: 2px;
    background: var(--gold);
    width: 100%;
  }
  .col .label {
    margin-top: 7px;
    font-size: 12px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }

  /* ── Төв: PREMIUM 'VERIFIED' gold seal (embossed, enterprise) ── */
  .seal {
    flex: 0 0 auto;
    width: 104px;
    height: 104px;
    border-radius: 50%;
    position: relative;
    /* Олон давхар gold gradient — metallic/embossed мэдрэмж */
    background:
      radial-gradient(circle at 50% 30%, #fff1bf 0%, #ffd34d 28%, var(--gold) 58%, #d99a00 100%);
    box-shadow:
      0 8px 20px rgba(2,33,121,0.30),
      0 2px 4px rgba(0,0,0,0.18),
      inset 0 2px 5px rgba(255,255,255,0.75),
      inset 0 -3px 6px rgba(160,110,0,0.45);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--navy);
    margin-bottom: 6px;
  }
  /* Гадна navy цагираг + дотор нимгэн цагаан зураас (medallion) */
  .seal::before {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 3px solid var(--navy);
    box-shadow: inset 0 0 0 2px rgba(255,255,255,0.55);
  }
  .seal::after {
    content: "";
    position: absolute;
    inset: 8px;
    border-radius: 50%;
    border: 1.5px dashed rgba(2,33,121,0.45);
  }
  .seal .seal-star {
    font-size: 20px;
    line-height: 1;
    text-shadow: 0 1px 0 rgba(255,255,255,0.6);
  }
  .seal .seal-txt {
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 1.5px;
    margin-top: 1px;
    text-shadow: 0 1px 0 rgba(255,255,255,0.55);
  }
  .seal .seal-sub {
    font-size: 6.5px;
    font-weight: 800;
    letter-spacing: 1.6px;
    margin-top: 2px;
    color: rgba(2,33,121,0.78);
    text-transform: uppercase;
  }

  /* ── Footer баруун: DigitalGer LLC албан ёсны дугуй тамга (SVG) ── */
  .col .llc-seal {
    width: 92px;
    height: 92px;
    display: block;
    margin: 0 auto 4px;
    object-fit: contain;
    /* нимгэн сүүдэр — баримтан дээр товойлгох */
    filter: drop-shadow(0 3px 6px rgba(2,33,121,0.22));
  }

  /* ── Доод: certNo (тод monospace) + QR + verify ── */
  .meta {
    position: absolute;
    left: 44px;
    right: 44px;
    bottom: 26px;
    z-index: 4;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
  }
  .meta .meta-left { text-align: left; }
  .meta .certno {
    font-family: 'Courier New', 'Consolas', monospace;
    font-weight: 800;
    letter-spacing: 1px;
    color: var(--navy);
    font-size: 12px;
  }
  .meta .certno-lbl {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    font-weight: 600;
  }
  .meta .verify {
    margin-top: 3px;
    font-size: 9px;
    color: var(--muted);
    max-width: 520px;
    word-break: break-all;
  }
  /* QR — доод баруун булан */
  .qr { text-align: center; }
  .qr img {
    width: 78px;
    height: 78px;
    display: block;
    border: 2px solid var(--gold);
    border-radius: 6px;
    background: #fff;
  }
  .qr-cap {
    margin-top: 3px;
    font-size: 7px;
    line-height: 1.2;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }

  /* ── Дэлгэц дээр (admin preview iframe) бүтэн багтаах — таслахгүй ──
     Print A4 landscape хэвээр; зөвхөн screen-д хуудсыг responsive болгоно.
     iframe нарийн/намхан байсан ч сертификат бүтэн (297:210 харьцаа) харагдана. */
  @media screen {
    body {
      padding: 12px;
      min-height: auto;
    }
    .sheet {
      width: 100%;
      max-width: 1040px;
      /* aspect-ratio 1.414 хэвээр — өндөр автоматаар тооцогдоно */
    }
  }

  @media print {
    body { background: #fff; padding: 0; min-height: auto; }
    .sheet { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <!-- Булангийн navy + gold гурвалжингууд -->
    <div class="corner-accent tr"></div>
    <div class="corner tr"></div>
    <div class="corner-accent bl"></div>
    <div class="corner bl"></div>
    <div class="corner-accent br"></div>
    <div class="corner br"></div>

    <!-- Gold inner border -->
    <div class="frame"></div>

    <!-- Зүүн дээд ribbon badge — доторх ★ оронд брэнд лого -->
    <div class="ribbon">
      <div class="flag"><div class="badge"><img src="${logoUrl}" alt="DigitalGer" /></div></div>
    </div>

    <div class="inner">
      <div class="logo-bar">
        <img src="${logoUrl}" alt="DigitalGer" />
      </div>

      <div class="hero">Сертификат</div>
      <div class="hero-sub">Гүйцэтгэлийн гэрчилгээ</div>
      <div class="hero-en">Certificate of Completion</div>

      <div class="name">${esc(opts.userName)}</div>

      <div class="for">дараах курсыг амжилттай төгссөн тул энэхүү гэрчилгээг гардуулав:</div>
      <div class="course" style="font-size:${courseFontPx}px">&laquo;${esc(opts.courseTitle)}&raquo;</div>

      <div class="footer">
        <!-- Зүүн: Г.Амгаланбаяр бодит гарын үсэг + нэр + тушаал -->
        <div class="col">
          ${signatureBlock}
          <div class="val">${esc(opts.signerName)}</div>
          <div class="rule"></div>
          <div class="label">${esc(opts.signerTitle)}</div>
        </div>

        <!-- Төв: PREMIUM gold 'VERIFIED' medallion -->
        <div class="seal">
          <div class="seal-star">&#9733;</div>
          <div class="seal-txt">VERIFIED</div>
          <div class="seal-sub">DigitalGer</div>
        </div>

        <!-- Баруун: DigitalGer LLC албан ёсны дугуй тамга + огноо -->
        <div class="col">
          <img class="llc-seal" src="${esc(llcSealUrl)}" alt="DigitalGer LLC тамга" />
          <div class="val">${esc(opts.dateStr)}</div>
          <div class="rule"></div>
          <div class="label">Олгосон огноо</div>
        </div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-left">
        <div class="certno-lbl">Сертификатын дугаар</div>
        <div class="certno">${esc(certNoDisplay)}</div>
        <div class="verify">Баталгаажуулах: ${esc(opts.verifyUrl)}</div>
      </div>
      ${qrBlock}
    </div>
  </div>
</body>
</html>`;
  }

  // ── Lesson Q&A ──────────────────────────────────────────────────────────────

  /**
   * Тухайн хичээлийн асуултууд + хариултууд (entitlement шалгасны дараа).
   * isPinned эхэнд, дараа нь createdAt desc.
   */
  async listQuestions(productSlug: string, lessonId: string, userId: string) {
    await this.ensureLessonAccess(productSlug, lessonId, userId);

    const questions = await this.prisma.lessonQuestion.findMany({
      where: { lessonId },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: { select: { id: true, name: true, image: true } },
        answers: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, name: true, image: true } } },
        },
      },
    });

    return Promise.all(
      questions.map(async (q) => ({
        id: q.id,
        question: q.question,
        isPinned: q.isPinned,
        createdAt: q.createdAt,
        user: q.user,
        isMine: q.userId === userId,
        attachment: await this.resolveQaAttachment(q),
        answers: await Promise.all(
          q.answers.map(async (a) => ({
            id: a.id,
            answer: a.answer,
            isInstructor: a.isInstructor,
            createdAt: a.createdAt,
            user: a.user,
            isMine: a.userId === userId,
            attachment: await this.resolveQaAttachment(a),
          })),
        ),
      })),
    );
  }

  /** Хичээлд асуулт асуух (entitlement шалгасны дараа). */
  async askQuestion(
    productSlug: string,
    lessonId: string,
    userId: string,
    question: string,
    attachment?: QaAttachmentInput,
  ) {
    await this.ensureLessonAccess(productSlug, lessonId, userId);

    const created = await this.prisma.lessonQuestion.create({
      data: {
        lessonId,
        userId,
        question: question.trim(),
        ...this.buildAttachmentData(attachment),
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return {
      id: created.id,
      question: created.question,
      isPinned: created.isPinned,
      createdAt: created.createdAt,
      user: created.user,
      isMine: true,
      attachment: await this.resolveQaAttachment(created),
      answers: [],
    };
  }

  /**
   * Асуултад хариулт нэмнэ. Хэрэглэгч ч хариулж болно (isInstructor=false).
   * Зөвхөн тухайн курс авах эрхтэй (PAID) хэрэглэгч хариулна.
   */
  async addAnswer(
    questionId: string,
    userId: string,
    answer: string,
    isInstructor = false,
    attachment?: QaAttachmentInput,
  ) {
    const question = await this.prisma.lessonQuestion.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        lesson: {
          select: {
            isFreePreview: true,
            course: { select: { productId: true } },
          },
        },
      },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Admin/багш (isInstructor) бол эрх шалгахгүй. Жирийн хэрэглэгч PAID байх ёстой.
    if (!isInstructor && !question.lesson.isFreePreview) {
      const owned = await this.prisma.order.findFirst({
        where: {
          userId,
          status: OrderStatus.PAID,
          items: { some: { productId: question.lesson.course.productId } },
        },
      });
      if (!owned) {
        throw new ForbiddenException('Access denied');
      }
    }

    const created = await this.prisma.lessonAnswer.create({
      data: {
        questionId,
        userId,
        answer: answer.trim(),
        isInstructor,
        ...this.buildAttachmentData(attachment),
      },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    return {
      id: created.id,
      answer: created.answer,
      isInstructor: created.isInstructor,
      createdAt: created.createdAt,
      user: created.user,
      isMine: created.userId === userId,
      attachment: await this.resolveQaAttachment(created),
    };
  }

  // ── Q&A хавсралтын туслах функцууд ───────────────────────────────────────────

  /**
   * DTO-оос ирсэн хавсралтыг шалгаж Prisma create data болгоно.
   * - attachmentKey байхгүй бол хавсралтгүй (хоосон объект).
   * - MIME зөвшөөрөгдсөн эсэх, хэмжээ 100MB-аас хэтрэхгүйг шалгана.
   */
  private buildAttachmentData(attachment?: QaAttachmentInput) {
    if (!attachment?.attachmentKey) return {};

    const mime = attachment.attachmentMimeType;
    if (mime && !QA_ALLOWED_MIME_TYPES.has(mime)) {
      throw new BadRequestException(`Зөвшөөрөгдөөгүй файлын төрөл: ${mime}`);
    }
    if (attachment.attachmentSize != null && attachment.attachmentSize > QA_ATTACHMENT_MAX_SIZE) {
      throw new BadRequestException('Файлын хэмжээ 100MB-аас хэтэрсэн байна');
    }

    return {
      attachmentKey: attachment.attachmentKey,
      attachmentName: attachment.attachmentName ?? null,
      attachmentMimeType: mime ?? null,
      attachmentSize: attachment.attachmentSize ?? null,
    };
  }

  /**
   * Хадгалсан хавсралтын R2 key-г presigned URL болгож resolve хийнэ.
   * Хавсралтгүй бол null. (хэрэглэгч/admin аль аль нь үзнэ.)
   */
  private async resolveQaAttachment(record: {
    attachmentKey: string | null;
    attachmentName: string | null;
    attachmentMimeType: string | null;
    attachmentSize: number | null;
  }) {
    if (!record.attachmentKey) return null;
    return {
      key: record.attachmentKey,
      name: record.attachmentName,
      mimeType: record.attachmentMimeType,
      size: record.attachmentSize,
      url: await this.storage.getPresignedUrl(record.attachmentKey, 3600, 'get'),
    };
  }

  // ── Quiz (хичээлийн дараах шалгалт) ──────────────────────────────────────────

  /**
   * Тухайн хичээлийн quiz-ийг буцаана (entitlement шалгасны дараа).
   * ⚠️ correctIndex БҮҮ буцаа — submit үед серверт тулгана.
   */
  async getQuizForLesson(productSlug: string, lessonId: string, userId: string) {
    await this.ensureLessonAccess(productSlug, lessonId, userId);

    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!quiz) {
      throw new NotFoundException('Энэ хичээлд шалгалт байхгүй байна');
    }

    // Хэрэглэгчийн өмнөх хамгийн сайн оролдлого (хэрэв байвал).
    const best = await this.prisma.quizAttempt.findFirst({
      where: { quizId: quiz.id, userId },
      orderBy: { score: 'desc' },
      select: { score: true, passed: true, createdAt: true },
    });

    return {
      id: quiz.id,
      lessonId: quiz.lessonId,
      title: quiz.title,
      passScore: quiz.passScore,
      // correctIndex-ийг ОГТ оруулахгүй (аюулгүй).
      questions: quiz.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
      })),
      bestAttempt: best,
    };
  }

  /**
   * Quiz хариулт илгээх — correctIndex-тэй тулгаж score тооцоолно.
   * passScore-аар passed, QuizAttempt үүсгэнэ.
   * @returns { score, passed, correct: boolean[], correctIndexes: number[] }
   */
  async submitQuiz(productSlug: string, lessonId: string, userId: string, answers: number[]) {
    await this.ensureLessonAccess(productSlug, lessonId, userId);

    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!quiz) {
      throw new NotFoundException('Энэ хичээлд шалгалт байхгүй байна');
    }
    if (quiz.questions.length === 0) {
      throw new BadRequestException('Шалгалтад асуулт байхгүй байна');
    }

    // Хариултын тоо асуултын тоотой таарах ёстой.
    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
      throw new BadRequestException('Хариултын тоо асуултын тоотой таарахгүй байна');
    }

    const correct = quiz.questions.map((q, i) => answers[i] === q.correctIndex);
    const correctIndexes = quiz.questions.map((q) => q.correctIndex);
    const correctCount = correct.filter(Boolean).length;
    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = score >= quiz.passScore;

    await this.prisma.quizAttempt.create({
      data: { quizId: quiz.id, userId, score, passed },
    });

    return {
      score,
      passed,
      passScore: quiz.passScore,
      correctCount,
      total: quiz.questions.length,
      // Дүн гарсны дараа зөв хариултыг үзүүлж болно (submit хийсэн тул аюулгүй).
      correct,
      correctIndexes,
    };
  }
}
