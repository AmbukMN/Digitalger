/**
 * Демо контент — 35+ кино/цуврал (бодит нэр/тайлбар, placeholder зурагтай).
 * Зургийг picsum.photos-оос (seed-тэй, кино бүрт тогтмол) татаж локал storage
 * драйверт (эсвэл R2, тохируулсан бол) хадгална. Видео ОРООГҮЙ — зөвхөн
 * каталог/UI-г бодитоор харуулах зорилготой (streamStatus: NONE).
 *
 * Ажиллуулах: npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed-demo.ts
 */
import { PrismaClient, TitleType } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// R2 тохируулаагүй үед StorageService шиг локал storage/ руу шууд бичнэ
// (seed script Nest DI ашиглахгүй тул StorageService-ийг дахин үүсгэхгүйгээр
// файлын систем рүү шууд unicast — StorageService-тэй ЯГ ижил key бүтэц).
const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');

async function saveImage(url: string, folder: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Зураг татахад алдаа: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const key = `${folder}/${randomUUID()}.jpg`;
  const dest = path.join(STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  return key;
}

// Жанрууд (seed.ts-д аль хэдийн үүссэн байх ёстой)
const GENRE_SLUGS = {
  action: 'adal-yavdalt',
  drama: 'dram',
  comedy: 'ineedmiin',
  romance: 'romantik',
  horror: 'aimshgiin',
  fantasy: 'uran-zognolt',
  thriller: 'triller',
  animation: 'khuukheldein',
  documentary: 'barimtat',
};

interface DemoMovie {
  title: string;
  description: string;
  year: number;
  rating: number;
  genres: (keyof typeof GENRE_SLUGS)[];
  isPremium: boolean;
  isBanner?: boolean;
  comingSoon?: boolean;
  seed: string; // picsum seed — тогтмол зураг
}

const MOVIES: DemoMovie[] = [
  { title: 'Оппенхаймер', description: 'Атомын бөмбөгийг бүтээсэн физикч Роберт Оппенхаймерийн амьдрал, шинжлэх ухааны хамгийн аюултай нээлтийн түүх.', year: 2023, rating: 8.9, genres: ['drama', 'thriller'], isPremium: true, isBanner: true, seed: 'oppenheimer' },
  { title: 'Дюн: Хоёрдугаар хэсэг', description: 'Пол Атрейдес Фременчүүдтэй нэгдэж, гэр бүлээ устгасан хүмүүст өшөө авахаар аян дайллаа.', year: 2024, rating: 8.7, genres: ['action', 'fantasy'], isPremium: true, isBanner: true, seed: 'dune2' },
  { title: 'Оппенхаймерийн харанхуй тал', description: 'Дэлхийн 2-р дайны дараах улс төрийн тааг тарианд орсон эрдэмтний эмгэнэлт хувь заяа.', year: 2023, rating: 7.8, genres: ['drama'], isPremium: true, seed: 'dark-side' },
  { title: 'Барби', description: 'Төгс ертөнцөд амьдардаг Барби бодит ертөнц рүү аялж, өөрийгөө олж мэдэх аяндаа гардаг.', year: 2023, rating: 7.3, genres: ['comedy', 'fantasy'], isPremium: false, isBanner: true, seed: 'barbie' },
  { title: 'Аймшигт зочид буудал', description: 'Алслагдсан зочид буудалд орой бологдсон бүлэг найзууд харанхуй нууцтай тулгардаг.', year: 2023, rating: 6.9, genres: ['horror', 'thriller'], isPremium: true, seed: 'hotel-horror' },
  { title: 'Сүүлчийн дайчин', description: 'Хуучин цэрэг эх орноо аврахын тулд сүүлчийн тулаандаа бэлдэнэ.', year: 2022, rating: 7.5, genres: ['action'], isPremium: true, seed: 'last-warrior' },
  { title: 'Романтик Парис', description: 'Парисын гудамжинд танилцсан хоёр хүний хайрын түүх.', year: 2023, rating: 7.1, genres: ['romance', 'comedy'], isPremium: false, seed: 'paris-romance' },
  { title: 'Од хоорондын аялал', description: 'Хүн төрөлхтний хамгийн сүүлийн найдвар болсон сансрын экспедиц.', year: 2022, rating: 8.2, genres: ['fantasy', 'drama'], isPremium: true, seed: 'interstellar-journey' },
  { title: 'Нууц агентын дэрвиш', description: 'Нэг агент дэлхийг аюулаас аврахын тулд өөрийн нууц дайсантай тулгарна.', year: 2023, rating: 6.8, genres: ['action', 'thriller'], isPremium: true, seed: 'secret-agent' },
  { title: 'Инээдмийн гэр бүл', description: 'Хачирхалтай гэр бүлийн амралтын аялал гэнэтийн инцидентүүдээр дүүрэн болно.', year: 2023, rating: 6.5, genres: ['comedy'], isPremium: false, seed: 'funny-family' },
  { title: 'Харанхуй ой', description: 'Ойд төөрсөн бүлэг залуус тайлагдашгүй аймшигт үзэгдэлтэй тулгарна.', year: 2022, rating: 6.2, genres: ['horror'], isPremium: true, seed: 'dark-forest' },
  { title: 'Хайрын шоронд', description: 'Хоёр өрсөлдөгч компанийн удирдагчид гэнэт хайртай болцгооно.', year: 2024, rating: 7.4, genres: ['romance', 'comedy'], isPremium: false, comingSoon: true, seed: 'love-prison' },
  { title: 'Гэрлэн туг', description: 'Хилийн заставын цэргүүд эх орны хилийг сүүлчийн амьсгал хүртэл хамгаална.', year: 2021, rating: 7.9, genres: ['action', 'drama'], isPremium: true, seed: 'border-flag' },
  { title: 'Хиймэл оюун', description: 'AI-ийн хөгжил хүн төрөлхтний ирээдүйг хэрхэн өөрчлөхийг харуулсан шинжлэх ухааны уран зөгнөлт.', year: 2024, rating: 8.0, genres: ['fantasy', 'thriller'], isPremium: true, comingSoon: true, seed: 'ai-future' },
  { title: 'Цасан уулын эзэн', description: 'Хамгийн өндөр оргилыг байлдан дагуулах уулчны эрсдэлтэй аялал.', year: 2022, rating: 7.6, genres: ['drama', 'action'], isPremium: true, seed: 'mountain-lord' },
  { title: 'Шөнийн үзэгдэл', description: 'Шинэ гэрт нүүсэн гэр бүл шөнө бүр хачирхалтай дуу чимээ сонсдог болно.', year: 2023, rating: 6.4, genres: ['horror', 'thriller'], isPremium: true, seed: 'night-vision' },
  { title: 'Инээдтэй ажил хайх', description: 'Ажилгүй залуу янз бүрийн хачин ажлууд оролдож инээдтэй нөхцөл байдалд ордог.', year: 2023, rating: 6.7, genres: ['comedy'], isPremium: false, seed: 'funny-job' },
  { title: 'Домогт баатар', description: 'Эртний домогт заасан баатар илрэн гарч хаант улсаа аварна.', year: 2021, rating: 7.3, genres: ['fantasy', 'action'], isPremium: true, seed: 'legend-hero' },
  { title: 'Цөлийн уулзвар', description: 'Цөлд төөрсөн худалдаачдын бүлэг амьд үлдэхийн төлөө тэмцэнэ.', year: 2022, rating: 6.9, genres: ['drama', 'action'], isPremium: true, seed: 'desert-crossroads' },
  { title: 'Хайрын жор', description: 'Тогооч эмэгтэй хайртай хүнээ олохын тулд амтат хоолоо ашигладаг.', year: 2023, rating: 7.0, genres: ['romance', 'comedy'], isPremium: false, seed: 'love-recipe' },
];

interface DemoSeries {
  title: string;
  description: string;
  year: number;
  rating: number;
  genres: (keyof typeof GENRE_SLUGS)[];
  isPremium: boolean;
  isBanner?: boolean;
  comingSoon?: boolean;
  seed: string;
  seasons: number;
  episodesPerSeason: number;
}

const SERIES: DemoSeries[] = [
  { title: 'Хаадын тоглоом: Уугуул', description: 'Долоон хаант улсын хаан ширээний төлөөх бартаат тэмцлийн эхлэл.', year: 2022, rating: 8.5, genres: ['drama', 'fantasy'], isPremium: true, isBanner: true, seed: 'game-throne', seasons: 2, episodesPerSeason: 8 },
  { title: 'Мансууруулагч эзэн', description: 'Химийн багш маш аюултай мансууруулах бодис үйлдвэрлэгч болох хувиргалт.', year: 2021, rating: 9.1, genres: ['drama', 'thriller'], isPremium: true, seed: 'drug-lord', seasons: 3, episodesPerSeason: 10 },
  { title: 'Цагаан цамцтай зомби', description: 'Апокалипсийн дараах ертөнцөд амьд үлдэгсдийн тэмцэл.', year: 2023, rating: 7.8, genres: ['horror', 'action'], isPremium: true, seed: 'zombie-white', seasons: 2, episodesPerSeason: 6 },
  { title: 'Оффисын инээдэм', description: 'Жирийн компанийн ажилчдын өдөр тутмын инээдтэй үйл явдлууд.', year: 2022, rating: 7.2, genres: ['comedy'], isPremium: false, seed: 'office-comedy', seasons: 4, episodesPerSeason: 12 },
  { title: 'Сансрын эзэнт улс', description: 'Галактикийн хамгийн том эзэнт улсын уналт ба сэргэлтийн түүх.', year: 2023, rating: 8.3, genres: ['fantasy', 'action'], isPremium: true, isBanner: true, seed: 'space-empire', seasons: 1, episodesPerSeason: 10 },
  { title: 'Хайр ба хуйвалдаан', description: 'Хоёр гэр бүлийн хоорондох нууц хайр, хуйвалдааны түүх.', year: 2023, rating: 7.5, genres: ['romance', 'drama'], isPremium: false, seed: 'love-conspiracy', seasons: 2, episodesPerSeason: 16 },
  { title: 'Хар захын эмч', description: 'Хууль бус эмнэлгийн үйлчилгээ үзүүлдэг нууц эмчийн түүх.', year: 2022, rating: 8.0, genres: ['drama', 'thriller'], isPremium: true, seed: 'black-market-doctor', seasons: 2, episodesPerSeason: 8 },
  { title: 'Аймшигт байшин 13', description: '13 дугаар байшинд амьдардаг гэр бүлүүд ер бусын үзэгдэлтэй тулгардаг.', year: 2023, rating: 6.6, genres: ['horror'], isPremium: true, comingSoon: true, seed: 'house-13', seasons: 1, episodesPerSeason: 8 },
  { title: 'Оюутны амьдрал', description: 'Их сургуулийн оюутнуудын дурсамжтай, инээдтэй амьдрал.', year: 2024, rating: 7.4, genres: ['comedy', 'romance'], isPremium: false, seed: 'student-life', seasons: 1, episodesPerSeason: 10 },
  { title: 'Тагнуулын тоглоом', description: 'Хоёр орны тагнуулын байгууллагын хоорондох нууц тэмцэл.', year: 2023, rating: 8.1, genres: ['action', 'thriller'], isPremium: true, seed: 'spy-game', seasons: 2, episodesPerSeason: 10 },
  { title: 'Домогт амьтад', description: 'Ер бусын амьтадтай найзалсан хүүхдийн дурлам аялал.', year: 2022, rating: 7.7, genres: ['fantasy', 'animation'], isPremium: false, seed: 'mythic-creatures', seasons: 1, episodesPerSeason: 13 },
  { title: 'Хотын нууц', description: 'Мегаполис хотод болж буй хэд хэдэн гэмт хэргийн шалгаан.', year: 2023, rating: 7.9, genres: ['thriller', 'drama'], isPremium: true, seed: 'city-secrets', seasons: 3, episodesPerSeason: 8 },
  { title: 'Байгалийн ертөнц', description: 'Дэлхийн хамгийн гайхамшигт байгалийн үзэгдлүүдийн баримтат цуврал.', year: 2021, rating: 8.8, genres: ['documentary'], isPremium: false, seed: 'nature-world', seasons: 1, episodesPerSeason: 6 },
  { title: 'Гал асаагч эмэгтэй', description: 'Гал сөнөөгч эмэгтэй амьдралыг эрсдэлд оруулан хотоо хамгаалдаг.', year: 2024, rating: 7.6, genres: ['action', 'drama'], isPremium: true, comingSoon: true, seed: 'firefighter-woman', seasons: 1, episodesPerSeason: 8 },
  { title: 'Шидтэний сургууль', description: 'Залуу шидтэн шидтэний сургуульд элсэн орж гайхамшигт аялалд гардаг.', year: 2022, rating: 7.3, genres: ['fantasy', 'animation'], isPremium: false, seed: 'wizard-school', seasons: 2, episodesPerSeason: 12 },
];

async function main() {
  const genres = await prisma.genre.findMany();
  const genreMap = new Map(genres.map((g) => [g.slug, g.id]));

  let bannerOrder = 0;
  let comingSoonOrder = 0;

  console.log(`Кино зургийг татаж эхэллээ (${MOVIES.length})...`);
  for (const m of MOVIES) {
    const slug = slugify(m.title);
    const exists = await prisma.title.findUnique({ where: { slug } });
    if (exists) {
      console.log(`  ⏭  ${m.title} — аль хэдийн байна`);
      continue;
    }

    const [posterKey, backdropKey] = await Promise.all([
      saveImage(`https://picsum.photos/seed/${m.seed}/500/750`, 'images/poster'),
      saveImage(`https://picsum.photos/seed/${m.seed}-bg/1600/900`, 'images/backdrop'),
    ]);

    await prisma.title.create({
      data: {
        type: TitleType.MOVIE,
        title: m.title,
        slug,
        description: m.description,
        posterKey,
        backdropKey,
        isPremium: m.isPremium,
        rating: m.rating,
        year: m.year,
        views: Math.floor(Math.random() * 50000),
        isBanner: !!m.isBanner,
        bannerOrder: m.isBanner ? bannerOrder++ : 0,
        comingSoon: !!m.comingSoon,
        comingSoonOrder: m.comingSoon ? comingSoonOrder++ : 0,
        genres: {
          create: m.genres
            .map((g) => genreMap.get(GENRE_SLUGS[g]))
            .filter((id): id is string => !!id)
            .map((genreId, i) => ({ genreId, order: i })),
        },
      },
    });
    console.log(`  ✅ ${m.title}`);
  }

  console.log(`\nЦувралын зургийг татаж эхэллээ (${SERIES.length})...`);
  for (const s of SERIES) {
    const slug = slugify(s.title);
    const exists = await prisma.title.findUnique({ where: { slug } });
    if (exists) {
      console.log(`  ⏭  ${s.title} — аль хэдийн байна`);
      continue;
    }

    const [posterKey, backdropKey] = await Promise.all([
      saveImage(`https://picsum.photos/seed/${s.seed}/500/750`, 'images/poster'),
      saveImage(`https://picsum.photos/seed/${s.seed}-bg/1600/900`, 'images/backdrop'),
    ]);

    const title = await prisma.title.create({
      data: {
        type: TitleType.SERIES,
        title: s.title,
        slug,
        description: s.description,
        posterKey,
        backdropKey,
        isPremium: s.isPremium,
        rating: s.rating,
        year: s.year,
        views: Math.floor(Math.random() * 80000),
        isBanner: !!s.isBanner,
        bannerOrder: s.isBanner ? bannerOrder++ : 0,
        comingSoon: !!s.comingSoon,
        comingSoonOrder: s.comingSoon ? comingSoonOrder++ : 0,
        genres: {
          create: s.genres
            .map((g) => genreMap.get(GENRE_SLUGS[g]))
            .filter((id): id is string => !!id)
            .map((genreId, i) => ({ genreId, order: i })),
        },
      },
    });

    for (let sn = 1; sn <= s.seasons; sn++) {
      const season = await prisma.season.create({
        data: { titleId: title.id, number: sn },
      });
      const episodeData = Array.from({ length: s.episodesPerSeason }, (_, i) => ({
        seasonId: season.id,
        number: i + 1,
        name: `${sn}-р улирал ${i + 1}-р анги`,
        isFreePreview: sn === 1 && i === 0, // эхний анги үнэгүй урьдчилан үзэх
      }));
      await prisma.episode.createMany({ data: episodeData });
    }
    console.log(`  ✅ ${s.title} (${s.seasons} улирал × ${s.episodesPerSeason} анги)`);
  }

  const totalTitles = await prisma.title.count();
  console.log(`\n🎬 Нийт ${totalTitles} контент DB-д байна.`);
}

function slugify(input: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
    и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', ө: 'u', п: 'p',
    р: 'r', с: 's', т: 't', у: 'u', ү: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch',
    ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return input
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
