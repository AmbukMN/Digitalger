import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BLOG_POSTS = [
  {
    slug: 'digitalger-tailbar',
    title: 'DigitalGer гэж юу вэ? Монгол дижитал зах зээлийн тухай',
    excerpt: 'DigitalGer нь Монголын анхны тоон бүтээгдэхүүний зах зээл бөгөөд загвар, файл, сургалт, баримт бичгийг нэг дороос худалдан авах боломжтой.',
    content: `<h2>DigitalGer-ийн тухай</h2>
<p>DigitalGer нь Монгол хэрэглэгчдэд зориулсан <strong>тоон бүтээгдэхүүний зах зээл</strong> юм. Бид загвар, файл, сургалт, баримт бичиг болон бусад дижитал агуулгыг нэг дороос худалдан авах боломжийг олгодог.</p>
<h2>Яагаад DigitalGer-ийг сонгох вэ?</h2>
<ul>
<li>🚀 Шууд татаж авах боломжтой</li>
<li>💳 QPay болон банкны картаар төлбөр хийнэ</li>
<li>🛡️ Найдвартай, аюулгүй худалдаа</li>
<li>🇲🇳 100% Монгол хэл дээр</li>
</ul>
<h2>Хэн ашиглах вэ?</h2>
<p>Дизайнер, маркетологи, бизнесийн эзэд, оюутнууд — бүгд өөрт хэрэгтэй дижитал хэрэгсэлээ DigitalGer-ээс олно.</p>
<p>Одоо нэгдэж, ажлынхаа чанарыг дээшлүүл!</p>`,
    coverImageUrl: null,
    published: true,
    publishedAt: new Date('2025-01-10'),
    tags: ['DigitalGer', 'тухай', 'дижитал'],
    authorName: 'DigitalGer баг',
    sortOrder: 1,
  },
  {
    slug: 'powerpoint-zagvar-songoh-zarchimuud',
    title: 'PowerPoint загвар сонгохдоо анхаарах 5 зүйл',
    excerpt: 'Сайн загвар таны мэдээллийг илэрхийлэх, харагдах байдлыг мэргэжлийн болгоход чухал үүрэг гүйцэтгэнэ.',
    content: `<h2>Загвар сонгох нь яагаад чухал вэ?</h2>
<p>Олон хүн агуулгадаа хэт анхаарч, харагдах байдалд дутуу анхаарал хандуулдаг. Харин мэргэжлийн загвар ашигласнаар таны контентийн үнэ цэн нэмэгддэг.</p>
<h2>5 үндсэн зарчим</h2>
<ol>
<li><strong>Зорилгоо тодорхойл</strong> — борлуулалтын тайлан уу, илтгэл үү, сургалт уу?</li>
<li><strong>Өнгөний схемийг шалга</strong> — брэндийнхтэй нийцэж байна уу?</li>
<li><strong>Фонт уншигдах байдал</strong> — жижиг дэлгэцэнд ч тод харагдах ёстой.</li>
<li><strong>Агуулгын бүтэц</strong> — гарчиг, дэд гарчиг, текст тодорхой байна уу?</li>
<li><strong>Засварлах хялбар байдал</strong> — загварын элементүүд засах боломжтой байх хэрэгтэй.</li>
</ol>
<h2>DigitalGer дэх загварууд</h2>
<p>Манай загварын бүлэгт 50 гаруй мэргэжлийн PowerPoint загвар байгаа бөгөөд бүгд Монгол хэлний онцлогт тохирсон байна.</p>`,
    coverImageUrl: null,
    published: true,
    publishedAt: new Date('2025-02-14'),
    tags: ['PowerPoint', 'загвар', 'зөвлөгөө'],
    authorName: 'Батзаяа М.',
    sortOrder: 2,
  },
  {
    slug: 'biznesiin-tovshnii-barimtiin-baidlag',
    title: 'Бизнесийн гэрээ болон баримт бичгийн зөв загвар ашиглах нь',
    excerpt: 'Мэргэжлийн баримт бичиг таны бизнесийн нэр хүндийг дээшлүүлж, эрсдэлийг бууруулдаг.',
    content: `<h2>Яагаад стандарт баримт бичиг хэрэгтэй вэ?</h2>
<p>Монголын бизнест олон аж ахуйн нэгж стандарт бус, хуулиар баталгаажаагүй баримт бичиг ашигладаг нь маргаан, буруу ойлголт үүсгэх шалтгаан болдог.</p>
<h2>Хамгийн чухал баримт бичгүүд</h2>
<ul>
<li>Үйлчилгээний гэрээ</li>
<li>Нийлүүлэлтийн гэрээ</li>
<li>Ажлын гүйцэтгэлийн тайлан</li>
<li>Санхүүгийн нэхэмжлэх</li>
<li>Ажилтны гэрээ</li>
</ul>
<h2>DigitalGer-ийн баримт бичгүүд</h2>
<p>Бидний бэлдсэн загварууд <strong>Монгол хуулийн дагуу</strong> боловсруулагдсан бөгөөд хуульч мэргэжилтэнтэй нягтлан шалгагдсан байна. Word болон PDF форматаар авах боломжтой.</p>`,
    coverImageUrl: null,
    published: true,
    publishedAt: new Date('2025-03-05'),
    tags: ['гэрээ', 'баримт', 'бизнес', 'хууль'],
    authorName: 'Хуульч Э. Мөнхбаяр',
    sortOrder: 3,
  },
  {
    slug: 'marketing-content-strategii',
    title: 'Монгол бизнест зориулсан маркетингийн контент стратеги',
    excerpt: 'Зөв контент стратеги нь таны брэндийн мэдэгдэхүйц байдлыг нэмэгдүүлж, борлуулалтыг өсгөнө.',
    content: `<h2>Монгол зах зээлийн онцлог</h2>
<p>Монгол хэрэглэгчид Facebook, Instagram, TikTok-г идэвхтэй ашиглах бөгөөд видео контент хамгийн өндөр engagement-тай байдаг.</p>
<h2>Контент стратегийн 4 алхам</h2>
<ol>
<li><strong>Зорилтот үзэгчдийг тодорхойл</strong> — насны бүлэг, сонирхол, хэрэгцээ</li>
<li><strong>Контентийн календарь гарга</strong> — долоо хоног, сарын төлөвлөгөө</li>
<li><strong>Агуулгын өнцөг олон байлга</strong> — мэдээ, зөвлөгөө, кейс, урамшуулал</li>
<li><strong>Үр дүнг хэмжих</strong> — reach, engagement, conversion</li>
</ol>
<h2>Бэлэн загварыг ашигла</h2>
<p>DigitalGer дэх маркетингийн загварын бүлэгт нийгмийн сүлжээний пост, story, хаалтны баннер болон email загварууд байгаа. Цаг хэмнэж, чанарыг нэмэгдүүл.</p>`,
    coverImageUrl: null,
    published: true,
    publishedAt: new Date('2025-04-20'),
    tags: ['маркетинг', 'контент', 'стратеги', 'SMM'],
    authorName: 'Энхжин Д.',
    sortOrder: 4,
  },
  {
    slug: 'onlayn-surguuliig-yamar-platform-deer-baidlag',
    title: 'Онлайн сургалт явуулах хамгийн хялбар арга — DigitalGer курс',
    excerpt: 'Мэдлэгээ тоон бүтээгдэхүүн болгон зарж, орлогоо нэмэгдүүл. Монголд онлайн сургалт их хөгжиж байна.',
    content: `<h2>Онлайн сургалтын өсөлт</h2>
<p>Ковидын дараах үед Монгол хүмүүс онлайнаар сурах хандлага эрс нэмэгдсэн. Одоо өөрийн мэдлэгийг бусдад дамжуулах цаг болсон!</p>
<h2>Курс бүтээх алхмууд</h2>
<ol>
<li><strong>Сэдвийг сонго</strong> — чи юунд мэргэжилтэй вэ?</li>
<li><strong>Хичээлийн бүтэц гарга</strong> — модуль, хичээл тус бүр</li>
<li><strong>Агуулгаа бэлд</strong> — видео, слайд, дасгал</li>
<li><strong>DigitalGer-т байрлуул</strong> — хэрэглэгчид шууд авах боломжтой</li>
</ol>
<h2>Яагаад DigitalGer вэ?</h2>
<p>Бид курс дизайнийн <strong>бэлэн загварууд</strong>, PowerPoint слайд, сургалтын гарын авлагын загварыг санал болгодог. Сургалт бэлдэх цагаа хэмнэ!</p>`,
    coverImageUrl: null,
    published: true,
    publishedAt: new Date('2025-05-15'),
    tags: ['онлайн сургалт', 'курс', 'мэдлэг', 'орлого'],
    authorName: 'DigitalGer баг',
    sortOrder: 5,
  },
];

async function main() {
  console.log('Seeding blog posts...');

  for (const post of BLOG_POSTS) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        published: post.published,
        publishedAt: post.publishedAt,
        tags: post.tags,
        authorName: post.authorName,
        sortOrder: post.sortOrder,
      },
      create: post,
    });
    console.log(`✓ ${post.title}`);
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
