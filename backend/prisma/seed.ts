import { PrismaClient, ProductType, Role } from '@prisma/client';
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

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'templates' },
      update: {},
      create: {
        name: 'Загварууд',
        slug: 'templates',
        description: 'PowerPoint, Canva болон бусад загварууд',
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'documents' },
      update: {},
      create: {
        name: 'Баримт бичиг',
        slug: 'documents',
        description: 'Гэрээ, тайлан, чеклист',
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'courses' },
      update: {},
      create: {
        name: 'Сургалтууд',
        slug: 'courses',
        description: 'Видео сургалтууд',
        sortOrder: 3,
      },
    }),
  ]);

  const products = [
    {
      title: 'Бизнес төлөвлөгөөний загвар',
      slug: 'business-plan-template',
      description:
        'Монгол хэл дээрх бэлэн бизнес төлөвлөгөөний PowerPoint загвар. 40+ слайд, засварлахад хялбар.',
      price: 29900,
      type: ProductType.TEMPLATE,
      categoryId: categories[0].id,
      published: true,
      featured: true,
    },
    {
      title: 'Ажилтны гэрээний загвар',
      slug: 'employment-contract',
      description: 'Монгол хуулийн дагуу ажилтны гэрээний Word загвар.',
      price: 15000,
      type: ProductType.DOCUMENT,
      categoryId: categories[1].id,
      published: true,
      featured: false,
    },
    {
      title: 'Digital Marketing 101',
      slug: 'digital-marketing-101',
      description:
        'Дижитал маркетингийн үндэс — 12 хичээл, практик даалгавартай видео курс.',
      price: 89000,
      type: ProductType.LESSON,
      categoryId: categories[2].id,
      published: true,
      featured: true,
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        description: p.description,
        price: p.price,
        published: p.published,
        featured: p.featured,
      },
      create: {
        title: p.title,
        slug: p.slug,
        description: p.description,
        price: p.price,
        type: p.type,
        categoryId: p.categoryId,
        published: p.published,
        featured: p.featured,
      },
    });

    if (p.type === ProductType.LESSON) {
      const course = await prisma.course.upsert({
        where: { productId: product.id },
        update: {},
        create: { productId: product.id },
      });

      const lessonCount = await prisma.lesson.count({ where: { courseId: course.id } });
      if (lessonCount === 0) {
        await prisma.lesson.createMany({
          data: [
            {
              courseId: course.id,
              title: 'Оршил',
              description: 'Курсын танилцуулга',
              sortOrder: 1,
              durationSec: 300,
            },
            {
              courseId: course.id,
              title: 'Зорилтот зах зээл',
              description: 'Зорилтот хэрэглэгч тодорхойлох',
              sortOrder: 2,
              durationSec: 900,
            },
            {
              courseId: course.id,
              title: 'Контент стратеги',
              description: 'Контент төлөвлөлт',
              sortOrder: 3,
              durationSec: 1200,
            },
          ],
        });
      }
    }
  }

  // Demo banners
  const demoBanners = [
    {
      id: 'banner-1',
      title: 'Монголын хамгийн том дижитал зах зээл',
      subtitle: 'Файл, загвар, курс, видео — нэг дороос татах',
      imageUrl: '',
      linkUrl: '/products',
      linkLabel: 'Бүтээгдэхүүн үзэх',
      sortOrder: 1,
      active: true,
      bgColor: '#022179',
    },
    {
      id: 'banner-2',
      title: 'Бизнес загваруудын цуглуулга',
      subtitle: 'PowerPoint, Word, Excel — 50+ бэлэн загвар нэг багцад',
      imageUrl: '',
      linkUrl: '/products?type=TEMPLATE',
      linkLabel: 'Загварууд үзэх',
      sortOrder: 2,
      active: true,
      bgColor: '#0a3a8f',
    },
    {
      id: 'banner-3',
      title: 'Digital Marketing курс — 89,000₮',
      subtitle: '12 хичээл, практик даалгавар, гэрчилгээ. Өнөөдрөөс эхлэ.',
      imageUrl: '',
      linkUrl: '/products/digital-marketing-101',
      linkLabel: 'Курс авах',
      sortOrder: 3,
      active: true,
      bgColor: '#011560',
    },
  ];

  for (const b of demoBanners) {
    await prisma.banner.upsert({
      where: { id: b.id },
      update: {},
      create: b,
    });
  }

  // Demo testimonials
  const demoTestimonials = [
    {
      id: 'testimonial-1',
      name: 'Б. Эрдэнэбаяр',
      role: 'Стартапын үүсгэн байгуулагч',
      content: 'DigitalGer дээрх бизнес загвар маань надад маш их цаг хэмнэсэн. Investor presentation-д ашигласан чинь хөрөнгө оруулагчид маань маш их таалагдсан!',
      rating: 5,
      featured: true,
      active: true,
      sortOrder: 1,
    },
    {
      id: 'testimonial-2',
      name: 'О. Мөнхзул',
      role: 'HR Менежер, Монголын том компани',
      content: 'Ажилтны гэрээний загвар маш сайн бэлдсэн байсан. Хуулийн зөвлөхөөр шалгуулахад ямар ч засвар оруулаагүй. 100% санал болгоно!',
      rating: 5,
      featured: true,
      active: true,
      sortOrder: 2,
    },
    {
      id: 'testimonial-3',
      name: 'Д. Анхбаяр',
      role: 'Digital Маркетер',
      content: 'Digital Marketing 101 курс нь Монгол хэл дээрх хамгийн сайн курсуудын нэг. Практик даалгавруудаас маш их зүйл сурлаа.',
      rating: 5,
      featured: false,
      active: true,
      sortOrder: 3,
    },
    {
      id: 'testimonial-4',
      name: 'Г. Наранцэцэг',
      role: 'Freelance Дизайнер',
      content: 'Загваруудын чанар гайхалтай. Canva болон Photoshop-д нэн даруй ашиглаж болно. Цаг алдаагүйгээр ажлаа хийх боломж олгосон.',
      rating: 4,
      featured: false,
      active: true,
      sortOrder: 4,
    },
    {
      id: 'testimonial-5',
      name: 'С. Батмөнх',
      role: 'Жижиг бизнесийн эзэн',
      content: 'Байнга шинэ бүтээгдэхүүн нэмдэг нь маш сайн. Өөр платформд олддоггүй, Монгол бизнесийн хэрэгцээнд тохирсон загваруудтай.',
      rating: 5,
      featured: false,
      active: true,
      sortOrder: 5,
    },
  ];

  for (const t of demoTestimonials) {
    await prisma.testimonial.upsert({
      where: { id: t.id },
      update: {},
      create: t,
    });
  }

  // Add compareAtPrice and bundles to the business plan product
  const bpProduct = await prisma.product.findUnique({ where: { slug: 'business-plan-template' } });
  if (bpProduct) {
    await prisma.product.update({
      where: { id: bpProduct.id },
      data: { compareAtPrice: 49900 },
    });

    const existingBundles = await prisma.productBundle.count({ where: { productId: bpProduct.id } });
    if (existingBundles === 0) {
      await prisma.productBundle.create({
        data: {
          productId: bpProduct.id,
          title: 'PowerPoint загварууд',
          sortOrder: 1,
          items: {
            create: [
              { name: 'Үндсэн загвар (40+ слайд)', sortOrder: 1 },
              { name: 'Гэрээний слайд', sortOrder: 2 },
              { name: 'Санхүүгийн тооцооллын хүснэгт', sortOrder: 3 },
              { name: 'SWOT шинжилгээний загвар', sortOrder: 4 },
            ],
          },
        },
      });
      await prisma.productBundle.create({
        data: {
          productId: bpProduct.id,
          title: 'Нэмэлт материал',
          sortOrder: 2,
          items: {
            create: [
              { name: 'Ашиглах заавар (PDF)', sortOrder: 1 },
              { name: 'Жишээ дүрслэгдсэн загвар', sortOrder: 2 },
              { name: 'Өнгөний схем (3 хувилбар)', sortOrder: 3 },
            ],
          },
        },
      });
    }

    // Assign all testimonials to business plan product
    const testimonials = await prisma.testimonial.findMany({ where: { active: true } });
    for (const t of testimonials) {
      await prisma.productTestimonial.upsert({
        where: { productId_testimonialId: { productId: bpProduct.id, testimonialId: t.id } },
        update: {},
        create: { productId: bpProduct.id, testimonialId: t.id },
      });
    }
  }

  // Default menu items
  const defaultMenuItems = [
    { id: 'menu-1', label: 'Нүүр', url: '/', sortOrder: 1, active: true, openInNew: false, target: '_self' },
    { id: 'menu-2', label: 'Файлууд', url: '/products?type=FILE', sortOrder: 2, active: true, openInNew: false, target: '_self' },
    { id: 'menu-3', label: 'Загварууд', url: '/products?type=TEMPLATE', sortOrder: 3, active: true, openInNew: false, target: '_self' },
    { id: 'menu-4', label: 'Курсууд', url: '/products?type=COURSE', sortOrder: 4, active: true, openInNew: false, target: '_self' },
    { id: 'menu-5', label: 'Ангилал', url: '/categories', sortOrder: 5, active: true, openInNew: false, target: '_self' },
  ];
  for (const m of defaultMenuItems) {
    await prisma.menuItem.upsert({ where: { id: m.id }, update: {}, create: m });
  }

  // Add FAQs and assign to all products
  const demoFaqs = [
    {
      id: 'faq-1',
      question: 'Татасны дараа яаж ашиглах вэ?',
      answer: 'Худалдан авсны дараа "Миний бүтээгдэхүүн" хэсгээс файлаа татаж авна. PowerPoint, Word, Excel файлуудыг харгалзах программаар нээнэ.',
      category: 'Ашиглалт',
      active: true,
      sortOrder: 1,
    },
    {
      id: 'faq-2',
      question: 'Загварыг засварлаж болох уу?',
      answer: 'Тийм, бүх загвар засварлагдах боломжтой. Текст, өнгө, логог өөрчлөх бүрэн боломжтой.',
      category: 'Ашиглалт',
      active: true,
      sortOrder: 2,
    },
    {
      id: 'faq-3',
      question: 'Буцаан олгох боломжтой юу?',
      answer: 'Дижитал бүтээгдэхүүний онцлогоос шалтгаалан татаж авсны дараа буцаан олгохгүй. Асуулт байвал худалдан авахаас өмнө холбогдоно уу.',
      category: 'Төлбөр',
      active: true,
      sortOrder: 3,
    },
    {
      id: 'faq-4',
      question: 'Хэдэн удаа татах боломжтой вэ?',
      answer: 'Насан туршид хязгааргүй удаа татаж авах боломжтой. Та бүртгэлдээ нэвтэрч "Таталтын түүх" хэсгээс олж болно.',
      category: 'Ашиглалт',
      active: true,
      sortOrder: 4,
    },
    {
      id: 'faq-5',
      question: 'QPay-ээр л төлдөг үү?',
      answer: 'QPay болон дотоодын банкны картаар төлбөр хийх боломжтой. Visa, Mastercard удахгүй нэмэгдэнэ.',
      category: 'Төлбөр',
      active: true,
      sortOrder: 5,
    },
  ];

  for (const f of demoFaqs) {
    await prisma.fAQ.upsert({
      where: { id: f.id },
      update: {},
      create: f,
    });
  }

  // Assign FAQs to all published products
  const allProducts = await prisma.product.findMany({ where: { published: true } });
  const allFaqs = await prisma.fAQ.findMany();
  for (const product of allProducts) {
    for (const faq of allFaqs) {
      await prisma.productFAQ.upsert({
        where: { productId_faqId: { productId: product.id, faqId: faq.id } },
        update: {},
        create: { productId: product.id, faqId: faq.id, sortOrder: faq.sortOrder },
      });
    }
  }

  console.log(`Seed complete. Admin: ${admin.email} / Admin@12345`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
