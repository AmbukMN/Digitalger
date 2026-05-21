import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@12345', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@digitalger.mn' },
    update: { passwordHash, role: Role.ADMIN, name: 'Admin' },
    create: {
      email: 'admin@digitalger.mn',
      name: 'Admin',
      passwordHash,
      role: Role.ADMIN,
      emailVerified: new Date(),
    },
  });

  await prisma.themeSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  await prisma.siteSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  // ProductTypeConfig — dynamic product types
  const productTypes = [
    { value: 'FILE',     label: 'Файл',     description: 'Татаж авах боломжтой файлууд',       icon: 'file',        sortOrder: 1, active: true },
    { value: 'TEMPLATE', label: 'Загвар',   description: 'PowerPoint, Word, Canva загварууд',   icon: 'layout',      sortOrder: 2, active: true },
    { value: 'DOCUMENT', label: 'Баримт',   description: 'Гэрээ, тайлан, акт, баримт бичиг',   icon: 'file-text',   sortOrder: 3, active: true },
    { value: 'BUNDLE',   label: 'Багц',     description: 'Олон файлын нэгдсэн цуглуулга',      icon: 'package',     sortOrder: 4, active: true },
    { value: 'LESSON',   label: 'Хичээл',   description: 'Видео хичээл, онлайн сургалт',       icon: 'book-open',   sortOrder: 5, active: true },
    { value: 'COURSE',   label: 'Курс',     description: 'Бүрэн курс, видео цуврал',           icon: 'graduation-cap', sortOrder: 6, active: true },
    { value: 'OTHER',    label: 'Бусад',    description: 'Бусад дижитал бүтээгдэхүүн',        icon: 'box',         sortOrder: 7, active: true },
  ];

  for (const pt of productTypes) {
    await prisma.productTypeConfig.upsert({
      where: { value: pt.value },
      update: { label: pt.label, description: pt.description, icon: pt.icon, sortOrder: pt.sortOrder, active: pt.active },
      create: pt,
    });
  }

  // Banners
  const banners = [
    {
      id: 'banner-1',
      title: 'Бэлэн бизнес төлөвлөгөөнүүд',
      subtitle: 'Банк, ЖДҮ-д шуудхан хэрэглэнэ — 300 гаруй загвар нэг дороос татах',
      imageUrl: '',
      linkUrl: '/products',
      linkLabel: 'Бүтээгдэхүүн үзэх',
      sortOrder: 1,
      active: true,
      bgColor: '#022179',
    },
    {
      id: 'banner-2',
      title: 'PLATINUM — 300+ загвар нэгдсэн',
      subtitle: 'Мал аж ахуй, хүлэмж, ресторан, барилга гэх мэт 10 ангиллын бүх загвар',
      imageUrl: '',
      linkUrl: '/products/platinum-belen-tusluud-buguud',
      linkLabel: 'PLATINUM авах',
      sortOrder: 2,
      active: true,
      bgColor: '#0a3a8f',
    },
    {
      id: 'banner-3',
      title: 'Мал аж ахуйн 72 бэлэн төсөл',
      subtitle: 'Сүүний үнээ, мах, тахиа, гахай, ноолуур — банкны зээлд шуудхан',
      imageUrl: '',
      linkUrl: '/products/mal-aj-ahui-belen-tusluud',
      linkLabel: 'Үзэх',
      sortOrder: 3,
      active: true,
      bgColor: '#011560',
    },
  ];

  for (const b of banners) {
    await prisma.banner.upsert({
      where: { id: b.id },
      update: { title: b.title, subtitle: b.subtitle, linkUrl: b.linkUrl, linkLabel: b.linkLabel, bgColor: b.bgColor },
      create: b,
    });
  }

  // Menu items
  const menuItems = [
    { id: 'menu-1', label: 'Нүүр',       url: '/',                                           sortOrder: 1, active: true, openInNew: false, target: '_self' },
    { id: 'menu-2', label: 'Бүтээгдэхүүн', url: '/products',                                 sortOrder: 2, active: true, openInNew: false, target: '_self' },
    { id: 'menu-3', label: 'Мал аж ахуй', url: '/products?types=BUNDLE&category=mal-aj-ahui', sortOrder: 3, active: true, openInNew: false, target: '_self' },
    { id: 'menu-4', label: 'Хүлэмж',     url: '/products?types=BUNDLE&category=hulemj-tarialan', sortOrder: 4, active: true, openInNew: false, target: '_self' },
    { id: 'menu-5', label: 'PLATINUM',   url: '/products/platinum-belen-tusluud-buguud',     sortOrder: 5, active: true, openInNew: false, target: '_self' },
    { id: 'menu-6', label: 'Блог',       url: '/blog',                                       sortOrder: 6, active: true, openInNew: false, target: '_self' },
  ];

  for (const m of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: m.id },
      update: { label: m.label, url: m.url, sortOrder: m.sortOrder },
      create: m,
    });
  }

  console.log(`✅  seed.ts complete. Admin: ${admin.email} / Admin@12345`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
