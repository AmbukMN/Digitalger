import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { N8nService } from '../n8n/n8n.service';

/**
 * R2 (Cloudflare) orphan файл цэвэрлэгч — 2 ШАТЛАЛТ "soft delete → hard delete".
 *
 * Orphan = R2 bucket дээр байгаа ч ямар ч DB бичлэгт ХОЛБОГДООГҮЙ файл (admin form-д
 * upload хийгээд save хийлгүй гарсан хог г.м).
 *
 * ⚠️ САНАМСАРГҮЙ УСТГАХААС СЭРГИЙЛЭХ 2 ШАТ:
 *   ШАТ 1 (өдөр тутам) — orphan ИЛРҮҮЛЭХ: R2-д байгаа ч DB-д холбоогүй файлыг ШУУД
 *     устгахгүй, OrphanCandidate хүснэгтэд бүртгэнэ (firstSeenAt). Хэрэв дараа нь DB-д
 *     дахин ХОЛБОГДВОЛ (admin буцааж хадгалсан) бүртгэлээс ХАСНА → хамгаалагдана.
 *   ШАТ 2 (өдөр тутам) — hard delete: OrphanCandidate-д GRACE_DAYS (3 хоног)-оос дээш
 *     orphan хэвээр байсан файлыг л R2-аас БОДИТООР устгана.
 *
 * Нэмэлт хамгаалалт:
 *   - DB key цуглуулахад АЛДАА → бүхэлд нь зогсооно (буруугаар бүртгэхгүй).
 *   - DB-д огт key байхгүй (count=0) → зогсооно (catastrophic-аас сэргийлэх).
 *   - http(s):// гадаад URL нь R2 key БИШ — алгасна.
 *
 * ⚠️ ScheduleModule.forRoot() нь app.module-д НЭГ удаа. Энд @Cron л ашиглана.
 * ⚠️ Redis distributed lock — олон process-т зөвхөн нэг удаа.
 */
@Injectable()
export class R2CleanupService implements OnModuleDestroy {
  private readonly logger = new Logger(R2CleanupService.name);
  private readonly redis: Redis;
  // Orphan гэж бүртгэгдсэнээс хойш энэ хугацаа хүлээгээд л устгана (grace period).
  private readonly GRACE_DAYS = 3;
  // Шинэхэн upload-ийг candidate болгохгүй (идэвхтэй form draft) — энэ цонхны дотор алгасна.
  private readonly RECENT_HOURS = 2;
  // ⚠️ ХАМГААЛАГДСАН prefix — cleanup-д ХЭЗЭЭ Ч хамруулахгүй. Эдгээр нь DB key-ээр
  // tracking хийгддэггүй тул "orphan" мэт харагдана, гэхдээ устгаж БОЛОХГҮЙ:
  //   backups/ = DB backup (.sql.gz) — устгавал нөөц алдагдана!
  //   avatars/ = хэрэглэгчийн avatar (User.image нь зарим тохиолдолд URL хэлбэрээр
  //              хадгалагддаг тул key таарахгүй — буруу устгахаас сэргийлж бүхэлд хамгаална).
  private readonly PROTECTED_PREFIXES = ['backups/', 'avatars/'];

