import { PrismaClient, ProductType } from '@prisma/client';

const prisma = new PrismaClient();

async function addBundle(
  productId: string,
  title: string,
  description: string,
  sortOrder: number,
  items: { name: string; description: string; sortOrder: number }[],
) {
  const bundle = await prisma.productBundle.create({
    data: {
      productId,
      title,
      description,
      sortOrder,
    },
  });

  for (const item of items) {
    await prisma.bundleItem.create({
      data: {
        bundleId: bundle.id,
        name: item.name,
        description: item.description,
        sortOrder: item.sortOrder,
      },
    });
  }

  return bundle;
}

async function addFAQs(
  productId: string,
  faqs: { question: string; answer: string; sortOrder: number }[],
) {
  for (const faq of faqs) {
    const faqRecord = await prisma.fAQ.create({
      data: {
        question: faq.question,
        answer: faq.answer,
        sortOrder: faq.sortOrder,
        category: 'general',
      },
    });
    await prisma.productFAQ.create({
      data: {
        productId,
        faqId: faqRecord.id,
        sortOrder: faq.sortOrder,
      },
    });
  }
}

async function main() {
  console.log('🌱 Seeding: Байгууллагын Бэлэн Албан Баримтын Иж Бүрдэл...');

  // Upsert category
  const catAlban = await prisma.category.upsert({
    where: { slug: 'alban-barimtuud' },
    update: {
      name: 'Байгууллагын баримт',
      description: 'Байгууллага, ХХК, стартапд зориулсан бэлэн бичиг баримтын загварууд',
      icon: '📋',
      sortOrder: 10,
    },
    create: {
      name: 'Байгууллагын баримт',
      slug: 'alban-barimtuud',
      description: 'Байгууллага, ХХК, стартапд зориулсан бэлэн бичиг баримтын загварууд',
      icon: '📋',
      sortOrder: 10,
    },
  });

  // Upsert the product (safe to re-run)
  const existing = await prisma.product.findUnique({
    where: { slug: 'alban-barimtuud-ij-burdel' },
  });

  let alban: { id: string };

  if (existing) {
    alban = await prisma.product.update({
      where: { slug: 'alban-barimtuud-ij-burdel' },
      data: {
        title: 'Байгууллагын Бэлэн Албан Баримтын Иж Бүрдэл — 70 Файл, 8 Ангилал',
        seoTitle: 'Байгууллагын бэлэн бичиг баримт — 70 файл: гэрээ, санхүү, HR, маркетинг | DigitalGer',
        seoDescription: 'ХХК, стартап, байгууллагад шуудхан ашиглах 70 файлын бэлэн иж бүрдэл. Хөдөлмөрийн гэрээ, нэхэмжлэх, SWOT, Gantt chart, CRM, OKR, баланс тайлан гэх мэт 8 ангиллын бүх баримт нэг дороос.',
        price: 49000,
        compareAtPrice: 120000,
        published: true,
      },
    });
    console.log('✅ Product updated:', alban.id);
  } else {
    alban = await prisma.product.create({
      data: {
        title: 'Байгууллагын Бэлэн Албан Баримтын Иж Бүрдэл — 70 Файл, 8 Ангилал',
        slug: 'alban-barimtuud-ij-burdel',
        seoTitle: 'Байгууллагын бэлэн бичиг баримт — 70 файл: гэрээ, санхүү, HR, маркетинг | DigitalGer',
        seoDescription: 'ХХК, стартап, байгууллагад шуудхан ашиглах 70 файлын бэлэн иж бүрдэл. Хөдөлмөрийн гэрээ, нэхэмжлэх, SWOT, Gantt chart, CRM, OKR, баланс тайлан гэх мэт 8 ангиллын бүх баримт нэг дороос.',
        description: `Байгууллагын Бэлэн Албан Баримтын Иж Бүрдэл нь Монгол ХХК, стартап, жижиг дунд бизнесүүдэд зориулан боловсруулсан 70 файлын цогц багц юм.

Ажил эхлэхдээ бичиг баримт бэлтгэхэд цаг алдах хэрэггүй — дор хаяж 300 цагийн ажлыг орлох бэлэн загваруудыг нэг дарснаар татаж авна.

📌 Юу багтаж байна:
• 26 Word (.docx) — гэрээ, журам, маягт, хүсэлт
• 43 Excel (.xlsx) — тооцоолуур, бүртгэл, тайлан, хяналт
• 1 PowerPoint (.pptx) — танилцуулгын загвар

🗂️ 8 ангиллын бүтэц:
1. Компанийн үндсэн баримт (Журам, дүрэм, бүртгэл) — 11 файл
2. Санхүүгийн баримт (Нэхэмжлэх, баланс, цалин) — 9 файл
3. Төслийн удирдлага (Gantt, SWOT, Canvas) — 10 файл
4. Хүний нөөц (Гэрээ, анкет, үнэлгээ) — 9 файл
5. Гэрээ (9 төрлийн гэрээний загвар) — 9 файл
6. Маркетинг, борлуулалт (CRM, KPI, контент) — 12 файл
7. Үйл ажиллагаа (OKR, агуулах, эрсдэл) — 9 файл
8. Компанийн танилцуулга (PowerPoint загвар) — 1 файл`,
        price: 49000,
        compareAtPrice: 120000,
        type: ProductType.BUNDLE,
        published: true,
        featured: true,
        categoryId: catAlban.id,
        howToUse: '1. Татаж авсны дараа ZIP задлан 8 хавтасны бүтцийг харна\n2. Тус ангиллаасаа хэрэгтэй файлаа нээнэ\n3. Компанийн нэр, хаяг, огноо зэрэг тохируулалтыг хийнэ\n4. Шууд хэвлэж, нотариатаар баталгаажуулж болно (гэрээнүүд)\n5. Excel файлуудад өөрийн тоо баримт оруулахад автоматаар тооцоолно',
        howToUseSteps: JSON.stringify([
          { step: 1, title: 'Татаж авах', description: 'ZIP файлыг татаж аваад задлана' },
          { step: 2, title: 'Ангиллаасаа сонгох', description: '8 хавтаснаас хэрэгтэй ангиллаа нээнэ' },
          { step: 3, title: 'Нэр, хаягаа оруулах', description: 'Компанийн нэр, хаяг, огноог тохируулна' },
          { step: 4, title: 'Ашиглах', description: 'Excel-д тоо оруулахад автоматаар тооцоолно, Word-ыг хэвлэнэ' },
          { step: 5, title: 'Хадгалах', description: 'Өөрийн компанийн хувилбарыг хадгалж, дараа дахин ашиглана' },
        ]),
        whatsIncluded: '✅ 70 файл (Word + Excel + PowerPoint)\n✅ 8 ангилал бүрийн хавтас\n✅ Монгол хуульд нийцсэн гэрээний загварууд\n✅ Ажиллагаатай Excel тооцоолуурууд (цалин, баланс, нэхэмжлэх)\n✅ Хэвлэхэд бэлэн форматтай\n✅ Нэр, хаяг өөрчлөхөд л бэлэн\n✅ Татаж авснаас хойш хугацаагүй ашиглана',
        proofQuote: 'Хуульчид 200,000 төгрөгийн гэрээ бичүүлдэг байсан. Энэ багцаас авсан гэрээний загварыг 10 минутад тохируулж шууд ашигласан. Мөнгө, цаг хоёулаа хэмнэлээ.',
        proofText: 'Монголын жижиг бизнес эрхлэгчдийн хамгийн том асуудлын нэг бол бичиг баримт. Хуульч, нягтлан, маркетерт тус бүрд мөнгө зарцуулахгүйгээр мэргэжлийн түвшний бүх загварыг нэг удаа 49,000 төгрөгт авна.',
      },
    });
    console.log('✅ Product created:', alban.id);
  }

  // Clean up existing bundles/FAQs before re-seeding (safe re-run)
  const existingBundles = await prisma.productBundle.findMany({
    where: { productId: alban.id },
  });
  if (existingBundles.length > 0) {
    for (const bundle of existingBundles) {
      await prisma.bundleItem.deleteMany({ where: { bundleId: bundle.id } });
    }
    await prisma.productBundle.deleteMany({ where: { productId: alban.id } });
  }

  const existingPFAQs = await prisma.productFAQ.findMany({ where: { productId: alban.id } });
  for (const pf of existingPFAQs) {
    await prisma.productFAQ.delete({ where: { productId_faqId: { productId: pf.productId, faqId: pf.faqId } } });
    await prisma.fAQ.delete({ where: { id: pf.faqId } }).catch(() => {});
  }

  // ─── BUNDLE 1: Компанийн үндсэн бичиг баримт (11 файл) ───
  await addBundle(
    alban.id,
    '📁 Компанийн үндсэн бичиг баримт',
    'Байгууллагын үйл ажиллагааны суурь баримт бичгүүд — журам, дүрэм, бүртгэл, бичгийн загварууд',
    1,
    [
      { name: 'Хөдөлмөрийн дотоод журам.docx', description: '~8,000 үгтэй бүрэн журам — ажилтны эрх, үүрэг, цаг, амралт, шагнал, сахилга бат', sortOrder: 1 },
      { name: 'Албан бичгийн загвар.docx', description: 'Компанийн лого, хаяг, утастай хэвлэхэд бэлэн албан бичгийн template', sortOrder: 2 },
      { name: 'Гэрээний нэгдсэн бүртгэл.xlsx', description: 'Бүх гэрээний хяналтын tracker — хугацаа, статус, хариуцагч', sortOrder: 3 },
      { name: 'Илгээсэн албан бичгийн бүртгэл.xlsx', description: 'Явуулсан бичгүүдийн бүртгэл — огноо, дугаар, агуулга', sortOrder: 4 },
      { name: 'Тушаалын нэгдсэн бүртгэл.xlsx', description: 'А ба Б тушаалын хоёр sheet-тэй бүртгэл', sortOrder: 5 },
      { name: 'Хөдөлмөрийн гэрээ бүртгэл.xlsx', description: 'Ажилтан бүрийн гэрээний статус, хугацааны хяналт', sortOrder: 6 },
      { name: 'Уулзалтын тэмдэглэл.docx', description: 'Хурлын протоколын стандарт загвар', sortOrder: 7 },
      { name: 'Ёс зүйн дүрэм журам.docx', description: 'Мэргэжлийн зан үйлийн стандарт, дотоод ёс зүйн дүрэм', sortOrder: 8 },
      { name: 'Байгууллагын дүрэм.docx', description: 'ХХК-ийн үндсэн дүрмийн загвар — нэр, зорилго, бүтэц', sortOrder: 9 },
      { name: 'Компанийн стратегийн төлөвлөгөө.xlsx', description: '2026–2029 стратеги + SWOT sheet', sortOrder: 10 },
      { name: 'Удирдлагын бүтцийн схем.xlsx', description: 'Захирал → Хэлтэс → Ажилтны бүтцийн схем', sortOrder: 11 },
    ],
  );

  // ─── BUNDLE 2: Санхүүгийн бичиг баримт (9 файл) ───
  await addBundle(
    alban.id,
    '💰 Санхүүгийн бичиг баримт',
    'Цалин тооцоолуур, баланс тайлан, нэхэмжлэх, мөнгөн урсгал — бүх санхүүгийн загварууд',
    2,
    [
      { name: 'Ашиг, алдагдлын тооцоолол.xlsx', description: 'Орлого, зардал, цэвэр ашгийн тооцооны ажиллагаатай маягт', sortOrder: 1 },
      { name: 'Мөнгөн урсгалын тайлан.xlsx', description: '12 сарын cash flow — борлуулалт, зардал, тэнцэл', sortOrder: 2 },
      { name: 'Жижиг бизнесийн төсвийн төлөвлөгөө.xlsx', description: 'Орлогын таамаглал vs бодит — автоматаар зөрүү тооцно', sortOrder: 3 },
      { name: 'Цалин тооцоолуур.xlsx', description: 'Ажилтан бүрийн цалин, НДШХ, ХХОАТ автоматаар тооцно', sortOrder: 4 },
      { name: 'Зардлын тайлан.xlsx', description: 'Хэлтэс, ажилтнаар ангилсан зардлын тайлангийн маягт', sortOrder: 5 },
      { name: 'Аудитын тайлангийн загвар.docx', description: 'Санхүүгийн аудитын тайлангийн стандарт загвар', sortOrder: 6 },
      { name: 'Баланс тайлан.xlsx', description: 'Хөрөнгө, өр төлбөр, эзэмшигчийн өмч + тайлбар sheet', sortOrder: 7 },
      { name: 'Зээл/Хөрөнгө оруулалтын хүсэлт.docx', description: 'Банк, ЖДҮ-д гаргах зээлийн хүсэлтийн загвар', sortOrder: 8 },
      { name: 'Нэхэмжлэхийн загвар.xlsx', description: 'НӨАТ-тай ба НӨАТ-гүй хоёр хувилбар + заавар sheet', sortOrder: 9 },
    ],
  );

  // ─── BUNDLE 3: Төслийн удирдлага (10 файл) ───
  await addBundle(
    alban.id,
    '📊 Төслийн удирдлага',
    'Gantt chart, SWOT, Business Model Canvas, OKR, Stakeholder management — төслийн бүх хэрэгсэл',
    3,
    [
      { name: 'Төслийн төлөвлөгөө.xlsx', description: 'Зорилго, хариуцагч, хугацааны бүрэн төлөвлөлт', sortOrder: 1 },
      { name: 'Төслийн хийгдэх ажлын төлөвлөгөө.xlsx', description: 'Task breakdown — ач холбогдол, статус, дуусах огноо', sortOrder: 2 },
      { name: 'Бизнес модель канвас.xlsx', description: 'Business Model Canvas — 9 блок бүрэн', sortOrder: 3 },
      { name: 'Ажлын төлөвлөгөө.xlsx', description: 'To-do list — ажил, хариуцагч, гүйцэтгэл %', sortOrder: 4 },
      { name: 'Ажлын тайлан цагаар.xlsx', description: 'Time-blocking — ажилтан, огноо, ажлын тэмдэглэл', sortOrder: 5 },
      { name: 'Төслийн ерөнхий төлөвлөлт.xlsx', description: 'Арга хэмжээний ерөнхий цагийн хуваарь', sortOrder: 6 },
      { name: 'SWOT шинжилгээ.xlsx', description: 'Давуу, сул тал, боломж, аюул заналын бүрэн шинжилгээ', sortOrder: 7 },
      { name: 'Арга хэмжээний төсвийн загвар.xlsx', description: 'Төлөвлөгөө vs бодит зардлын харьцуулалт', sortOrder: 8 },
      { name: 'Gantt chart.xlsx', description: 'Долоо хоногоор хуваасан төслийн цагийн диаграм', sortOrder: 9 },
      { name: 'Stakeholder-ийн удирдлага.xlsx', description: 'Оролцогч талуудын бүртгэл, нөлөөлөл, стратеги', sortOrder: 10 },
    ],
  );

  // ─── BUNDLE 4: Хүний нөөцийн бичиг баримт (9 файл) ───
  await addBundle(
    alban.id,
    '👥 Хүний нөөцийн бичиг баримт',
    'Ажилтны бүртгэл, анкет, гэрээ, үнэлгээний маягт, NDA — HR-ийн бүх загварууд',
    4,
    [
      { name: 'Ажилтнуудын бүртгэл.xlsx', description: 'РД, нэр, утас, тушаал, цалин — бүрэн HR database', sortOrder: 1 },
      { name: 'Хөдөлмөрийн гэрээ.docx', description: '~2,100 үгтэй хуулийн шаардлагад нийцсэн гэрээ', sortOrder: 2 },
      { name: 'Ажлын анкет.docx', description: '~3,300 үгтэй дэлгэрэнгүй ажилд орохыг хүсэгчдийн маягт', sortOrder: 3 },
      { name: 'Нууц хадгалах гэрээ (HR).docx', description: 'Ажилтанд зориулсан NDA загвар', sortOrder: 4 },
      { name: 'Цагийн тайлан.xlsx', description: 'Ажилтан бүрийн сарын цагийн нэгтгэл', sortOrder: 5 },
      { name: 'Ажилтны гарын авлага.docx', description: 'Шинэ ажилтанд зориулсан дотоод журам, мэдээлэл', sortOrder: 6 },
      { name: 'Ажилтны үнэлгээний маягт.docx', description: 'Гүйцэтгэлийн үнэлгээний стандарт маягт', sortOrder: 7 },
      { name: 'Ажлын байрны тодорхойлолт.docx', description: 'Job description — үүрэг, шаардлага, нөхцөл', sortOrder: 8 },
      { name: 'Сургалтын бүртгэл.xlsx', description: 'Ажилтан бүрийн сургалтын түүх + дүгнэлт sheet', sortOrder: 9 },
    ],
  );

  // ─── BUNDLE 5: Гэрээ (9 файл) ───
  await addBundle(
    alban.id,
    '📝 Гэрээний загварууд',
    '9 төрлийн гэрээний загвар — хөдөлмөрийн, худалдааны, NDA, зөвлөх, түрээс гэх мэт',
    5,
    [
      { name: 'Хөлсөөр ажиллуулах гэрээ.docx', description: '~1,300 үгтэй — гэрээт ажилтны стандарт гэрээ', sortOrder: 1 },
      { name: 'Худалдах, худалдан авах гэрээ.docx', description: '~900 үгтэй — бараа бүтээгдэхүүний арилжааны гэрээ', sortOrder: 2 },
      { name: 'Хамтран ажиллах гэрээ.docx', description: '~1,000 үгтэй — байгууллага хоорондын хамтын ажиллагаа', sortOrder: 3 },
      { name: 'Ажил гүйцэтгэх гэрээ.docx', description: '~890 үгтэй — ажил гүйцэтгэлийн гэрээ', sortOrder: 4 },
      { name: 'Хөдөлмөрийн гэрээ.docx', description: '~2,100 үгтэй — Хөдөлмөрийн хуульд нийцсэн', sortOrder: 5 },
      { name: 'Нууц хадгалах гэрээ (NDA).docx', description: '~530 үгтэй — NDA стандарт хэлбэр', sortOrder: 6 },
      { name: 'Зөвлөх үйлчилгээний гэрээ.docx', description: 'Consulting agreement — монгол + англи гарчигтай', sortOrder: 7 },
      { name: 'Санхүүгийн дэмжлэгийн гэрээ.docx', description: 'Санхүүгийн тусламжийн гэрээний загвар', sortOrder: 8 },
      { name: 'Түрээсийн гэрээ.docx', description: 'Үл хөдлөх хөрөнгийн түрээсийн стандарт гэрээ', sortOrder: 9 },
    ],
  );

  // ─── BUNDLE 6: Маркетинг, борлуулалт (12 файл) ───
  await addBundle(
    alban.id,
    '📣 Маркетинг, борлуулалт',
    'CRM систем, контент календар, борлуулалтын KPI, өрсөлдөгчийн шинжилгээ, брэндийн удирдамж',
    6,
    [
      { name: 'Маркетингийн зардлын төлөвлөгөө.xlsx', description: '12 сарын master budget — төлөвлөгөө vs бодит', sortOrder: 1 },
      { name: 'Маркетингийн стратеги.xlsx', description: 'Customer Personas + Channel Implementation canvas', sortOrder: 2 },
      { name: 'CRM систем.xlsx', description: 'Dashboard, Contacts, Opportunities, Interactions — бүрэн CRM систем', sortOrder: 3 },
      { name: 'Контент маркетингийн төлөвлөгөө.xlsx', description: 'Сарын контент календар — Reels, пост, нийтлэх огноо', sortOrder: 4 },
      { name: 'Арга хэмжээний зардлын төлөвлөгөө.xlsx', description: 'Тоглолт, арга хэмжээний төсвийн тооцоолол', sortOrder: 5 },
      { name: 'Борлуулалтын үзүүлэлт.xlsx', description: 'Dashboard + Data sheet — борлуулалтын хураангуй', sortOrder: 6 },
      { name: 'Үнийн санал.docx', description: 'Үйлчилгээ, бүтээгдэхүүний үнийн саналын загвар', sortOrder: 7 },
      { name: 'SMART маркетингийн төлөвлөгөө.xlsx', description: 'Зорилго тодорхойлох, тооцоолох, үнэлэх 4 sheet', sortOrder: 8 },
      { name: 'Дижитал маркетингийн сарын төлөвлөгөө.xlsx', description: 'Reach, Leads, Customers, Conversion rates хяналт', sortOrder: 9 },
      { name: 'Брэндийн удирдамж.docx', description: 'Brand guidelines загвар', sortOrder: 10 },
      { name: 'Үйлчлүүлэгчийн судалгааны маягт.docx', description: 'Сэтгэл ханамжийн судалгааны маягт', sortOrder: 11 },
      { name: 'Өрсөлдөгчийн шинжилгээ.xlsx', description: 'Харьцуулалтын матриц + оноо үнэлгээний систем', sortOrder: 12 },
    ],
  );

  // ─── BUNDLE 7: Үйл ажиллагаа (9 файл) ───
  await addBundle(
    alban.id,
    '⚙️ Үйл ажиллагааны удирдлага',
    'OKR систем, агуулахын бүртгэл, эрсдэлийн удирдлага, хөрөнгийн бүртгэл, нийлүүлэгчийн tracker',
    7,
    [
      { name: 'Агуулахын удирдлага.xlsx', description: 'SKU, өнгө, хэмжээ, байршил, үлдэгдлийн бүртгэл', sortOrder: 1 },
      { name: 'Хэрэглэгчийн гомдол санал.xlsx', description: 'Feedback tracker — огноо, нэр, гомдол, шийдвэрлэлт', sortOrder: 2 },
      { name: 'OKR үнэлгээний систем.xlsx', description: 'Objective + Key Results — зорилго, хэмжүүр, хэрэгжилт', sortOrder: 3 },
      { name: 'Эд хөрөнгийн бүртгэл.xlsx', description: 'Нийт хөрөнгийн үнэлгээ + хяналт, хөдөлгөөн, ажилтанд хүлээлгэх', sortOrder: 4 },
      { name: 'Байгууллагын үндсэн хяналт.xlsx', description: 'Ажлын болон жилийн ашиг/алдагдлын хянах самбар', sortOrder: 5 },
      { name: 'Эрсдэлийн удирдлага.xlsx', description: 'Эрсдэлийн тодорхойлолт, түвшин, шийдэл', sortOrder: 6 },
      { name: 'IT болон техникийн хөрөнгийн бүртгэл.xlsx', description: 'Тоног төхөөрөмж + програм хангамжийн бүртгэл', sortOrder: 7 },
      { name: 'Нийлүүлэгчийн бүртгэл.xlsx', description: 'Нийлүүлэгч + үнэлгээний системтэй', sortOrder: 8 },
      { name: 'Стандарт үйл ажиллагааны журам.docx', description: 'SOP загвар — алхам алхмаар процесс тодорхойлох', sortOrder: 9 },
    ],
  );

  // ─── BUNDLE 8: Компанийн танилцуулга (1 файл) ───
  await addBundle(
    alban.id,
    '🖥️ Компанийн танилцуулга',
    'PowerPoint танилцуулгын мэргэжлийн загвар — хөрөнгө оруулагч, харилцагчид танилцуулахад бэлэн',
    8,
    [
      { name: 'Presentation загвар.pptx', description: 'Компанийн танилцуулгын PowerPoint загвар — мэргэжлийн дизайнтай, бэлэн структуртай', sortOrder: 1 },
    ],
  );

  // ─── FAQs ───
  await addFAQs(alban.id, [
    {
      question: 'Файлуудыг татаж авснаас хойш хэрхэн ашиглах вэ?',
      answer: 'ZIP файлыг задалбал 8 хавтастай бүтэц гарна. Хэрэгтэй ангиллаасаа файлаа нээж, компанийн нэр, хаяг, огноог өөрчилнө. Excel файлуудад тоо оруулахад автоматаар тооцоолно. Word файлуудыг шууд хэвлэж ашиглаж болно.',
      sortOrder: 1,
    },
    {
      question: 'Гэрээний загварууд Монгол хуульд нийцдэг үү?',
      answer: 'Тийм. Хөдөлмөрийн гэрээ нь Монгол Улсын Хөдөлмөрийн тухай хуулийн шаардлагад нийцсэн. Бусад гэрээнүүд ч Монгол Улсын иргэний хуулийн дагуу боловсруулсан. Гэсэн хэдий ч эрхзүйн үр дагаврыг баталгаажуулахын тулд нотариатаар баталгаажуулахыг зөвлөж байна.',
      sortOrder: 2,
    },
    {
      question: 'Цалин тооцоолуур Excel нь ямар татвар, шимтгэлийг тооцдог вэ?',
      answer: 'Цалин тооцоолуур нь НДШХ (Нийгмийн даатгалын шимтгэл) болон ХХОАТ (Хувь хүний орлогын албан татвар)-ыг автоматаар тооцно. Тоо оруулахад цалингийн хуваарилалт, суутгал, цэвэр цалин гарна.',
      sortOrder: 3,
    },
    {
      question: 'Нэг удаа худалдан авсны дараа дахин ашиглаж болох уу?',
      answer: 'Тийм, хугацаагүй. Нэг удаа татаж авсны дараа өөрийн компанид хэдэн ажилтанд ч, хэдэн гэрээнд ч хэрэглэж болно. Файлуудаа хуулж авсан ч болно.',
      sortOrder: 4,
    },
    {
      question: 'CRM систем Excel ямар боломжтой вэ?',
      answer: 'CRM.xlsx файл нь Dashboard (хураангуй), Organizations (байгууллагын бүртгэл), Contacts (харилцагчийн бүртгэл), Opportunities (борлуулалтын боломж), Interactions (харилцааны тэмдэглэл) гэсэн 5 sheet-тэй. Хялбар шүүлт, хайлтаар ажиллана.',
      sortOrder: 5,
    },
    {
      question: 'Файлуудыг өөрчлөх, нэмэлт хийж болох уу?',
      answer: 'Тийм, бүх файл Word болон Excel форматтай тул хэрэгцээнийхээ дагуу өөрчилж, нэмэлт оруулж болно. Загвар нь зөвхөн эхлэл цэг бөгөөд байгууллагынхаа онцлогт тохируулна.',
      sortOrder: 6,
    },
  ]);

  // ─── Testimonials ───
  const existingTestimonials = await prisma.productTestimonial.findMany({
    where: { productId: alban.id },
  });
  if (existingTestimonials.length === 0) {
    const testimonialsData = [
      {
        productId: alban.id,
        name: 'Б. Оюунтуяа',
        role: 'ХХК үүсгэн байгуулагч',
        content: 'Хуульчид 200,000 төгрөгийн гэрээ бичүүлдэг байсан. Энэ багцаас авсан гэрээний загварыг 10 минутад тохируулж шууд ашигласан. Мөнгө, цаг хоёулаа хэмнэлээ.',
        rating: 5,
        sortOrder: 1,
      },
      {
        productId: alban.id,
        name: 'Д. Батбаяр',
        role: 'Жижиг бизнес эрхлэгч',
        content: 'Excel цалин тооцоолуур гайхалтай. НДШХ, ХХОАТ-ыг гараар тооцдог байсан — одоо тоо оруулчихад л автоматаар гарчихдаг болсон. Нягтлангаасаа асуух хэрэггүй болсон.',
        rating: 5,
        sortOrder: 2,
      },
      {
        productId: alban.id,
        name: 'Г. Мөнхзаяа',
        role: 'Стартапын захирал',
        content: '70 файл байгаа ч эмх замбараагүй биш — 8 хавтаст ангилагдсан, шуудхан хэрэгтэй файлаа олдог. CRM, OKR, Gantt chart — гурвыг нь байнга ашиглаж байна. 49,000₮-д маш үнэ цэнтэй.',
        rating: 5,
        sortOrder: 3,
      },
    ];

    for (const t of testimonialsData) {
      const testimonial = await prisma.testimonial.create({
        data: {
          name: t.name,
          role: t.role,
          content: t.content,
          rating: t.rating,
        },
      });
      await prisma.productTestimonial.create({
        data: {
          productId: alban.id,
          testimonialId: testimonial.id,
        },
      });
    }
    console.log('✅ Testimonials created: 3');
  } else {
    console.log('ℹ️  Testimonials already exist, skipping.');
  }

  console.log('');
  console.log('🎉 Done! Байгууллагын Бэлэн Албан Баримтын Иж Бүрдэл seeded successfully.');
  console.log(`   Product ID: ${alban.id}`);
  console.log('   Bundles: 8 | Files: 70 | FAQs: 6 | Testimonials: 3');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
