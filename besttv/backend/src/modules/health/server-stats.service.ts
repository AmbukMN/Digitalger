import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/**
 * Серверийн бодит хэмжигдэхүүн — админы хяналтын самбарт.
 *
 * ⚠️⚠️ ЯАГААД `/proc`-ООС ШУУД УНШИХ ВЭ:
 *
 * `os.totalmem()` / `os.cpus()` зэрэг Node API нь container дотор ч
 * ХОСТЫН утгыг буцаадаг (энэ compose-д cgroup хязгаар тавиагүй тул
 * ЗӨВ). Гэвч CPU-гийн АЧААЛЛЫГ Node өөрөө хэмждэггүй — `/proc/stat`-ыг
 * ХОЁР УДАА уншиж зөрүүгээр л тооцно.
 *
 * ⚠️ БҮХ уншилт `try/catch`-тай: Windows/macOS дээр `/proc` БАЙХГҮЙ
 * (хөгжүүлэлтийн орчин) тул `null` буцаана — самбар унахгүй, зөвхөн
 * тухайн хэсэг «—» болно.
 */
@Injectable()
export class ServerStatsService {
  private readonly logger = new Logger(ServerStatsService.name);

  /**
   * CPU-гийн хэрэглээ — `/proc/stat`-ын ХОЁР дээж хооронд.
   *
   * ⚠️ Нэг дээжээс тооцох БОЛОМЖГҮЙ: `/proc/stat` нь ачаалснаас хойших
   * ХУРИМТЛАГДСАН tick-ийг л хэлнэ. Хоёр дээжийн ЗӨРҮҮ л «одоогийн»
   * ачааллыг өгнө.
   *
   * ⚠️ 200ms хүлээлт — хэтэрхий богино бол дугуйрлын алдаа их, урт бол
   * админ хүлээнэ.
   */
  private async cpuUsagePercent(): Promise<number | null> {
    const read = async (): Promise<{ idle: number; total: number } | null> => {
      try {
        const txt = await fs.readFile('/proc/stat', 'utf8');
        const line = txt.split('\n', 1)[0];
        const parts = line.trim().split(/\s+/).slice(1).map(Number);
        if (parts.length < 4 || parts.some((n) => Number.isNaN(n))) return null;
        /* user nice system idle iowait irq softirq steal … */
        const idle = parts[3] + (parts[4] ?? 0);
        const total = parts.reduce((a, b) => a + b, 0);
        return { idle, total };
      } catch {
        return null;
      }
    };

    const a = await read();
    if (!a) return null;
    await new Promise((r) => setTimeout(r, 200));
    const b = await read();
    if (!b) return null;

    const dTotal = b.total - a.total;
    const dIdle = b.idle - a.idle;
    if (dTotal <= 0) return null;
    return Math.min(100, Math.max(0, ((dTotal - dIdle) / dTotal) * 100));
  }

  /** Санах ой — `/proc/meminfo` (`free` тушаалын эх сурвалж) */
  private async memory(): Promise<{
    totalMb: number;
    usedMb: number;
    availableMb: number;
    percent: number;
  } | null> {
    try {
      const txt = await fs.readFile('/proc/meminfo', 'utf8');
      const kb = (k: string) => {
        const m = txt.match(new RegExp(`^${k}:\\s+(\\d+) kB`, 'm'));
        return m ? Number(m[1]) : null;
      };
      const total = kb('MemTotal');
      /**
       * ⚠️ `MemAvailable` — `MemFree` БИШ. `MemFree` нь кэшийг
       * "ашигласан" гэж тоолдог тул Linux дээр ҮРГЭЛЖ бага харагдаж,
       * "санах ой дүүрсэн" гэсэн ХУДАЛ дохио өгнө. `MemAvailable` нь
       * чөлөөлж болох кэшийг оруулж тооцдог — бодит үзүүлэлт.
       */
      const available = kb('MemAvailable');
      if (!total || available == null) return null;
      const used = total - available;
      return {
        totalMb: Math.round(total / 1024),
        usedMb: Math.round(used / 1024),
        availableMb: Math.round(available / 1024),
        percent: (used / total) * 100,
      };
    } catch {
      return null;
    }
  }

  /** Дискний зай — `df -k /` (container-ийн overlay = хостын хуваалт) */
  private async disk(): Promise<{
    totalGb: number;
    usedGb: number;
    freeGb: number;
    percent: number;
  } | null> {
    try {
      const { stdout } = await exec('df', ['-k', '/'], { timeout: 3000 });
      const line = stdout.trim().split('\n').pop() ?? '';
      const p = line.trim().split(/\s+/);
      /* Filesystem 1K-blocks Used Available Use% Mounted */
      const total = Number(p[1]);
      const used = Number(p[2]);
      const avail = Number(p[3]);
      if (!total || Number.isNaN(used)) return null;
      const gb = (k: number) => Math.round((k / 1024 / 1024) * 10) / 10;
      return {
        totalGb: gb(total),
        usedGb: gb(used),
        freeGb: gb(avail),
        percent: (used / total) * 100,
      };
    } catch {
      return null;
    }
  }

  /** Ачааллын дундаж — 1 / 5 / 15 минут */
  private async loadAvg(): Promise<{ one: number; five: number; fifteen: number } | null> {
    try {
      const txt = await fs.readFile('/proc/loadavg', 'utf8');
      const [a, b, c] = txt.trim().split(/\s+/);
      return { one: Number(a), five: Number(b), fifteen: Number(c) };
    } catch {
      /* ⚠️ Linux биш үед `os.loadavg()` нь [0,0,0] буцаадаг — утгагүй */
      const [a, b, c] = os.loadavg();
      return a || b || c ? { one: a, five: b, fifteen: c } : null;
    }
  }

  /**
   * Node процессын өөрийн санах ой — сервер БҮХЭЛД биш, ЗӨВХӨН backend.
   * ⚠️ Санах ойн алдагдал (memory leak) илрүүлэхэд гол үзүүлэлт.
   */
  private processInfo() {
    const m = process.memoryUsage();
    return {
      rssMb: Math.round(m.rss / 1048576),
      heapUsedMb: Math.round(m.heapUsed / 1048576),
      heapTotalMb: Math.round(m.heapTotal / 1048576),
      uptimeSec: Math.round(process.uptime()),
      nodeVersion: process.version,
    };
  }

  async collect() {
    /* ⚠️ Зэрэг цуглуулна — дараалан хийвэл CPU-гийн 200ms дээр бусад нь нэмэгдэнэ */
    const [cpu, memory, disk, load] = await Promise.all([
      this.cpuUsagePercent(),
      this.memory(),
      this.disk(),
      this.loadAvg(),
    ]);

    const cores = os.cpus()?.length || 1;

    return {
      cpu: {
        percent: cpu,
        cores,
        /**
         * ⚠️ Ачааллыг ЦӨМД харьцуулж хувь болгоно. `load 25` гэдэг нь
         * 4 цөмтэй сервер дээр 625% — админ түүхий тоог хараад
         * "их үү, бага уу" гэдгийг мэдэхгүй.
         */
        loadPercent: load ? (load.one / cores) * 100 : null,
      },
      memory,
      disk,
      load,
      process: this.processInfo(),
      host: {
        /* ⚠️ Container дотроос уншсан hostname нь container-ийнх */
        platform: process.platform,
        /** Хостын uptime (секунд) */
        uptimeSec: Math.round(os.uptime()),
      },
      at: new Date().toISOString(),
    };
  }
}