  private isProtected(key: string): boolean {
    return this.PROTECTED_PREFIXES.some((p) => key.startsWith(p));
  }

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly n8n: N8nService,
  ) {
    const redisUrl = this.config.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  /**
   * DB-д ХОЛБООТОЙ бүх R2 key-г Set болгож цуглуулна. Энэ Set-д БАЙХГҮЙ R2 key
   * нь orphan. ⚠️ Эх сурвалж бүрийг бүрэн оруулна — дутуу бол бодит файл orphan гэж
   * андуурна. http(s):// (гадаад URL) нь R2 key БИШ.
   */
  private async collectLinkedKeys(): Promise<Set<string>> {
    const keys = new Set<string>();
    const add = (v: string | null | undefined) => {
      if (!v) return;
      if (v.startsWith('http://') || v.startsWith('https://')) return;
      keys.add(v.replace(/^\//, ''));
    };

    const [
      users,
      products,
      productFiles,
      productImages,
      imageVariants,
      lessons,
      lessonResources,
      lessonQuestions,
      lessonAnswers,
      banners,
      bundles,
      blogPosts,
      zipJobs,
    ] = await Promise.all([
      this.prisma.user.findMany({ select: { image: true } }),
      this.prisma.product.findMany({ select: { downloadFileKey: true, videoUrl: true } }),
      this.prisma.productFile.findMany({ select: { fileKey: true } }),
      this.prisma.productImage.findMany({ select: { fileKey: true, videoUrl: true } }),
      this.prisma.imageVariant.findMany({ select: { fileKey: true } }),
      this.prisma.lesson.findMany({ select: { videoKey: true, posterKey: true } }),
      this.prisma.lessonResource.findMany({ select: { fileKey: true } }),
      this.prisma.lessonQuestion.findMany({ select: { attachmentKey: true } }),
      this.prisma.lessonAnswer.findMany({ select: { attachmentKey: true } }),
      this.prisma.banner.findMany({ select: { imageUrl: true, videoUrl: true } }),
      this.prisma.productBundle.findMany({ select: { downloadFileKey: true } }),
      this.prisma.blogPost.findMany({ select: { coverImageUrl: true } }),
      this.prisma.zipJob.findMany({ select: { zipKey: true } }),
    ]);

    for (const u of users) add(u.image);
    for (const p of products) { add(p.downloadFileKey); add(p.videoUrl); }
    for (const f of productFiles) add(f.fileKey);
    for (const i of productImages) { add(i.fileKey); add(i.videoUrl); }
    for (const v of imageVariants) add(v.fileKey);
    for (const l of lessons) { add(l.videoKey); add(l.posterKey); }
    for (const r of lessonResources) add(r.fileKey);
    for (const q of lessonQuestions) add(q.attachmentKey);
    for (const a of lessonAnswers) add(a.attachmentKey);
    for (const b of banners) { add(b.imageUrl); add(b.videoUrl); }
    for (const b of bundles) add(b.downloadFileKey);
    for (const b of blogPosts) add(b.coverImageUrl);
    for (const z of zipJobs) add(z.zipKey);

    return keys;
  }

  // ─── ШАТ 1: orphan ИЛРҮҮЛЭХ → OrphanCandidate-д бүртгэх (өдөр бүр 04:45) ──────────
  @Cron('45 4 * * *', { timeZone: 'Asia/Ulaanbaatar' })
  async detectOrphans(): Promise<void> {
    if (!this.storage.isConfigured()) {
      this.logger.log('R2 orphan detect: R2 тохируулаагүй — алгасав');
      return;
    }
    const date = new Date().toISOString().split('T')[0];
    const lock = await this.redis
      .set(`cron:r2-orphan-detect:${date}`, '1', 'EX', 3600, 'NX')
      .catch(() => null);
    if (!lock) {
      this.logger.log('R2 orphan detect: өөр process ажиллуулсан — алгасав');
      return;
    }

    this.logger.log('R2 orphan ИЛРҮҮЛЭХ (ШАТ 1) эхэлж байна...');
    try {
      const linked = await this.collectLinkedKeys();
      if (linked.size === 0) {
        this.logger.warn('R2 orphan detect: DB key=0 — ХАМГААЛАЛТААР зогсоов');
        return;
      }

      const objects = await this.storage.listAllKeys();
      if (objects.length === 0) {
        this.logger.log('R2 orphan detect: bucket хоосон — дуусгав');
        return;
      }

      const recentCutoff = Date.now() - this.RECENT_HOURS * 60 * 60 * 1000;
      const now = new Date();
      // R2 дээрх orphan key-үүд (саяхан upload-ийг хасна).
      const orphanKeys = new Set<string>();
      for (const o of objects) {
        if (linked.has(o.key)) continue;
        if (this.isProtected(o.key)) continue; // backups/avatars — хэзээ ч хамруулахгүй
        const lm = o.lastModified ? o.lastModified.getTime() : NaN;
        if (!Number.isFinite(lm) || lm > recentCutoff) continue; // саяхан — хамгаална
        orphanKeys.add(o.key);
      }

      // 1) Шинэ orphan-уудыг бүртгэх (байвал lastSeenAt шинэчилнэ — upsert).
      const sizeByKey = new Map(objects.map((o) => [o.key, o.size]));
      let upserted = 0;
      for (const key of orphanKeys) {
        await this.prisma.orphanCandidate
          .upsert({
            where: { key },
            create: { key, size: sizeByKey.get(key) ?? null, firstSeenAt: now, lastSeenAt: now },
            update: { lastSeenAt: now }, // firstSeenAt ХАДГАЛНА (grace эхлэл хэвээр)
          })
          .then(() => { upserted += 1; })
          .catch(() => {});
      }

      // 2) Бүртгэлд байгаа ч ОДОО orphan биш болсныг (DB-д дахин холбогдсон) ХАСНА.
      const existing = await this.prisma.orphanCandidate.findMany({ select: { key: true } });
      const stale = existing.filter((c) => !orphanKeys.has(c.key)).map((c) => c.key);
      let removed = 0;
      if (stale.length) {
        const res = await this.prisma.orphanCandidate
          .deleteMany({ where: { key: { in: stale } } })
          .catch(() => ({ count: 0 }));
        removed = res.count;
      }

      this.logger.log(
        `R2 orphan ИЛРҮҮЛЭХ дууслаа — bucket ${objects.length}, DB-холбоо ${linked.size}, ` +
          `orphan ${orphanKeys.size} бүртгэв (${upserted}), холбогдсон ${removed} хасав`,
      );
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      this.logger.error(`R2 orphan detect алдаа: ${msg}`);
      await this.n8n
        .emitAlert({
          level: 'warning',
          title: 'R2 orphan detect амжилтгүй',
          message: `R2 orphan илрүүлэх үед алдаа: ${msg.slice(0, 300)}`,
          source: 'r2-cleanup',
        })
        .catch(() => {});
    }
  }

  // ─── ШАТ 2: GRACE (3 хоног)-оос дээш orphan-ыг hard delete (өдөр бүр 05:00) ──────
  @Cron('0 5 * * *', { timeZone: 'Asia/Ulaanbaatar' })
  async deleteAgedOrphans(): Promise<void> {
    if (!this.storage.isConfigured()) return;
    const date = new Date().toISOString().split('T')[0];
    const lock = await this.redis
      .set(`cron:r2-orphan-delete:${date}`, '1', 'EX', 3600, 'NX')
      .catch(() => null);
    if (!lock) return;

    const cutoff = new Date(Date.now() - this.GRACE_DAYS * 24 * 60 * 60 * 1000);
    const aged = await this.prisma.orphanCandidate.findMany({
      where: { firstSeenAt: { lt: cutoff } },
      select: { id: true, key: true, size: true },
    });
    if (aged.length === 0) {
      this.logger.log('R2 orphan УСТГАХ (ШАТ 2): grace дууссан orphan алга');
      return;
    }

    // ⚠️ Устгахын өмнө DB-д ОДОО холбоотой эсэхийг ДАХИН шалгана (race хамгаалалт):
    // detect-ээс хойш admin буцааж хадгалсан байж магадгүй.
    let linked: Set<string>;
    try {
      linked = await this.collectLinkedKeys();
    } catch {
      this.logger.warn('R2 orphan delete: DB key цуглуулж чадсангүй — зогсоов');
      return;
    }
    if (linked.size === 0) {
      this.logger.warn('R2 orphan delete: DB key=0 — ХАМГААЛАЛТААР зогсоов');
      return;
    }

    let deleted = 0;
    let bytes = 0;
    let reLinked = 0;
    for (const c of aged) {
      // ⚠️ Давхар хамгаалалт: protected prefix-ийг хэзээ ч устгахгүй (candidate-аас хасна).
      if (this.isProtected(c.key) || linked.has(c.key)) {
        await this.prisma.orphanCandidate.delete({ where: { id: c.id } }).catch(() => {});
        reLinked += 1;
        continue;
      }
      await this.storage.delete(c.key).catch(() => {});
      await this.prisma.orphanCandidate.delete({ where: { id: c.id } }).catch(() => {});
      deleted += 1;
      bytes += c.size ?? 0;
      this.logger.log(`Orphan R2 файл УСТГАВ (${this.GRACE_DAYS}х+): ${c.key}`);
    }

    const mb = (bytes / 1024 / 1024).toFixed(1);
    this.logger.log(
      `R2 orphan УСТГАХ дууслаа — ${deleted} устгав (≈${mb}MB), ${reLinked} дахин холбогдсон хасав`,
    );
  }
}
