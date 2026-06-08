import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CloudflareStreamService } from '../../storage/cloudflare-stream.service';
import { pickActiveOrder } from '../../common/access-expiry';

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

    // Видео эх сурвалж 3 хувилбар (mutually exclusive): videoStreamId | videoKey | videoUrl
    if (!lesson?.videoKey && !lesson?.videoUrl && !lesson?.videoStreamId) {
      throw new NotFoundException('Lesson video not found');
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

    // 3) R2 presigned (хуучин) — хэвээр.
    const url = await this.storage.getPresignedUrl(lesson.videoKey!, 7200, 'get');
    return { lessonId: lesson.id, type: 'r2' as const, url, expiresIn: 7200, ...extras };
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
    await this.ensureLessonAccess(productSlug, lessonId, userId);

    const watchedSeconds = Math.max(0, Math.floor(dto.watchedSeconds ?? 0));
    const durationSec =
      dto.durationSec !== undefined && dto.durationSec !== null
        ? Math.max(0, Math.floor(dto.durationSec))
        : undefined;

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
      select: { lessonId: true, watchedSeconds: true, durationSec: true, completed: true },
    });

    return progress;
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

    return this.buildCertificateHtml({
      userName: cert.userName,
      courseTitle: cert.courseTitle,
      certNo: cert.certNo,
      dateStr,
      verifyUrl,
    });
  }

  /**
   * Admin preview — demo дата (жишээ нэр/курс/огноо)-аар сертификат HTML буцаана.
   * Бодит сертификат үүсгэхгүй, зөвхөн дизайн харах зорилготой (admin шинэ tab).
   * @param opts.userName demo хэрэглэгчийн нэр (default "Бат-Эрдэнэ")
   * @param opts.courseTitle demo курсын нэр (default жишээ нэр)
   */
  getCertificatePreviewHtml(opts?: { userName?: string; courseTitle?: string }): string {
    const userName = opts?.userName?.trim() || 'Бат-Эрдэнэ';
    const courseTitle = opts?.courseTitle?.trim() || 'Дижитал маркетингийн суурь курс';

    const now = new Date();
    const dateStr = `${now.getFullYear()} оны ${String(now.getMonth() + 1).padStart(2, '0')} сарын ${String(now.getDate()).padStart(2, '0')}`;
    const certNo = 'DG-DEMO';
    const verifyUrl = `${this.siteUrl}/courses/certificate/${encodeURIComponent(certNo)}/view`;

    return this.buildCertificateHtml({ userName, courseTitle, certNo, dateStr, verifyUrl });
  }

  /** Landscape сертификатын HTML дизайн (хэвлэх/баталгаажуулах). */
  private buildCertificateHtml(opts: {
    userName: string;
    courseTitle: string;
    certNo: string;
    dateStr: string;
    verifyUrl: string;
  }): string {
    const esc = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const logoUrl = `${this.siteUrl}/brand/logo-white.png`;

    return `<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Сертификат — ${esc(opts.userName)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Noto Sans', Arial, sans-serif;
    background: #eef1f7;
    color: #022179;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
  }
  .sheet {
    width: 1000px;
    max-width: 100%;
    aspect-ratio: 1.414 / 1;
    background: #ffffff;
    position: relative;
    border: 14px solid #022179;
    box-shadow: 0 24px 60px rgba(2,33,121,0.25);
    overflow: hidden;
  }
  .sheet::after {
    content: "";
    position: absolute;
    inset: 14px;
    border: 2px solid #ffbe00;
    pointer-events: none;
  }
  .inner {
    position: absolute;
    inset: 0;
    padding: 48px 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .logo-bar {
    background: #022179;
    border-radius: 12px;
    padding: 12px 28px;
    display: inline-flex;
  }
  .logo-bar img { height: 38px; width: auto; display: block; border: 0; }
  .title {
    margin-top: 28px;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #022179;
  }
  .subtitle {
    margin-top: 6px;
    font-size: 14px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #ffbe00;
    font-weight: 700;
  }
  .lead { margin-top: 34px; font-size: 15px; color: #555; }
  .name {
    margin-top: 12px;
    font-size: 42px;
    font-weight: 800;
    color: #022179;
    border-bottom: 3px solid #ffbe00;
    padding-bottom: 8px;
    display: inline-block;
  }
  .for { margin-top: 26px; font-size: 15px; color: #555; }
  .course {
    margin-top: 8px;
    font-size: 24px;
    font-weight: 700;
    color: #0a3aa0;
    max-width: 760px;
  }
  .footer {
    margin-top: auto;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .sign { text-align: center; min-width: 220px; }
  .sign-line { border-top: 2px solid #022179; padding-top: 8px; font-size: 13px; color: #555; font-weight: 600; }
  .sign-name { font-size: 16px; font-weight: 800; color: #022179; margin-bottom: 38px; }
  .meta { text-align: center; font-size: 12px; color: #888; }
  .meta .certno { font-family: monospace; font-size: 15px; font-weight: 800; color: #022179; letter-spacing: 1px; }
  .date { text-align: center; min-width: 220px; }
  .date-val { font-size: 16px; font-weight: 700; color: #022179; margin-bottom: 4px; }
  .date-label { font-size: 13px; color: #555; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="inner">
      <div class="logo-bar">
        <img src="${logoUrl}" alt="DigitalGer" />
      </div>
      <div class="title">Гэрчилгээ</div>
      <div class="subtitle">Certificate of Completion</div>

      <div class="lead">Энэхүү гэрчилгээг дараах хэрэглэгчид олгов:</div>
      <div class="name">${esc(opts.userName)}</div>

      <div class="for">дараах курсыг амжилттай дүүргэсэн тул:</div>
      <div class="course">«${esc(opts.courseTitle)}»</div>

      <div class="footer">
        <div class="date">
          <div class="date-val">${esc(opts.dateStr)}</div>
          <div class="date-label">Олгосон огноо</div>
        </div>
        <div class="meta">
          <div class="certno">${esc(opts.certNo)}</div>
          <div>Гэрчилгээний дугаар</div>
        </div>
        <div class="sign">
          <div class="sign-name">DigitalGer</div>
          <div class="sign-line">Гарын үсэг / Тамга</div>
        </div>
      </div>
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

    return questions.map((q) => ({
      id: q.id,
      question: q.question,
      isPinned: q.isPinned,
      createdAt: q.createdAt,
      user: q.user,
      isMine: q.userId === userId,
      answers: q.answers.map((a) => ({
        id: a.id,
        answer: a.answer,
        isInstructor: a.isInstructor,
        createdAt: a.createdAt,
        user: a.user,
        isMine: a.userId === userId,
      })),
    }));
  }

  /** Хичээлд асуулт асуух (entitlement шалгасны дараа). */
  async askQuestion(productSlug: string, lessonId: string, userId: string, question: string) {
    await this.ensureLessonAccess(productSlug, lessonId, userId);

    const created = await this.prisma.lessonQuestion.create({
      data: { lessonId, userId, question: question.trim() },
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
      answers: [],
    };
  }

  /**
   * Асуултад хариулт нэмнэ. Хэрэглэгч ч хариулж болно (isInstructor=false).
   * Зөвхөн тухайн курс авах эрхтэй (PAID) хэрэглэгч хариулна.
   */
  async addAnswer(questionId: string, userId: string, answer: string, isInstructor = false) {
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
      data: { questionId, userId, answer: answer.trim(), isInstructor },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    return {
      id: created.id,
      answer: created.answer,
      isInstructor: created.isInstructor,
      createdAt: created.createdAt,
      user: created.user,
      isMine: created.userId === userId,
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
