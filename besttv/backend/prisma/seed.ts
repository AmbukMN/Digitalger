import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { STATIC_PAGES } from './seed-pages';

const prisma = new PrismaClient();

async function main() {
  // ── Админ хэрэглэгч ──────────────────────────────────────────────────────
  const adminEmail = 'admin@besttv.mn';
  const passwordHash = await bcrypt.hash('Admin@12345', 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'BestTV Admin',
      passwordHash,
      role: Role.ADMIN,
    },
  });
  console.log(`✅ Админ: ${adminEmail} / Admin@12345`);

  // ── Жанрууд ──────────────────────────────────────────────────────────────
  // Ердийн төрөл жанрууд + багцад холбогдох "ангилал" жанрууд (улс/18+).
  const genres = [
    { name: 'Адал явдалт', slug: 'adal-yavdalt', order: 0 },
    { name: 'Драм', slug: 'dram', order: 1 },
    { name: 'Инээдмийн', slug: 'ineedmiin', order: 2 },
    { name: 'Романтик', slug: 'romantik', order: 3 },
    { name: 'Аймшгийн', slug: 'aimshgiin', order: 4 },
    { name: 'Уран зөгнөлт', slug: 'uran-zognolt', order: 5 },
    { name: 'Триллер', slug: 'triller', order: 6 },
    { name: 'Хүүхэлдэйн', slug: 'khuukheldein', order: 7 },
    { name: 'Баримтат', slug: 'barimtat', order: 8 },
    // ── Багцын ангилал жанрууд ────────────────────────────────────────────
    { name: 'Монгол кино', slug: 'mongol-kino', order: 10 },
    { name: 'Хятад кино', slug: 'hyatad-kino', order: 11 },
    { name: 'Орос кино', slug: 'oros-kino', order: 12 },
    { name: 'Солонгос кино', slug: 'solongos-kino', order: 13 },
    { name: 'Насанд хүрэгчдийн', slug: 'nasand-huregchdiin', order: 20, isAdult: true },
  ];
  await prisma.genre.createMany({ data: genres, skipDuplicates: true });
  console.log(`✅ ${genres.length} жанр үүслээ`);

  // ── Багцууд ──────────────────────────────────────────────────────────────
  // Багц бүр тодорхой жанруудын контентыг нээнэ (PlanGenre). VIP = бүгд.
  const baseFeatures = ['Завсаргүй үзвэр', 'FHD чанар', 'Олон төхөөрөмж'];
  const planDefs: {
    name: string;
    slugKey: string;
    price: number;
    order: number;
    isVip?: boolean;
    genreSlugs: string[];
    description: string;
  }[] = [
    {
      name: 'Монгол кино багц',
      slugKey: 'mongol',
      price: 15000,
      order: 0,
      genreSlugs: ['mongol-kino'],
      description: 'Монгол кино, цувралын бүрэн хандалт',
    },
    {
      name: 'Солонгос кино багц',
      slugKey: 'solongos',
      price: 15000,
      order: 1,
      genreSlugs: ['solongos-kino'],
      description: 'Солонгос кино, цувралын бүрэн хандалт',
    },
    {
      name: 'Хятад кино багц',
      slugKey: 'hyatad',
      price: 15000,
      order: 2,
      genreSlugs: ['hyatad-kino'],
      description: 'Хятад кино, цувралын бүрэн хандалт',
    },
    {
      name: 'Орос кино багц',
      slugKey: 'oros',
      price: 15000,
      order: 3,
      genreSlugs: ['oros-kino'],
      description: 'Орос кино, цувралын бүрэн хандалт',
    },
    {
      name: 'Насанд хүрэгчдийн багц (18+)',
      slugKey: 'adult',
      price: 15000,
      order: 4,
      genreSlugs: ['nasand-huregchdiin'],
      description: '18+ насны контентын хандалт',
    },
    {
      name: 'VIP багц',
      slugKey: 'vip',
      price: 25000,
      order: 5,
      isVip: true,
      genreSlugs: [],
      description: 'Бүх багцын контент нэг дор — хамгийн ашигтай',
    },
  ];

  const allGenres = await prisma.genre.findMany();
  const genreBySlug = new Map(allGenres.map((g) => [g.slug, g]));

  for (const def of planDefs) {
    const features = def.isVip
      ? [...baseFeatures, 'Бүх багц багтсан', '18+ контент нээлттэй']
      : baseFeatures;

    // Нэрээр нь идэвхжсэн эсэхийг шалгаж upsert (id тогтмол биш тул findFirst)
    const existing = await prisma.plan.findFirst({ where: { name: def.name } });
    const plan = existing
      ? await prisma.plan.update({
          where: { id: existing.id },
          data: {
            price: def.price,
            durationDays: 30,
            order: def.order,
            isVip: def.isVip ?? false,
            description: def.description,
            features,
            isActive: true,
          },
        })
      : await prisma.plan.create({
          data: {
            name: def.name,
            price: def.price,
            durationDays: 30,
            order: def.order,
            isVip: def.isVip ?? false,
            description: def.description,
            features,
          },
        });

    // Жанрын холбоосыг дахин тохируулна (идемпотент)
    await prisma.planGenre.deleteMany({ where: { planId: plan.id } });
    const links = def.genreSlugs
      .map((s) => genreBySlug.get(s))
      .filter((g): g is NonNullable<typeof g> => !!g)
      .map((g) => ({ planId: plan.id, genreId: g.id }));
    if (links.length) {
      await prisma.planGenre.createMany({ data: links, skipDuplicates: true });
    }
  }
  console.log(`✅ ${planDefs.length} багц тохируулагдлаа (жанрын хандалттай)`);

  // ── Хуучин "хугацааны" багцуудыг идэвхгүй болгоно ────────────────────────
  // (Устгахгүй — хэрэглэгчдийн идэвхтэй subscription/payment холбоос хэвээр)
  const legacyNames = ['1 сарын эрх', '3 сарын эрх', '6 сарын эрх', '1 жилийн эрх'];
  const deactivated = await prisma.plan.updateMany({
    where: { name: { in: legacyNames } },
    data: { isActive: false },
  });
  if (deactivated.count) {
    console.log(`ℹ️  ${deactivated.count} хуучин багц идэвхгүй болов`);
  }

  // ── Статик хуудсууд (админаас засварлана) ────────────────────────────────
  for (const page of STATIC_PAGES) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      update: {}, // ⚠️ Байгаа хуудсыг ДАРАХГҮЙ — админы засварыг хадгална
      create: page,
    });
  }
  console.log(`✅ ${STATIC_PAGES.length} статик хуудас бэлэн`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
