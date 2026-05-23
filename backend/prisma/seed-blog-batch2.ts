import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BLOG_POSTS_BATCH2 = [
  // ── 1. МХБ хөрөнгийн бирж ──────────────────────────────────────────────────
  {
    slug: 'mhb-horongo-oruulalt-guide',
    title: 'МХБ-д хэрхэн хөрөнгө оруулах вэ — Эхлэгчдэд зориулсан бүрэн гарын авлага',
    excerpt: 'Монголын хөрөнгийн биржид хэрхэн данс нээх, хувьцаа сонгох, анхны хөрөнгө оруулалтаа хийх — алхам алхмаар тайлбарласан практик заавар.',
    coverImageUrl: '',
    published: true,
    publishedAt: new Date('2025-01-20'),
    tags: ['хөрөнгө оруулалт', 'МХБ', 'хувьцаа', 'санхүү', 'бирж'],
    authorName: 'DigitalGer',
    sortOrder: 7,
    content: `<h2>МХБ гэж юу вэ?</h2>
<p>Монголын хөрөнгийн бирж (МХБ) нь 1991 онд байгуулагдсан, Монголын хамгийн том санхүүгийн зах зээл юм. Өнөөдрийн байдлаар МХБ-д <strong>200 гаруй компанийн хувьцаа</strong> арилжаалагддаг бөгөөд нийт зах зээлийн үнэлгээ <strong>3 их наяд төгрөгөөс дээш</strong> болж өссөн байна.</p>
<p>Олон монгол хүн "хөрөнгө оруулалт" гэхээр зөвхөн үл хөдлөх хөрөнгө эсвэл алт бодно. Гэвч МХБ нь ердийн иргэнд ч нээлттэй — та ердөө 100,000 төгрөгөөс эхлэн хөрөнгө оруулалт хийж болно.</p>

<h2>Яагаад МХБ-д хөрөнгө оруулах вэ?</h2>
<p>Сүүлийн 5 жилийн статистикийг харвал МХБ-ийн индекс (MSE Top-20) дунджаар жилд <strong>15–25%</strong> өсч байсан. Банкны хадгаламжийн хүү 8–10% байдгийг бодоход хөрөнгийн бирж илүү өгөөжтэй байх боломжтой.</p>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:10px;text-align:left;">Хөрөнгө оруулалтын хэлбэр</th>
      <th style="padding:10px;text-align:center;">Жилийн дундаж өгөөж</th>
      <th style="padding:10px;text-align:center;">Эрсдэл</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Банкны хадгаламж</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">8–10%</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Маш бага</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">МХБ хувьцаа (Top-20)</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">15–25%</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Дунд</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Үл хөдлөх хөрөнгө</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">10–20%</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Дунд</td>
    </tr>
    <tr>
      <td style="padding:10px;">Алт</td>
      <td style="padding:10px;text-align:center;">5–15%</td>
      <td style="padding:10px;text-align:center;">Дунд</td>
    </tr>
  </tbody>
</table>

<h2>Алхам 1: Брокер компани сонгох</h2>
<p>МХБ-д хувьцаа худалдан авахын тулд заавал <strong>брокер компаниар дамжих</strong> ёстой. Монголд санхүүгийн зохицуулах хорооноос (СЗХ) зөвшөөрөл авсан хэд хэдэн брокер байдаг:</p>

<ul>
  <li><strong>TDB Securities</strong> — Худалдаа хөгжлийн банкны охин компани, найдвартай, онлайн платформтай</li>
  <li><strong>Golomt Securities</strong> — Голомт банктай холбоотой, уламжлалт брокер</li>
  <li><strong>BDS Securities</strong> — Хэд хэдэн онлайн хэрэгсэлтэй</li>
  <li><strong>Tushig Securities</strong> — Эхлэгчдэд ойр, зааварчилгаатай</li>
</ul>

<p>Брокер сонгохдоо дараах зүйлийг харгалзах хэрэгтэй: комиссын хэмжээ (ихэвчлэн 0.3–1%), онлайн платформ байгаа эсэх, хэрэглэгчийн үйлчилгээ.</p>

<h2>Алхам 2: Бүртгэлд хамрагдах (данс нээх)</h2>
<p>Данс нээхэд шаардлагатай баримт бичиг:</p>
<ul>
  <li>Иргэний үнэмлэх (эх хувь + хуулбар)</li>
  <li>Оршин суугаа хаягийн тодорхойлолт</li>
  <li>Гар утасны дугаар</li>
  <li>Анхны хөрөнгийн эх үүсвэр (зарим брокер шаардана)</li>
</ul>
<p>Данс нээлт ихэнх тохиолдолд <strong>2–5 ажлын өдөр</strong> үргэлжилнэ. Зарим брокер онлайнаар бүртгэл хийх боломжтой болгосон.</p>

<h2>Алхам 3: Дансаа цэнэглэх</h2>
<p>Данс нээгдсэний дараа брокерийн зааж өгсөн дансанд мөнгөө шилжүүлнэ. Анхны доод хэмжээ брокероос хамаарч <strong>50,000–500,000 төгрөг</strong> байдаг. Мөнгө шилжүүлсний дараа ихэвчлэн нэг ажлын өдрийн дотор идэвхжинэ.</p>

<h2>Алхам 4: Хувьцаа судлах, сонгох</h2>
<p>Хувьцаа сонгохдоо шинэ хөрөнгө оруулагчид дараах аргыг ашиглаж болно:</p>

<h3>Найдвартай компани хайх шалгуур</h3>
<ul>
  <li><strong>P/E харьцаа (Price/Earnings)</strong> — 10-аас доош байвал хямд үнэтэй байж болно</li>
  <li><strong>Ногдол ашиг (Dividend)</strong> — жил бүр ногдол ашиг тараадаг компани тогтвортой</li>
  <li><strong>Орлогын өсөлт</strong> — сүүлийн 3 жилийн санхүүгийн тайланг шалгах</li>
  <li><strong>Салбарын байдал</strong> — уул уурхай, банк, дэд бүтцийн салбар Монголд харьцангуй тогтвортой</li>
</ul>

<h3>МХБ-д арилжаалагдах алдартай хувьцаанууд</h3>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:10px;text-align:left;">Компани</th>
      <th style="padding:10px;text-align:left;">Салбар</th>
      <th style="padding:10px;text-align:center;">Тэмдэглэл</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Монгол Шуудан (MNS)</td>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Логистик</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Тогтвортой</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Талх чихэр (TCH)</td>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хүнс</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Ногдол ашигтай</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">APU компани</td>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хүнс, ундаа</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Том компани</td>
    </tr>
    <tr>
      <td style="padding:10px;">Монголын хөрөнгийн бирж (MSE)</td>
      <td style="padding:10px;">Санхүү</td>
      <td style="padding:10px;text-align:center;">Өсөлттэй</td>
    </tr>
  </tbody>
</table>

<h2>Алхам 5: Захиалга өгөх</h2>
<p>Брокерийн платформд нэвтэрч, сонгосон хувьцааны тэмдэглэгээг оруулаад, тоо хэмжээ болон үнийг тогтоон захиалга өгнө. Захиалгын хоёр төрөл байдаг:</p>
<ul>
  <li><strong>Market Order</strong> — Зах зээлийн одоогийн үнээр шууд худалдан авах</li>
  <li><strong>Limit Order</strong> — Та тохируулсан үнэд хүрэхэд л автоматаар худалдан авах</li>
</ul>

<h2>МХБ-ийн татвар ба зардал</h2>
<p>Хөрөнгийн ашгид <strong>10%</strong> татвар ногдоно (хувь хүн). Брокерийн комисс арилжааны дүнгийн <strong>0.3–1%</strong> байдаг. Жилийн дансны хөлс зарим брокерт байдаг тул урьдчилан лавлах хэрэгтэй.</p>

<h2>Эхлэгчдэд зориулсан 5 дүрэм</h2>
<ol>
  <li><strong>Бүх мөнгөө нэг хувьцаанд битгий хийгээрэй</strong> — 5–10 компанид тараах нь эрсдэлийг бууруулна</li>
  <li><strong>Урт хугацаанд бод</strong> — МХБ богино хугацаанд хэлбэлздэг, 3–5 жилийн хугацаатай хандах нь зөв</li>
  <li><strong>Санхүүгийн тайланг унш</strong> — Жил бүрийн тайланг МХБ-ийн сайтаас үнэгүй татаж авна</li>
  <li><strong>Шунахайрах хэрэггүй</strong> — "Маргааш 2 дахин өснө" гэж хэн нэгэн хэлбэл болгоомжлох хэрэгтэй</li>
  <li><strong>Зөвхөн алдаж болох мөнгөөрөө хөрөнгө оруул</strong> — Зээл авч хувьцаа авах нь маш аюултай</li>
</ol>

<blockquote style="border-left:4px solid #1a3c8f;padding:15px 20px;background:#f0f4ff;margin:20px 0;font-style:italic;">
  "Хөрөнгийн зах зээл нь тэвчээргүй хүнийх acheiev тэвчээртэй хүнд шилжүүлдэг механизм юм." — Уоррен Баффет
</blockquote>

<h2>Дүгнэлт</h2>
<p>МХБ-д хөрөнгө оруулах нь эхлэхэд хэцүү мэт боловч алхам алхмаар бол бүрэн боломжтой. Брокер сонгох → данс нээх → жижиг дүнгээр эхлэх → суралцах — энэ дарааллаар явбал таны санхүүгийн ирээдүй илүү найдвартай болно. Монголын эдийн засаг өсөлттэй байгаа энэ үед МХБ нь таны хадгалсан мөнгийг ажиллуулах хамгийн хүртээмжтэй арга юм.</p>`,
  },

  // ── 2. 50/30/20 санхүүгийн дүрэм ───────────────────────────────────────────
  {
    slug: '50-30-20-sanhuugiin-durem',
    title: '50/30/20 санхүүгийн дүрэм — Цалингаа зөв хуваарилах энгийн арга',
    excerpt: 'Цалинаа авмагц хэрхэн хуваарилах вэ? 50/30/20 дүрэм нь дэлхийд хамгийн өргөн хэрэглэгддэг санхүүгийн хуваарилалтын арга — Монгол амьдралд хэрхэн хэрэгжүүлэх тухай.',
    coverImageUrl: '',
    published: true,
    publishedAt: new Date('2025-01-27'),
    tags: ['хувийн санхүү', '50/30/20', 'төсөв', 'цалин', 'хадгаламж'],
    authorName: 'DigitalGer',
    sortOrder: 8,
    content: `<h2>Яагаад ихэнх монгол цалин сарын эцэст дуусдаг вэ?</h2>
<p>Монгол Улсын Үндэсний Статистикийн Хорооны 2025 оны мэдээллээр дундаж цалин <strong>2,479,600 төгрөг</strong> болж өссөн. Гэвч ихэнх монгол иргэн сарын эцэст мөнгө дуусаж хэцүүддэг — яагаад гэвэл тодорхой хуваарилалтын системгүй байдаг.</p>
<p>50/30/20 дүрэм нь Харвардын профессор, АНУ-ын Сенатор Элизабет Уоррений бичсэн "All Your Worth" номноос гаралтай бөгөөд дэлхий даяар хэдэн арван сая хүн хэрэглэдэг хамгийн энгийн санхүүгийн аргачлал юм.</p>

<h2>50/30/20 дүрэм яг юу вэ?</h2>
<p>Цалингийнхаа цэвэр орлогыг (татвар суутгасны дараа) гурван хэсэгт хуваана:</p>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:12px;text-align:left;">Хэсэг</th>
      <th style="padding:12px;text-align:center;">Хувь</th>
      <th style="padding:12px;text-align:left;">Юунд зарцуулах вэ</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Хэрэгцээ</strong></td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;font-size:1.2em;font-weight:bold;color:#1a3c8f;">50%</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Түрээс, хоол, нийтийн үйлчилгээ, тээвэр, эрүүл мэнд</td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Хүсэл</strong></td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;font-size:1.2em;font-weight:bold;color:#e67e22;">30%</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Ресторан, кино, шопинг, аялал, хобби</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;"><strong>Хадгаламж / Зээл</strong></td>
      <td style="padding:12px;text-align:center;font-size:1.2em;font-weight:bold;color:#27ae60;">20%</td>
      <td style="padding:12px;">Хадгаламж, хөрөнгө оруулалт, зээлийн нэмэлт төлбөр</td>
    </tr>
  </tbody>
</table>

<h2>Монгол цалинд хэрхэн тооцох вэ?</h2>
<p>Жишээ: Дундаж цалин <strong>2,000,000 төгрөг</strong> авдаг ажилчин:</p>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:10px;">Зүйл</th>
      <th style="padding:10px;text-align:right;">Дүн (₮)</th>
      <th style="padding:10px;text-align:left;">Жишээ зарцуулалт</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">50% — Хэрэгцээ</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;"><strong>1,000,000</strong></td>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Түрээс 600K + хоол 250K + тээвэр 150K</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">30% — Хүсэл</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;"><strong>600,000</strong></td>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Ресторан 200K + хувцас 200K + кино/цэнгэл 200K</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;">20% — Хадгаламж</td>
      <td style="padding:10px;text-align:right;"><strong>400,000</strong></td>
      <td style="padding:10px;">Банк 200K + МХБ хувьцаа 100K + яаралтай сан 100K</td>
    </tr>
  </tbody>
</table>

<h2>50% хэрэгцээнд юу ороно?</h2>
<p><strong>Ороно:</strong> орон сууцны түрээс эсвэл ипотекийн төлбөр, хоол хүнс, нийтийн үйлчилгээ (цахилгаан, дулаан, ус), нийтийн тээвэр эсвэл машины зардал, эрүүл мэндийн даатгал, сургуулийн хэмжээ, харилцаа холбоо (утас, интернет).</p>
<p><strong>Ороохгүй:</strong> Ресторан, кофе шоп, шопинг, цэнгэл — эдгээр нь "хүсэл"-д хамаарна.</p>

<blockquote style="border-left:4px solid #27ae60;padding:15px 20px;background:#f0fff4;margin:20px 0;">
  <strong>Чухал зөвлөгөө:</strong> Монголд орон сууцны түрээс хэтэрхий өндөр учир 50%-ийн хязгаарт багтаахад хэцүү байж болно. Энэ тохиолдолд 60/20/20 эсвэл 65/15/20 хувьтай эхэлж, аажмаар зохицуулах нь зүйтэй.
</blockquote>

<h2>20%-ийг яаж хуваарилах вэ?</h2>
<p>20%-ийн хадгаламжийг дор хаяж гурван хэсэгт хуваах нь зөв:</p>
<ol>
  <li><strong>Яаралтай сан (Emergency Fund)</strong> — 3–6 сарын зарлагатай тэнцэх дүн. Ажлаа алдах, эрүүл мэндийн асуудал гарахад ашиглах.</li>
  <li><strong>Хадгаламж</strong> — Тодорхой зорилготой (машин, орон сууц, аялал)</li>
  <li><strong>Хөрөнгө оруулалт</strong> — МХБ хувьцаа, хадгаламжийн бонд эсвэл хөрөнгийн сан</li>
</ol>

<h2>Хэрэв хэрэгцээ 50%-иас хэтэрвэл яах вэ?</h2>
<p>Монгол хотхоны түрээс өндөр байдаг тул ихэнх залуу хүмүүст 50% хангалтгүй байдаг. Үүнийг шийдэх хэд хэдэн арга байна:</p>
<ul>
  <li><strong>Хамтрагчтай түрээслэх</strong> — зардлыг хуваах</li>
  <li><strong>Орон сууцаа шилжүүлэх</strong> — цалинтай тохирох бүс нутаг хайх</li>
  <li><strong>Нэмэлт орлого нэмэх</strong> — фриланс, хавсарга ажил хийх</li>
  <li><strong>Хэрэгцээний зардалаа бууруулах</strong> — тогтмол зардлаа хянах</li>
</ul>

<h2>Амжилттай хэрэгжүүлэх 3 дадал</h2>
<ol>
  <li><strong>Цалин авмагцаа автоматаар хуваарил</strong> — өөр дансанд 20%-ийг шууд шилжүүл</li>
  <li><strong>Сарын эцэст тооцоо хар</strong> — ямар категорид хэт зарцуулав?</li>
  <li><strong>3 сарт нэг удаа дүгнэлт хий</strong> — тохируулга хийж сайжруул</li>
</ol>

<h2>Дүгнэлт</h2>
<p>50/30/20 дүрэм нь санхүүгийн мэдлэг дутмаг байсан ч шууд эхлүүлж болох хамгийн энгийн арга юм. Монгол иргэдийн дундаж цалин 2.5 сая төгрөгт хүрсэн энэ үед зөв хуваарилалт хийх нь тань ирээдүйн санхүүгийн эрх чөлөөг тодорхойлно. Цалин авсан тэр өдрөөсөө эхлэ — яах вэ, юу алдах вэ?</p>`,
  },

  // ── 3. Ипотекийн зээл ───────────────────────────────────────────────────────
  {
    slug: 'ipotekiin-zeel-avah-guide',
    title: 'Ипотекийн зээл авах бүрэн гарын авлага — 6%-ийн хөтөлбөрөөс эхлэн',
    excerpt: 'Монголд орон сууц авах хамгийн алдартай арга — ипотекийн зээл. 6%-ийн засгийн газрын хөтөлбөр, шаардлага, алхам алхмаар бүрдүүлэх материал, тооцооллыг бүрэн тайлбарлав.',
    coverImageUrl: '',
    published: true,
    publishedAt: new Date('2025-02-03'),
    tags: ['ипотек', 'орон сууц', 'зээл', 'банк', '6 хувь'],
    authorName: 'DigitalGer',
    sortOrder: 9,
    content: `<h2>Ипотекийн зээл гэж юу вэ?</h2>
<p>Ипотекийн зээл нь орон сууц буюу үл хөдлөх хөрөнгийг барьцаалан авах урт хугацааны зээл юм. Монголд засгийн газар болон Монголбанкны хамтарсан <strong>6%-ийн ипотекийн хөтөлбөр</strong> нь иргэдэд хамгийн хүртээмжтэй орон сууц худалдан авах боломж олгодог.</p>

<p>2026 оны 2 дугаар сарын байдлаар орон сууцны ипотекийн зээлийн дундаж хүү <strong>6.5%</strong> байна — энэ нь арилжааны банкны 13–18%-тай харьцуулахад асар их хэмнэлт юм.</p>

<h2>6%-ийн ипотекийн хөтөлбөр</h2>
<p>Засгийн газрын дэмжлэгтэй 6%-ийн хөтөлбөр нь дараах онцлогтой:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:12px;text-align:left;">Үзүүлэлт</th>
      <th style="padding:12px;text-align:left;">Нөхцөл</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Жилийн хүү</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>6%</strong></td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Зээлийн хэмжээ</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Хамгийн их 240 сая ₮</strong></td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Зээлийн хугацаа</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Хамгийн их 20 жил</strong></td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Урьдчилгаа төлбөр</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Үнийн дүнгийн 30% (LTV 70%)</strong></td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Орлогын харьцаа</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Сарын зээлийн төлбөр орлогын 45%-иас хэтрэхгүй</strong></td>
    </tr>
    <tr>
      <td style="padding:12px;">Хамрагдах нөхцөл</td>
      <td style="padding:12px;">Урьд нь ипотек аваагүй, хугацаа хэтэрсэн зээлгүй</td>
    </tr>
  </tbody>
</table>

<h2>Хэн авч болох вэ? — Шалгуур нөхцөл</h2>
<ul>
  <li>Монгол Улсын иргэн, 18 насанд хүрсэн</li>
  <li>Урьд нь ипотекийн болон нийгмийн орон сууцны хөтөлбөрт хамрагдаагүй байх</li>
  <li>Ямар нэгэн санхүүгийн байгууллагад хугацаа хэтэрсэн зээлгүй байх</li>
  <li>Тогтмол орлоготой, нийгмийн даатгалд бүртгэлтэй байх</li>
  <li>Сарын орлого нь зээлийн төлбөрийн хоёр дахин болох</li>
</ul>

<h2>Шаардлагатай бичиг баримт</h2>
<ol>
  <li>Иргэний үнэмлэхний хуулбар</li>
  <li>Оршин суугаа газрын бүртгэлийн тодорхойлолт</li>
  <li>Нийгмийн даатгалын дэвтэр (сүүлийн 12 сарын)</li>
  <li>Цалингийн тодорхойлолт (ажлын газраас, 3–6 сарын)</li>
  <li>Татварын тодорхойлолт (ХХОАТ-ын)</li>
  <li>Гэрлэлтийн гэрчилгээ (хамтран зээл авах тохиолдолд)</li>
  <li>Худалдан авах орон сууцны гэрчилгээ, кадастрын зургийн хуулбар</li>
  <li>Орон сууцны үнэлгээний акт (банкны зөвшөөрсөн үнэлгээний компаниас)</li>
</ol>

<h2>Алхам алхмаар процесс</h2>

<h3>1-р алхам: Урьдчилсан зөвшөөрөл авах</h3>
<p>Банкинд очоод зээлийн урьдчилсан зөвшөөрөл (pre-approval) авна. Энэ шатанд цалингийн тодорхойлолт, НД-ийн дэвтрийг авчирч, хэдий хэмжээний зээл авах боломжтойгоо тодруулна. Хугацаа: <strong>3–5 ажлын өдөр</strong>.</p>

<h3>2-р алхам: Орон сууц сонгох</h3>
<p>Зах зээл дээр 6%-ийн хөтөлбөрт хамрагдах орон сууцнуудаас сонгоно. Банкинд бүртгэлтэй барилгын компаниудын орон сууц л зээлд тохирно — банкнаасаа урьдчилан лавлах хэрэгтэй.</p>

<h3>3-р алхам: Үнэлгээ хийлгэх</h3>
<p>Банкны зөвшөөрсөн үнэлгээний компаниар орон сууцнаа үнэлүүлнэ. Зардал: <strong>150,000–300,000 ₮</strong>. Хугацаа: 2–3 ажлын өдөр.</p>

<h3>4-р алхам: Зээлийн өргөдөл гаргах</h3>
<p>Бүх баримт бичгийг бүрдүүлж банкинд өргөдөл гаргана. Банк зээлийн шийдвэр гаргахад <strong>7–14 ажлын өдөр</strong> шаардана.</p>

<h3>5-р алхам: Гэрээ байгуулах</h3>
<p>Зээл батлагдсаны дараа банктай зээлийн гэрээ, барьцааны гэрээ байгуулна. Нотариатаар гэрчлүүлнэ. Урьдчилгаа төлбөрийг худалдагчид төлнө.</p>

<h3>6-р алхам: Улсын бүртгэлд бүртгүүлэх</h3>
<p>Өмчлөх эрхийг шилжүүлэх — улсын бүртгэлийн газарт бүртгүүлж гэрчилгээ авна. Хугацаа: 3–5 ажлын өдөр.</p>

<h2>Практик тооцоолол: 150 сая төгрөгийн зээл</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:10px;">Үзүүлэлт</th>
      <th style="padding:10px;text-align:right;">Дүн</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Орон сууцны үнэ</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">214,000,000 ₮</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Урьдчилгаа (30%)</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">64,200,000 ₮</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Зээлийн дүн</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">150,000,000 ₮</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хүү (жилийн 6%)</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">6%</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хугацаа</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">20 жил</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Сарын төлбөр</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;"><strong>~1,074,643 ₮</strong></td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;">Нийт төлбөр (20 жилд)</td>
      <td style="padding:10px;text-align:right;"><strong>~257,914,320 ₮</strong></td>
    </tr>
  </tbody>
</table>

<h2>Хамтран зээл авах давуу тал</h2>
<p>Гэр бүл нийлж хамтарсан орлогоор зээл авах нь их дүнтэй зээл авах боломжийг нэмэгдүүлдэг. Жишээлбэл, нэг хүний цалин 1,500,000 ₮ бол зөвхөн ~800,000 ₮-ийн сарын төлбөр тэнцүүлнэ. Хоёулаа нийлбэл 3,000,000 ₮ орлоготой тул ~1,350,000 ₮ хүртэлх сарын төлбөрийг тэнцүүлэх боломжтой болно.</p>

<h2>Зөвлөгөө: Зээлийн өмнө бэлтгэл хийх</h2>
<ul>
  <li>Зээлийн түүхийг цэвэрлэ — Хэрэв хугацаа хэтэрсэн зээл байвал эхлэж барагдуул</li>
  <li>НД-ийн дэвтрийг тасалдалгүй хадгал — 12 сарын тасралтгүй бүртгэл чухал</li>
  <li>Урьдчилгааг урьдчилан бэлтгэ — 30%-ийн урьдчилгааг хэдэн жилийн хугацаанд хуримтлуул</li>
  <li>Нэмэлт зардал тооцоо — үнэлгээ, нотариат, бүртгэлийн хөлс нийтдээ 1–3 сая ₮</li>
</ul>`,
  },

  // ── 4. ХХК байгуулах ────────────────────────────────────────────────────────
  {
    slug: 'hhk-baiguulah-zaavar',
    title: 'ХХК байгуулах дэлгэрэнгүй заавар — 2025 оны шинэчилсэн алхамууд',
    excerpt: 'Хязгаарлагдмал хариуцлагатай компани (ХХК) хэрхэн байгуулах вэ? Улсын бүртгэлийн газар, шаардлагатай баримт, хугацаа, зардал — бүрэн тайлбарласан гарын авлага.',
    coverImageUrl: '',
    published: true,
    publishedAt: new Date('2025-02-10'),
    tags: ['ХХК', 'компани байгуулах', 'бизнес', 'бүртгэл', 'эрхлэгч'],
    authorName: 'DigitalGer',
    sortOrder: 10,
    content: `<h2>ХХК гэж юу вэ, яагаад сонгох вэ?</h2>
<p>Хязгаарлагдмал хариуцлагатай компани (ХХК) нь Монголд хамгийн түгээмэл хэлбэрийн хуулийн этгээд юм. 2025 оны байдлаар Монгол Улсад бүртгэлтэй нийт аж ахуйн нэгжийн <strong>70% гаруй</strong> нь ХХК хэлбэртэй байдаг.</p>

<h3>ХХК-ийн давуу тал</h3>
<ul>
  <li><strong>Хязгаарлагдмал хариуцлага</strong> — Компанийн өр төлбөрт хувийн эд хөрөнгө хариуцахгүй (зөвхөн оруулсан хөрөнгийн хэмжээгээр)</li>
  <li><strong>Нэг хүнд боломжтой</strong> — Ганцаараа ч ХХК байгуулж болно</li>
  <li><strong>Гэрээ байгуулах, банкны данс нээх</strong> — Хуулийн этгээдийн нэрийн өмнөөс үйл ажиллагаа явуулна</li>
  <li><strong>Итгэл найдвар</strong> — Харилцагч нар ХХК-тай ажиллахыг илүүд үздэг</li>
</ul>

<h2>ХХК байгуулахад шаардагдах нөхцөл</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:12px;text-align:left;">Шаардлага</th>
      <th style="padding:12px;text-align:left;">Дэлгэрэнгүй</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Үүсгэн байгуулагч</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">1–50 хүн (хуулийн этгээд ч байж болно)</td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Хамгийн бага дүрмийн сан</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Дотоодын ХХК-д заавал бус (хуулиар тогтоогдоогүй)</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Гадаад хөрөнгө оруулагч</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">100,000 USD/хувьцаа эзэмшигч бүр</td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Хаяг</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Монгол дахь хуулийн хаяг шаардлагатай</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;">Гүйцэтгэх захирал</td>
      <td style="padding:12px;">Монгол иргэн байх шаардлагагүй</td>
    </tr>
  </tbody>
</table>

<h2>Алхам 1: Компанийн нэр захиалах</h2>
<p>Улсын Бүртгэлийн Ерөнхий Газрын (УБЕГ) цахим системд нэвтэрч, компанийн нэрийн бүртгэл хийнэ. Нэр нь:</p>
<ul>
  <li>Кирилл үсгээр байх ёстой</li>
  <li>Аль хэдийн бүртгэлтэй нэртэй давхцахгүй байх</li>
  <li>Улс, Монгол, засгийн газар гэх мэт үгс орохгүй (тусгай зөвшөөрөлгүйгээр)</li>
</ul>
<p>Нэр баталгаажсаны дараа <strong>30 хоногийн дотор</strong> компанийг бүртгүүлэх шаардлагатай, эс тэгвэл хугацаа дуусна.</p>

<h2>Алхам 2: Дүрэм боловсруулах</h2>
<p>ХХК-ийн дүрэм нь компанийн үндсэн баримт бичиг юм. Дүрэмд заавал тусгах зүйлс:</p>
<ul>
  <li>Компанийн нэр, хаяг</li>
  <li>Үйл ажиллагааны чиглэл (ААНБ-ийн ангилалтай нийцүүлэн)</li>
  <li>Дүрмийн сангийн хэмжээ</li>
  <li>Хувьцаа эзэмшигчдийн бүтэц, эрх</li>
  <li>Удирдлагын бүтэц (захирлын бүрэн эрх гэх мэт)</li>
</ul>
<p>Хуульч эсвэл нотариатаар хийлгэх боломжтой — зардал <strong>50,000–200,000 ₮</strong> байдаг.</p>

<h2>Алхам 3: Шаардлагатай баримт бичиг бүрдүүлэх</h2>
<ol>
  <li>ХХК байгуулах тухай үүсгэн байгуулагчдын шийдвэр (протокол)</li>
  <li>Компанийн дүрэм (2 хувь)</li>
  <li>Үүсгэн байгуулагч нарын иргэний үнэмлэхний хуулбар</li>
  <li>Хуулийн хаягийн гэрчилгээ (байрны гэрэлтгэлийн гэрчилгээ эсвэл байр ашиглалтын гэрээ)</li>
  <li>Бүртгэлийн хураамж төлсөн баримт</li>
</ol>

<h2>Алхам 4: УБЕГ-т бүртгүүлэх</h2>
<p>Бичиг баримтаа бүрдүүлж УБЕГ-т (эсвэл цахимаар burtgel.mn сайтаар) өргөдөл гаргана.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:10px;">Бүртгэлийн хугацаа</th>
      <th style="padding:10px;text-align:right;">Хураамж</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Энгийн (7 ажлын өдөр)</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">50,000 ₮</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Яаралтай (3 ажлын өдөр)</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">100,000 ₮</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;">Маш яаралтай (1 ажлын өдөр)</td>
      <td style="padding:10px;text-align:right;">150,000 ₮</td>
    </tr>
  </tbody>
</table>

<h2>Алхам 5: Татварын бүртгэл</h2>
<p>УБЕГ-ийн гэрчилгээ авмагцаа <strong>ажлын 10 өдрийн дотор</strong> харьяа татварын хэлтэст бүртгүүлэх шаардлагатай. Татварын бүртгэл хийж, НӨАТ-ын бүртгэлийн асуудлыг тодруулна:</p>
<ul>
  <li>НӨАТ-д заавал бүртгүүлэх шалгуур: жилийн борлуулалт <strong>50 сая ₮</strong>-иас дээш байвал</li>
  <li>Ажилчидтай бол цалин хөлсний татвар суутгах үүрэгтэй</li>
</ul>

<h2>Алхам 6: Нийгмийн даатгалын бүртгэл</h2>
<p>НД-д харьяа байрлалаас хамаарч дүүргийн НД-ийн хэлтэст бүртгүүлнэ. Ажилтан авсан бол <strong>ажил эхэлсэнөөс 7 хоногийн дотор</strong> бүртгэх ёстой.</p>

<h2>Алхам 7: Банкны данс нээх</h2>
<p>Бүртгэлийн гэрчилгээ, дүрэм, захирлын иргэний үнэмлэхтэйгээр банкинд хуулийн этгээдийн данс нээнэ. Ихэнх банк <strong>1–3 ажлын өдрийн дотор</strong> данс нээдэг.</p>

<h2>Нийт зардлын тооцоолол</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:10px;">Зардлын зүйл</th>
      <th style="padding:10px;text-align:right;">Дүн (₮)</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">УБЕГ-ийн бүртгэлийн хураамж</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">50,000–150,000</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Нотариатын зардал</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">30,000–80,000</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Дүрэм боловсруулах (хуульч)</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">50,000–200,000</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Тамга хийлгэх</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">20,000–50,000</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;font-weight:bold;">Нийт дүн</td>
      <td style="padding:10px;text-align:right;font-weight:bold;">150,000–480,000 ₮</td>
    </tr>
  </tbody>
</table>

<h2>ХХК байгуулсны дараах үүрэг</h2>
<ul>
  <li><strong>Улирлын тайлан</strong> — 3 сар тутамд татварын тайлан гаргана</li>
  <li><strong>Жилийн тайлан</strong> — жилийн эцэст санхүүгийн тайлан гаргана</li>
  <li><strong>УБЕГ-т мэдэгдэх</strong> — захирал, хаяг, дүрмийн өөрчлөлтийг 30 хоногийн дотор бүртгүүлнэ</li>
  <li><strong>НД тайлан</strong> — сар бүр ажилчдын НД тайлан гаргана</li>
</ul>

<blockquote style="border-left:4px solid #1a3c8f;padding:15px 20px;background:#f0f4ff;margin:20px 0;">
  <strong>Зөвлөгөө:</strong> ХХК байгуулах нийт процесс одоо онлайнаар (burtgel.mn, e-mongolia.mn) хийх боломжтой болсон. Цахимаар бүртгэх нь хугацааг эрс багасгана.
</blockquote>`,
  },

  // ── 5. Фрилансерийн татвар ──────────────────────────────────────────────────
  {
    slug: 'frilanseriin-tatvar-guide',
    title: 'Фрилансерийн татвар — Монгол фрилансер хэрхэн татвараа зөв төлөх вэ',
    excerpt: 'Фриланс ажил хийж цалин авдаг ч татвараа мэдэхгүй? Монголд фрилансерт хамаарах татварын хуулиуд, тайлан гаргах арга, оновчлолын боломжуудыг тайлбарлав.',
    coverImageUrl: '',
    published: true,
    publishedAt: new Date('2025-02-17'),
    tags: ['фриланс', 'татвар', 'ХХОАТ', 'хувиараа', 'онлайн ажил'],
    authorName: 'DigitalGer',
    sortOrder: 11,
    content: `<h2>Монголд фриланс хийхэд татвар хамаарах уу?</h2>
<p>Тийм — Монголд орлого олох бүр татварт хамаарна. Фриланс, туслах ажил, онлайн платформоор (Upwork, Fiverr, YouTube гэх мэт) орлого олох бүх орлогод <strong>Хувь хүний орлогын албан татвар (ХХОАТ)</strong> ногдоно. Гэвч ихэнх фрилансер татвараа огт төлдөггүй — энэ нь цаашид торгуулийн эрсдэлтэй.</p>

<h2>Монголын татварын тогтолцоо — Фрилансерт хамаарах хэсэг</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:12px;text-align:left;">Орлогын төрөл</th>
      <th style="padding:12px;text-align:center;">Татварын хувь</th>
      <th style="padding:12px;text-align:left;">Тайлбар</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Цалин хөлс (ажлын гэрээтэй)</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;"><strong>10%</strong></td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Ажил олгогч суутгадаг</td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Үйлчилгээний орлого (фриланс)</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;"><strong>10%</strong></td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Өөрөө тайлагнах</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Хөрөнгө оруулалтын орлого</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;"><strong>10%</strong></td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Ногдол ашиг, хүүгийн орлого</td>
    </tr>
    <tr>
      <td style="padding:12px;">Эд хөрөнгийн орлого</td>
      <td style="padding:12px;text-align:center;"><strong>10%</strong></td>
      <td style="padding:12px;">Орон сууцны түрээсийн орлого</td>
    </tr>
  </tbody>
</table>

<h2>Фрилансер татвараа хэрхэн төлөх вэ?</h2>
<p>Монголд фрилансер ажил хийхдээ хоёр аргаар татвараа барагдуулж болно:</p>

<h3>Арга 1: Хувиараа эрхлэгчээр бүртгүүлэх</h3>
<p>Хамгийн хялбар арга — татварын хэлтэст хувиараа эрхлэгчээр бүртгүүлэх. Бүртгэлийн дараа:</p>
<ul>
  <li>Улирал тутам (3 сар тутам) татварын тайлан гаргана</li>
  <li>Орлогынхоо 10%-ийг ХХОАТ болгон төлнө</li>
  <li>Нийгмийн даатгалд сайн дурын үндсэн дээр хамрагдаж болно</li>
</ul>

<h3>ХХК байгуулж ажиллах</h3>
<p>Орлого томорвол ХХК байгуулж, аж ахуйн нэгжийн орлогын татвар (ААН ОТ) — 10% эсвэл нэг доголт татварын дэглэм ашиглах боломжтой.</p>

<h2>Нэг доголт татвар (patent) гэж юу вэ?</h2>
<p>Жилийн орлого <strong>50 сая ₮</strong>-иас хэтрэхгүй жижиг үйл ажиллагаа эрхлэгчид "нэг доголт татвар" (патент) ашиглаж болно. Энэ нь татварын тайланд ороогүйгээр сар бүр тогтсон дүн төлдөг тогтолцоо юм.</p>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:10px;">Үйл ажиллагааны төрөл</th>
      <th style="padding:10px;text-align:right;">Сарын патентийн дүн</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">IT, дизайн, онлайн үйлчилгээ</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">~15,000–25,000 ₮</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Орчуулга, бичгийн ажил</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">~10,000–20,000 ₮</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;">Зөвлөх үйлчилгээ</td>
      <td style="padding:10px;text-align:right;">~20,000–30,000 ₮</td>
    </tr>
  </tbody>
</table>

<h2>Гадаадаас орлого авах тохиолдолд</h2>
<p>Upwork, Fiverr, YouTube, Patreon гэх мэт гадаадын платформоос орлого авч байгаа бол:</p>
<ul>
  <li>Монгол банкны дансанд орсон мөнгөнд <strong>Монголын хуулийн дагуу 10% ХХОАТ</strong> хамаарна</li>
  <li>Зарим платформ (YouTube, Google) гадаадын татварыг суутгадаг — давхар татвараас зайлсхийх гэрээ байдаг тул шалгах хэрэгтэй</li>
  <li>Гадаадын мөнгө хүлээн авах үед банк гарал үүслийг нотлох баримт шаардаж болно</li>
</ul>

<h2>Татвар төлөхгүй бол яах вэ?</h2>
<p>Монголын Татварын ерөнхий газар сүүлийн жилүүдэд дижитал орлого мөрдөн шалгах чадавхиа нэмэгдүүлсэн. Татвараа төлөхгүйн үр дагавар:</p>
<ul>
  <li>Хугацаа хэтэрсэн татвар дээр <strong>сар бүр 0.1%</strong> торгуулийн хүү</li>
  <li>Их дүн болвол эрүүгийн хариуцлагад татагдах боломжтой</li>
  <li>Зээл, ипотек авах, гадаадад гарах зэрэгт саад болж болно</li>
</ul>

<blockquote style="border-left:4px solid #e74c3c;padding:15px 20px;background:#fff5f5;margin:20px 0;">
  <strong>Анхааруулга:</strong> 2024 оноос банкны дансны хөдөлгөөнийг татварын алба шууд харах боломжтой болсон. "Мэдэхгүй" гэдэг нь хамгаалалт биш.
</blockquote>

<h2>Татварын зардлыг хэрхэн оновчтой болгох вэ?</h2>
<ol>
  <li><strong>Зардлаа баримтжуул</strong> — Ажилд шаардлагатай зардал (компьютер, интернет, програм хангамж) татварын суурийг бууруулна</li>
  <li><strong>Хувиараа эрхлэгчээр бүртгүүл</strong> — Хэрэв бүртгэлгүй байвал аль болох хурдан бүртгүүлэх</li>
  <li><strong>Данс тусгаарла</strong> — Ажлын орлогыг хувийн зарлагаас тусад нь данс хөтөл</li>
  <li><strong>Нягтлан бодогчтой зөвлөл</strong> — Орлого өсөхийн хэрээр мэргэжлийн нягтлан авах нь хэмнэлттэй</li>
</ol>`,
  },

  // ── 6. Ажлын гэрээний 7 заалт ───────────────────────────────────────────────
  {
    slug: 'ajliin-gereenii-7-zaalt',
    title: 'Ажлын гэрээнд заавал анхаарах 7 заалт — Эрхээ мэдэж байгаарай',
    excerpt: 'Ажлын гэрээ гарын үсэг зурахаасаа өмнө юуг анхаарах вэ? Монголын Хөдөлмөрийн хуульд тулгуурлан, ажилчдын эрхийг хамгаалах 7 чухал заалтыг задлан тайлбарлав.',
    coverImageUrl: '',
    published: true,
    publishedAt: new Date('2025-02-24'),
    tags: ['ажлын гэрээ', 'хөдөлмөрийн хууль', 'ажилчны эрх', 'цалин', 'гэрээ'],
    authorName: 'DigitalGer',
    sortOrder: 12,
    content: `<h2>Яагаад ажлын гэрээ чухал вэ?</h2>
<p>Монголын Хөдөлмөрийн тухай хуулийн дагуу ажил олгогч нь ажлын гарааны эхний <strong>10 хоногийн дотор</strong> бичгийн хэлбэрийн ажлын гэрээ байгуулах үүрэгтэй. Гэвч практикт олон ажилтан гэрээгээ уншилгүй гарын үсэг зурдаг — энэ нь ирээдүйд маш том хохирол болдог.</p>
<p>2024 оны Хөдөлмөрийн маргааны комиссын тайланд дурдсанаар нийт маргааны <strong>63%</strong> нь ажлын гэрээний тодорхой бус болон дутуу заалтаас үүсдэг байна.</p>

<h2>1-р заалт: Ажлын байрны тодорхойлолт</h2>
<p>Гэрээнд таны хийх ажлын <strong>тодорхой жагсаалт</strong> байх ёстой. "Бусад ажил хийх" гэсэн ерөнхий заалт нь таныг дур мэдэн ямар ч ажилд оруулах боломж олгодог.</p>

<p><strong>Анхаарах асуулт:</strong></p>
<ul>
  <li>Ажлын байрны нэр тодорхой байна уу?</li>
  <li>Үндсэн үүрэг чиглэл бичигдсэн үү?</li>
  <li>"Гэрээнд зааснаас бусад ажил" хийлгэж болохгүй байх нөхцөл байна уу?</li>
</ul>

<h2>2-р заалт: Цалин, нэмэгдэл, урамшуулал</h2>
<p>Цалин нь гэрээнд <strong>тоо хэмжээгээр (төгрөгөөр)</strong> тусгагдсан байх ёстой. "Сайн ажиллавал нэмнэ", "сарын орлогоос хамаарна" гэсэн тодорхойгүй томьёолол хүлээн зөвшөөрч болохгүй.</p>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:12px;text-align:left;">Зүйл</th>
      <th style="padding:12px;text-align:left;">Хуулийн шаардлага</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Хамгийн бага цалин (2025)</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>792,000 ₮/сар</strong> (2025.04.01-ээс)</td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Цалин олгох хугацаа</td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Сард нэгдэл дээр 2 удаа (хуулийн заавал)</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;">Илүү цагийн нэмэгдэл</td>
      <td style="padding:12px;">Цагийн тарифын 1.5 дахин</td>
    </tr>
  </tbody>
</table>

<h2>3-р заалт: Ажлын цаг, амралт</h2>
<p>Монголын Хөдөлмөрийн хуулиар:</p>
<ul>
  <li>Долоо хоногт <strong>40 цаг</strong> (өдөрт 8 цаг) — хэвийн ажлын цаг</li>
  <li>Долоо хоногт 56 цагаас дээш ажиллуулж <strong>болохгүй</strong></li>
  <li>Жилийн үндсэн чөлөө: <strong>15 ажлын өдөр</strong> (ажилласан жилийн тоогоор нэмэгдэнэ)</li>
  <li>Эмэгтэйчүүдийн жирэмсний чөлөө: <strong>120 хоног</strong></li>
</ul>

<blockquote style="border-left:4px solid #f39c12;padding:15px 20px;background:#fffbf0;margin:20px 0;">
  <strong>Анхааруулга:</strong> "Хагас цагаар ажиллах" гэж бичигдсэн байгаа ч бодитоор бүтэн цагаар ажиллуулдаг тохиолдол нийтлэг. Гэрээнд ажлын цагаа тодорхой заалга.
</blockquote>

<h2>4-р заалт: Туршилтын хугацаа</h2>
<p>Хуулиар туршилтын хугацаа <strong>3 сараас хэтрэх</strong> ёсгүй (тусгай мэргэшил шаардсан ажилд 6 сар хүртэл). Туршилтын хугацаанд:</p>
<ul>
  <li>Хамгийн бага цалингаас доош цалин өгч <strong>болохгүй</strong></li>
  <li>Туршилтаар тэнцэхгүй гэж үзвэл <strong>3 хоногийн</strong> мэдэгдэл өгөх ёстой</li>
  <li>Туршилтын хугацааг давтан тогтоож <strong>болохгүй</strong></li>
</ul>

<h2>5-р заалт: Гэрээ цуцлах нөхцөл</h2>
<p>Ажил олгогч гэрээг цуцлахдаа хуулийн заавал журмыг дагах ёстой:</p>
<ul>
  <li><strong>Мэдэгдлийн хугацаа:</strong> Ихэвчлэн 30 хоног урьдчилж мэдэгдэх</li>
  <li><strong>Тэтгэмж:</strong> Ажилд орсон жилийн тооноос хамаарч нэг сараас дээш цалинтай тэнцэх тэтгэмж</li>
  <li><strong>Хууль бус халалт:</strong> Шүүхэд гомдол гаргах, ажилдаа эргэж орох эрхтэй</li>
</ul>

<h2>6-р заалт: Өрсөлдөхгүй байх нөхцөл (Non-compete)</h2>
<p>Монголын хуулиар өрсөлдөхгүй байх нөхцөл хүчинтэй байхын тулд:</p>
<ul>
  <li>Хугацаа: Ажлаас гарснаас хойш <strong>1 жилээс хэтрэхгүй</strong></li>
  <li>Ажил олгогч нь хязгаарлалтын хугацаанд сарын цалингийн <strong>доод тал 50%-ийг</strong> төлөх ёстой</li>
  <li>Хэт өргөн хүрээтэй (жишээ: бүх салбар, бүх улс) нөхцөл шүүхэд хүчингүй болдог</li>
</ul>

<h2>7-р заалт: Нийгмийн даатгал, эрүүл мэндийн даатгал</h2>
<p>Ажил олгогч <strong>заавал</strong> дараах даатгалыг хариуцах ёстой:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:10px;">Даатгалын төрөл</th>
      <th style="padding:10px;text-align:center;">Ажилтан</th>
      <th style="padding:10px;text-align:center;">Ажил олгогч</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Тэтгэврийн даатгал</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">7%</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">7%</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Эрүүл мэндийн даатгал</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">2%</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">2%</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Ажилгүйдлийн даатгал</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">0.5%</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">0.5%</td>
    </tr>
    <tr>
      <td style="padding:10px;">Үйлдвэрлэлийн осол</td>
      <td style="padding:10px;text-align:center;">—</td>
      <td style="padding:10px;text-align:center;">0.4–1%</td>
    </tr>
  </tbody>
</table>

<h2>Гэрээнд гарын үсэг зурахын өмнөх 5 асуулт</h2>
<ol>
  <li>Цалин маань тоогоор бичигдсэн үү?</li>
  <li>Туршилтын хугацаа хэдэн сар вэ?</li>
  <li>Илүү цагийн нэмэгдэл яаж тооцох вэ?</li>
  <li>Гэрээ цуцалвал юу болох вэ?</li>
  <li>НД, ЭМД маань бүртгэгдэх үү?</li>
</ol>`,
  },

  // ── 7. ChatGPT бизнест ──────────────────────────────────────────────────────
  {
    slug: 'chatgpt-ai-biznesed-ashiglah',
    title: 'ChatGPT болон AI-г бизнестэй хэрхэн ашиглах вэ — Монгол жишигч',
    excerpt: 'Дэлхийн Fortune 500 компаниудын 92% ChatGPT ашиглаж байна. Монголын жижиг бизнест AI хэрхэн цаг хугацаа, зардал хэмнэж, ажлын бүтээмжийг нэмэгдүүлэх тухай бодит жишээнүүд.',
    coverImageUrl: '',
    published: true,
    publishedAt: new Date('2025-03-03'),
    tags: ['ChatGPT', 'AI', 'бизнес', 'бүтээмж', 'технологи'],
    authorName: 'DigitalGer',
    sortOrder: 13,
    content: `<h2>AI дэлхийн бизнесийг хэрхэн өөрчилж байна вэ?</h2>
<p>2025 оны байдлаар ChatGPT долоо хоногт <strong>800 сая идэвхтэй хэрэглэгчтэй</strong> болсон бөгөөд Fortune 500 компаниудын <strong>92%</strong> ChatGPT ашиглаж байна. Дэлхийн аж ахуйн нэгжүүдийн <strong>78%</strong> нь AI-г дор хаяж нэг бизнесийн функцдээ нэвтрүүлсэн.</p>

<p>Монгол жижиг бизнесүүд ч гэсэн AI-г хэрэглэж <strong>40% хүртэл бүтээмжийн өсөлт</strong> авч болно. Хэрхэн эхлэх тухай ярилцья.</p>

<h2>Монгол бизнест хамгийн хэрэгтэй AI хэрэглээнүүд</h2>

<h3>1. Контент бичих, маркетинг</h3>
<p>Сошиал медиад байнга контент гаргах шаардлагатай байдаг. ChatGPT-ийн тусламжтайгаар:</p>
<ul>
  <li>Facebook, Instagram пост бичих — 5 минутын дотор 10 постын санаа гаргах</li>
  <li>Бүтээгдэхүүний тайлбар (product description) бичих</li>
  <li>Имэйл кампейн бэлтгэх</li>
  <li>Блог нийтлэл боловсруулах (энэ нийтлэл шиг!)</li>
</ul>

<p><strong>Хэмнэлт:</strong> Мэргэжлийн маркетерт сард 1–2 сая ₮ цалин өгөх биш, ChatGPT Plus-т <strong>сард ~45,000 ₮</strong> (20 USD) төлж ижил ажил хийж болно.</p>

<h3>2. Харилцагчийн үйлчилгээ автоматжуулах</h3>
<p>Monpay, Shopify, нөхцөл байдлаар chatbot суулгаж нийтлэг асуулт хариулах автомат систем байгуулна. Ашиг:</p>
<ul>
  <li>24/7 хариулт — ажлын цагнаас гадна ч хэрэглэгч хариулт авна</li>
  <li>Нэг мессежийг 200 хүнд нэгэн зэрэг хариулах</li>
  <li>Нийтлэг асуултад 80% хариулт автоматаар — ажилтан цөөлж болно</li>
</ul>

<h3>3. Тайлан, шинжилгээ</h3>
<p>Excel дата хийгдсэн байвал ChatGPT-д тайлбарлуулж болно. "Сүүлийн 3 сарын борлуулалтын чиг хандлагыг тайлбарла" гэхэд хэдхэн секундэд шинжилгээ гарна.</p>

<h3>4. Орчуулга, олон хэл</h3>
<p>Монгол-Англи-Хятад орчуулга нэн тэргүүний хэрэгтэй. Мэргэжлийн орчуулагчид нэг хуудас 10,000–20,000 ₮ авдаг бол ChatGPT хэдэн секундэд үнэгүй орчуулна.</p>

<h2>Монгол бизнест тохирсон AI хэрэгслүүд</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:12px;">Хэрэгсэл</th>
      <th style="padding:12px;">Хэрэглэгдэх чиглэл</th>
      <th style="padding:12px;text-align:center;">Үнэ</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>ChatGPT</strong></td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Бичих, шинжилгээ, зөвлөгөө</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Үнэгүй / $20</td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Canva AI</strong></td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Дизайн, зураг үүсгэх</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Үнэгүй / $15</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Notion AI</strong></td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Баримт, тэмдэглэл, төлөвлөгөө</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">$10/сар</td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Google Gemini</strong></td>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Зураг, тайлан, орчуулга</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Үнэгүй</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;"><strong>Otter.ai</strong></td>
      <td style="padding:12px;">Уулзалтын тэмдэглэл автомат</td>
      <td style="padding:12px;text-align:center;">Үнэгүй / $10</td>
    </tr>
  </tbody>
</table>

<h2>Бодит жишээ: Монгол жижиг дэлгүүр ChatGPT ашиглах нь</h2>
<p><strong>Нөхцөл байдал:</strong> Улаанбаатарт хувцасны дэлгүүртэй, Facebook хуудастай жижиг бизнес эрхлэгч.</p>

<h3>Өмнөх байдал (AI-гүй):</h3>
<ul>
  <li>Долоо хоногт 2–3 пост — маркетерт 300,000 ₮/сар</li>
  <li>Хэрэглэгчийн асуултад хариулах — өдөрт 2 цаг</li>
  <li>Нийтлэг: 7 хоногт ~15 цаг маркетингийн ажилд зарцуулдаг</li>
</ul>

<h3>ChatGPT-тэй болсны дараа:</h3>
<ul>
  <li>7 хоногт 10+ пост — ChatGPT санаа өгч, Canva дизайн хийнэ — 2 цаг</li>
  <li>Chatbot нийтлэг асуултад хариулна — 0.5 цаг хяналт</li>
  <li>Нийтлэг: 7 хоногт ~3 цаг — <strong>12 цаг хэмнэсэн</strong></li>
</ul>

<h2>ChatGPT-г хэрхэн үр дүнтэй ашиглах вэ?</h2>
<ol>
  <li><strong>Prompt (заалт) зөв бич</strong> — "Монгол Facebook-ийн уншигчдад зориулж, манай хувцасны дэлгүүрийн шинэ коллекцийн тухай 150 үгтэй пост бич" гэж тодорхой хэлэх</li>
  <li><strong>Бизнесийн контекст хий</strong> — ChatGPT-д өөрийн бизнесийн тухай, зорилтот үзэгчдийн тухай урьдчилж тайлбарла</li>
  <li><strong>Дахин засаж тохируул</strong> — AI-гийн гаргасан контентийг өөрийн хэв маягт тохируул</li>
  <li><strong>Нэг ажилд суурилуулж дагшин хий</strong> — Эхлэж нэг зүйл (жишээ: пост бичих) л автоматжуулаад, дараа нь нэмж явга</li>
</ol>

<blockquote style="border-left:4px solid #27ae60;padding:15px 20px;background:#f0fff4;margin:20px 0;">
  <strong>Дүгнэлт:</strong> AI бол ажилтнаа солидог биш, ажилтны бүтээмжийг нэмэгдүүлдэг хэрэгсэл юм. Монголын жижиг бизнест маркетинг, үйлчилгээ, бичиг цаасны ажилд AI нэвтрүүлснээр сарын 500,000–2,000,000 ₮-ийн зардал хэмнэх боломжтой.
</blockquote>`,
  },

  // ── 8. Facebook vs TikTok ───────────────────────────────────────────────────
  {
    slug: 'facebook-vs-tiktok-mongolian-marketing',
    title: 'Facebook vs TikTok: Монгол бизнест аль платформ дээр ажиллах вэ?',
    excerpt: 'Монголд Facebook хэрэглэгч олон, TikTok хурдтай өсч байна. Бизнестэй хүнд аль нь илүү үр дүнтэй вэ? Судалгаа, тоо баримт, бодит жишээнд тулгуурласан харьцуулалт.',
    coverImageUrl: '',
    published: true,
    publishedAt: new Date('2025-03-10'),
    tags: ['маркетинг', 'Facebook', 'TikTok', 'сошиал медиа', 'бизнес'],
    authorName: 'DigitalGer',
    sortOrder: 14,
    content: `<h2>Монголын сошиал медиагийн ертөнц</h2>
<p>2025 оны байдлаар Монголын интернет хэрэглэгчдийн тоо <strong>2.8 сая</strong>-д хүрсэн бөгөөд нийт хүн амын <strong>80% гаруй</strong> гар утсаар интернет ашигладаг. Монгол бизнесүүд дижитал маркетингт жил бүр илүү их хөрөнгө зарцуулж байна — гэхдээ аль платформд хэрэглэхэд хамгийн үр дүнтэй вэ?</p>

<h2>Facebook — Монголын хамгийн том платформ</h2>
<p>Facebook нь Монголд одоогоор хамгийн өргөн хэрэглэгддэг сошиал медиа хэвээр байна. Жижиг бизнесүүдийн <strong>83%</strong> Facebook ашигладаг бөгөөд олон монгол хэрэглэгч Facebook-ийг мэдээ, худалдаа, холбоо барихад голлон хэрэглэдэг.</p>

<h3>Facebook-ийн давуу тал</h3>
<ul>
  <li><strong>Том хэрэглэгчийн бааз</strong> — 30–55 насны үзэгчид хамгийн их</li>
  <li><strong>Facebook Marketplace</strong> — Монголд маш идэвхтэй худалдааны талбар</li>
  <li><strong>Facebook Groups</strong> — Нийгэмлэг байгуулах, итгэлцэл бий болгоход сайн</li>
  <li><strong>Нарийн таргетинг</strong> — Насны бүлэг, байршил, сонирхлоор оновчтой зар гаргах</li>
  <li><strong>Мессежийн хэрэгсэл</strong> — Messenger-ээр шууд харилцаа хийх</li>
</ul>

<h3>Facebook-ийн сул тал</h3>
<ul>
  <li>Органик хүртээмж буурч байна — зар харуулахад илүү мөнгө шаарддаг болж байна</li>
  <li>Залуу үеийн хэрэглэгчид TikTok руу шилжиж байна</li>
  <li>Engagement rate буурсан: дундаж <strong>0.046%</strong> (маш бага)</li>
</ul>

<h2>TikTok — Хурдацтай өссөн шинэ хүч</h2>
<p>TikTok Монголд 2020–2021 оноос эрчимтэй нэвтэрч, 2025 он гэхэд ялангуяа 16–35 насны хэрэглэгчдийн дунд Facebook-тай зэрэгцэж өрсөлддөг болсон. TikTok-ийн дундаж engagement rate <strong>1.73%</strong> — Facebook-ийн <strong>37 дахин</strong> өндөр.</p>

<h3>TikTok-ийн давуу тал</h3>
<ul>
  <li><strong>Органик хүртээмж өндөр</strong> — Дагагчгүй ч видео вирал болж болно</li>
  <li><strong>Залуу үзэгчид</strong> — 16–35 насны хэрэглэгчдэд хүрэхэд хамгийн сайн</li>
  <li><strong>Худалдааны нөлөө их</strong> — Жижиг бизнесүүдийн 88% борлуулалт нэмэгдсэн гэж мэдэгдсэн</li>
  <li><strong>TikTok Shop</strong> — Видео дотор шууд худалдаа хийх боломж</li>
  <li><strong>Контент бодит, жинхэнэ</strong> — Хэт засмал биш, жинхэнэ агуулга илүү ажилладаг</li>
</ul>

<h3>TikTok-ийн сул тал</h3>
<ul>
  <li>Видео контент байнга гаргах хэрэгтэй — цаг их шаарддаг</li>
  <li>35-аас дээш насны үзэгчдэд хүрэх хүртээмж бага</li>
  <li>Ахмад, консерватив бизнесийн хэрэглэгчдэд тохиромжгүй байж болно</li>
</ul>

<h2>Харьцуулсан хүснэгт</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:12px;">Үзүүлэлт</th>
      <th style="padding:12px;text-align:center;">Facebook</th>
      <th style="padding:12px;text-align:center;">TikTok</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Хэрэглэгчдийн нас</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">25–55+</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">16–35</td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Engagement rate</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">0.046%</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;font-weight:bold;color:#27ae60;">1.73%</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Органик хүртээмж</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Буурсан</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;font-weight:bold;color:#27ae60;">Өндөр</td>
    </tr>
    <tr>
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Контентийн төрөл</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Зураг, текст, видео</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Богино видео</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Зарын зардал</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Дунд</td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Харьцангуй бага</td>
    </tr>
    <tr>
      <td style="padding:12px;">Жижиг бизнест тохирох</td>
      <td style="padding:12px;text-align:center;">⭐⭐⭐⭐</td>
      <td style="padding:12px;text-align:center;">⭐⭐⭐⭐⭐</td>
    </tr>
  </tbody>
</table>

<h2>Ямар бизнест аль платформ тохирох вэ?</h2>

<h3>Facebook сонгоорой хэрэв:</h3>
<ul>
  <li>Зорилтот үзэгчид 30–60 насны хүмүүс</li>
  <li>Бүтээгдэхүүн/үйлчилгээний дэлгэрэнгүй тайлбар, мессежийн харилцаа чухал</li>
  <li>Орон нутгийн нийгэмлэгт зарлал хийх</li>
  <li>Байнгын харилцагчтай уламжлалт бизнес (автомашин, үл хөдлөх, гэр бүлийн үйлчилгээ)</li>
</ul>

<h3>TikTok сонгоорой хэрэв:</h3>
<ul>
  <li>Зорилтот үзэгчид залуу хүмүүс (18–35 нас)</li>
  <li>Хувцас, гоо сайхан, хоол, тоглоом, технологи</li>
  <li>Органик бүтээгдэхүүний промо, кейс study, хөгжилтэй агуулга</li>
  <li>Брэнд таниулах шинэ компани</li>
</ul>

<h2>Шилдэг стратеги: Хоёуланг ашигла</h2>
<p>Монголын дижитал маркетингийн мэргэжилтнүүдийн зөвлөгөөгөөр хамгийн үр дүнтэй стратеги нь <strong>хоёр платформыг нэгэн зэрэг ашиглах</strong> юм:</p>
<ul>
  <li><strong>TikTok</strong> — Шинэ үзэгчдэд хүрэх, брэнд таниулах, органик трафик</li>
  <li><strong>Facebook</strong> — Харилцагч хадгалах, зар ажиллуулах, Messenger харилцаа</li>
</ul>
<p>Хэрэв зөвхөн нэгийг сонгох шаардлагатай бол: <strong>Зорилтот үзэгчидтэйгээ нас, платформ давхцуулж шийд.</strong></p>`,
  },

  // ── 9. Цалинтаас бизнес болох ───────────────────────────────────────────────
  {
    slug: 'tsalingaas-biznes-boloh',
    title: 'Цалинтаас бизнес болох — Ажилчнаас эрхлэгч болох 7 алхам',
    excerpt: 'Ажилдаа явж цалин авч байхдаа бизнес эхлүүлэх боломжтой юу? Тийм. Тогтмол цалингаас аажмаар бие даасан бизнест шилжих практик замнал, жишээ, алдаанаас сэргийлэх зөвлөгөө.',
    coverImageUrl: '',
    published: true,
    publishedAt: new Date('2025-03-17'),
    tags: ['бизнес', 'эрхлэгч', 'цалин', 'эхлэл', 'карьер'],
    authorName: 'DigitalGer',
    sortOrder: 15,
    content: `<h2>"Бизнес эхлүүлмээр байна, гэхдээ хаанаас?" гэдэг асуулт</h2>
<p>Монголын хөдөлмөрийн зах зээлийн судалгаагаар ажиллагсдын <strong>64%</strong> нь ирээдүйд өөрийн бизнес эрхлэхийг хүсдэг. Гэхдээ ихэнх нь хэзээ нэгэн цагт л эхэлнэ гэж хүлээсэн хэвээр байдаг. Яагаад? Учир нь:</p>
<ul>
  <li>Тогтмол цалингаа алдахаас айдаг</li>
  <li>Хаанаас эхлэхээ мэдэхгүй</li>
  <li>Хангалттай хөрөнгөгүй гэж боддог</li>
  <li>Цаг байхгүй гэж боддог</li>
</ul>
<p>Гэвч бодит байдалд <strong>цалинтайгаа зэрэгцэн бизнес эхлүүлэх</strong> нь хамгийн найдвартай арга юм. Дэлхийн амжилттай бизнес эрхлэгчдийн олонх нь тогтмол ажилтайгаа зэрэгцэн бизнесээ аажмаар өсгөсөн байдаг.</p>

<h2>Яагаад ажилтайгаа зэрэгцэн эхлэх нь дээр вэ?</h2>
<ul>
  <li><strong>Санхүүгийн аюулгүй байдал</strong> — Цалин байгаа тул бизнес орлогогүй байсан ч гэр бүлийн зарлагаа хаана</li>
  <li><strong>Туршиж үзэх боломж</strong> — Санаагаа бодит зах зээлд туршиж, алдаагаа засах цаг байна</li>
  <li><strong>Хурдан ороход болно</strong> — Аль хэдийн хэрэглэгчтэй, орлоготой болсны дараа л ажлаасаа гарна</li>
</ul>

<h2>7 алхам: Цалинтаас бизнест шилжих замнал</h2>

<h3>Алхам 1: Бизнесийн санааг сонго (1–2 долоо хоног)</h3>
<p>Хамгийн сайн бизнесийн санаа нь таны <strong>одоогийн чадвар + зах зээлийн хэрэгцээ</strong>-ний огтлолцол дээр байдаг.</p>
<ul>
  <li>Би юунд сайн вэ? (дизайн, барилга, нягтлан, орчуулга гэх мэт)</li>
  <li>Миний мэддэг зүйлийг хэн хэрэгтэй вэ?</li>
  <li>Зах зээлд ямар асуудлыг шийдвэрлэж болох вэ?</li>
</ul>

<h3>Алхам 2: Хажуугийн ажлаар эхлэ (1–3 сар)</h3>
<p>Ажил дараа, амралтын өдрүүдэд бизнесийн санаагаа туршиж үзнэ. Зорилго: анхны 1–3 харилцагч олж, жижиг орлого авах.</p>
<p><strong>Жишээ:</strong> Дизайнер байвал Upwork эсвэл нутгийн компаниудад фриланс ажил хий → анхны орлого ав → туршлага хурим.</p>

<h3>Алхам 3: Санхүүгийн яаралтай санг бүрдүүл</h3>
<p>Ажлаасаа гарахаасаа өмнө <strong>6 сарын зарлагатай тэнцэх хуримтлал</strong> байх хэрэгтэй. Монголын дундаж гэр бүлийн сарын зарлага 1.5–2.5 сая ₮ бол:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:10px;">Хадгалах хугацаа</th>
      <th style="padding:10px;text-align:right;">Шаардлагатай хуримтлал</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">3 сар (хамгийн бага)</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">4.5–7.5 сая ₮</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">6 сар (зөвлөмж)</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">9–15 сая ₮</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;">12 сар (тогтвортой)</td>
      <td style="padding:10px;text-align:right;">18–30 сая ₮</td>
    </tr>
  </tbody>
</table>

<h3>Алхам 4: Анхны харилцагч олох</h3>
<p>Эхний харилцагч нь ихэвчлэн таны дотно хүрээлэлд байдаг — найз, хамаатан, хуучин хамтран зүтгэгч. Харамзалгүй хандаж, туслалцааг эрэлхийл.</p>

<h3>Алхам 5: Тогтмол орлогын босгыг тогтоо</h3>
<p>Ажлаасаа гарах нөхцөл — бизнесийн орлого нь одоогийн цалингийн <strong>дор хаяж 70–80%</strong>-д хүрсэн байх. Энэ нь шилжилтийг аюулгүй болгоно.</p>

<h3>Алхам 6: Ажлаасаа гарах</h3>
<p>Нөхцөл биелсний дараа хүндэтгэлтэйгээр, ажил олгогчдоо талархлаа илэрхийлэн гарна. "Хамтрагч байж болно" гэсэн сайн харилцааг хадгалах нь ирээдүйд тус болно.</p>

<h3>Алхам 7: Бизнесийг цөм руу ажиллуул</h3>
<p>Бүрэн цагийн эрхлэгч болсны дараа:</p>
<ul>
  <li>Нийгмийн даатгалаа хувиараа төл (Сайн дурын НД)</li>
  <li>Эрүүл мэндийн даатгалд хамрагд</li>
  <li>Татварын бүртгэл хий</li>
  <li>Санхүүгийн тооцооны систем бий болго</li>
</ul>

<h2>Хамгийн нийтлэг алдаанууд</h2>
<ul>
  <li><strong>Хэт эрт гарах</strong> — Орлого баттай болохоос өмнө ажлаасаа гарах</li>
  <li><strong>Хуримтлалгүй</strong> — Эхний жилд орлого тогтворгүй байдаг, нөөцгүй бол сандарна</li>
  <li><strong>Ганцаараа бүхнийг хийх</strong> — Чадахгүй зүйлдээ хэн нэгнийг авах эсвэл аутсорсинг хий</li>
  <li><strong>Татвар, бүртгэлийг орхих</strong> — Эхнээсээ зөв хийхгүй бол дараа хоёр дахин хэцүү</li>
</ul>

<blockquote style="border-left:4px solid #1a3c8f;padding:15px 20px;background:#f0f4ff;margin:20px 0;">
  <strong>Санаж байх зүйл:</strong> Монгол Улсад 2025 оны байдлаар идэвхтэй ажиллаж байгаа аж ахуйн нэгжийн тоо жилд дунджаар 15,000-аар нэмэгдсэн. Та эхлэх хамгийн сайн цаг бол <em>одоо</em> юм.
</blockquote>`,
  },

  // ── 10. Жижиг бизнесийн 7 алдаа ────────────────────────────────────────────
  {
    slug: 'jijig-biznesiin-7-aldaa',
    title: 'Жижиг бизнесийн 7 нийтлэг алдаа — Монгол эрхлэгчдийн туршлагаас',
    excerpt: 'Монголд бүртгэлтэй аж ахуйн нэгжийн 58.9% нь идэвхгүй болсон. Амжилтгүй болох хамгийн нийтлэг 7 шалтгааныг таниулж, та ижил алдаанд унахаас сэргийлнэ.',
    coverImageUrl: '',
    published: true,
    publishedAt: new Date('2025-03-24'),
    tags: ['бизнес', 'алдаа', 'жижиг бизнес', 'зөвлөгөө', 'эрхлэгч'],
    authorName: 'DigitalGer',
    sortOrder: 16,
    content: `<h2>Монголын бизнесийн хэцүү бодит байдал</h2>
<p>2025 оны мэдээллээр Монгол Улсад бүртгэлтэй нийт аж ахуйн нэгжийн <strong>58.9%</strong> нь идэвхгүй болсон байна. 2016 онтой харьцуулахад идэвхгүй компанийн тоо <strong>2.4 дахин</strong> өссөн. Дэлхийн судалгаагаар стартапуудын <strong>90%</strong> эхний 5 жилдээ хаагддаг.</p>
<p>Энэ нь бизнес эхлэхэд хэцүү гэсэн үг биш — зөрчилтэй алдаанаас сурч, урьдчилан сэргийлэх боломжтой гэсэн үг юм.</p>

<h2>Алдаа 1: Зах зээлийн судалгаагүйгээр эхлэх</h2>
<p>Монгол эрхлэгчдийн хамгийн нийтлэг алдаа нь <strong>"Би энэ бүтээгдэхүүнийг дуртай учир хамаг хүн авна"</strong> гэж бодох явдал юм. Дэлхийн стартап судалгаагаар бизнес амжилтгүй болох <strong>1-р шалтгаан</strong> нь "зах зээлийн хэрэгцээ байхгүй байсан" (42%) юм.</p>

<p><strong>Шийдэл:</strong> Бизнес эхлэхийн өмнө дор хаяж 50–100 боломжит харилцагчтай ярилц. Тэд таны бүтээгдэхүүнд мөнгөө төлөхөд бэлэн үү? Хэдийд нь, ямар нөхцөлд?</p>

<h2>Алдаа 2: Мөнгийн урсгалыг (cash flow) буруу тооцох</h2>
<p>Ашиг гарч байгаа ч компани мөнгөгүй болж хааж болно — cash flow буруу тооцсоноос. Монгол жижиг бизнесүүдийн <strong>29%</strong> мөнгөний урсгалын асуудлаас хаагддаг.</p>

<p><strong>Жишээ:</strong> Та бараагаа зарсан, харилцагч 30 хоногийн дараа төлнө гэж тохирсон. Гэвч чиний нийлүүлэгч 7 хоногт мөнгө авхыг шаарддаг. 23 хоногийн зөрүүд мөнгөний хомсдол үүсдэг.</p>

<p><strong>Шийдэл:</strong> Сар бүрийн орлого болон зарлагын урсгалыг тооцоол. Орлого орж ирэх хугацааг нийлүүлэгчийн төлбөрийн хугацаатай тааруул.</p>

<h2>Алдаа 3: Үнэ хэтэрхий бага тогтоох</h2>
<p>"Хямд байвал харилцагч олноо ирнэ" гэж бодож үнэ бага тогтоодог. Гэвч бодит байдалд хямд үнэ нь:</p>
<ul>
  <li>Мэргэжлийн бус, итгэлгүй харагдуулдаг</li>
  <li>Ашгийн маржинг дарж, хөгжих боломжийг хасдаг</li>
  <li>Маркетинг, үйлчилгээ сайжруулах хөрөнгөгүй болгодог</li>
</ul>

<p><strong>Шийдэл:</strong> Бүтээгдэхүүний <strong>бодит зардал</strong> (материал + цаг + бусад) зөв тооцоол. Дараа нь зах зээлийн дундаж үнийг судалж, өөрийн давуу талаасаа ногдуулж үнэ тогтоо.</p>

<h2>Алдаа 4: Маркетингт хөрөнгө зарцуулахгүй байх</h2>
<p>"Сайн бүтээгдэхүүн бол өөрөө зарагдана" гэж боддог. Гэвч орчин үеийн зах зээлд харагдахгүй бол байхгүйтэй адил. Монголын жижиг бизнесүүд маркетингт орлогынхоо дунджаар <strong>3–5%</strong> зарцуулдаг бол амжилттай компаниуд <strong>10–20%</strong> зарцуулдаг.</p>

<p><strong>Шийдэл:</strong></p>
<ul>
  <li>Сошиал медиад тогтмол, үнэ цэнэтэй контент гарга</li>
  <li>Google Maps, Facebook Page-ээ бүртгэж, хэрэглэгчдийн сэтгэгдэл цуглуул</li>
  <li>Орлогынхоо дор хаяж 5–8%-ийг маркетингд зарцуул</li>
</ul>

<h2>Алдаа 5: Бүхнийг ганцаараа хийх</h2>
<p>Монгол эрхлэгч нийтлэгээр захирал + нягтлан + маркетер + борлуулагч + жолооч нэгэн зэрэг байхыг оролддог. Энэ нь ажлын чанарыг бууруулж, эрхлэгчийг шатаадаг.</p>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <thead>
    <tr style="background:#1a3c8f;color:white;">
      <th style="padding:10px;">Ажлын төрөл</th>
      <th style="padding:10px;text-align:left;">Зөвлөмж</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Нягтлан, татвар</td>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хагас цагийн нягтлан авь (100–200K/сар)</td>
    </tr>
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Дизайн</td>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Canva, Fiverr-аас фриланс хий</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хуулийн асуудал</td>
      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хуульчтай зөвлөлдөх (зарим нь үнэгүй консультаци өгдөг)</td>
    </tr>
    <tr>
      <td style="padding:10px;">Интернет маркетинг</td>
      <td style="padding:10px;">Залуу маркетинг менежер авах эсвэл ChatGPT ашигла</td>
    </tr>
  </tbody>
</table>

<h2>Алдаа 6: Харилцагчдаасаа сэтгэгдэл (feedback) авахгүй байх</h2>
<p>Таны бизнесийн хамгийн чухал мэдлэгийн эх сурвалж бол харилцагчид. Гэвч олон эрхлэгч шүүмжлэл дуулахаас айж, сэтгэгдэл авдаггүй.</p>
<p><strong>Шийдэл:</strong> Борлуулалт хийсний дараа "Та манай бүтээгдэхүүн/үйлчилгээнд сэтгэл хангалуун байсан уу? Юуг сайжруулах вэ?" гэж асуу. 10 харилцагчийн 7 нь хариулна — энэ мэдээлэл мөнгөнд хэмжэгдэхгүй үнэтэй.</p>

<h2>Алдаа 7: Дижитал эрэмбэгүй, онлайнд харагдахгүй байх</h2>
<p>2025 онд Монгол хэрэглэгчид бараа, үйлчилгээ хайхдаа эхлээд Facebook, Google, TikTok харанa. Хэрэв тантай холбогдох хуудасгүй, утасгүй, мэдээлэлгүй бол харилцагч өрсөлдөгч рүү явна.</p>

<p><strong>Хамгийн багадаа хийх ёстой зүйл:</strong></p>
<ul>
  <li>Facebook Business Page нээ — үнэгүй</li>
  <li>Google Maps-д бизнесээ бүртгэ — үнэгүй</li>
  <li>Утасны дугаар, ажлын цаг, хаяг тодорхой бич</li>
  <li>Сард дор хаяж 2–4 удаа пост гарга</li>
</ul>

<h2>Дүгнэлт: Алдааг бус амжилтыг хуулбарла</h2>
<p>Монголд бизнесийн орчин хэцүү ч бодит жишээнүүд байдаг — жижиг гарааснаас том болсон компаниуд. Тэдний нийтлэг онцлог нь: зах зээлийг сайн судалсан, мөнгийн урсгалаа хянасан, маркетингт тогтмол хөрөнгө оруулсан, харилцагчдаа сонссон явдал юм. Дээрх 7 алдаанаас сэргийлснээр таны бизнесийн амьд үлдэх магадлал эрс нэмэгдэнэ.</p>

<blockquote style="border-left:4px solid #27ae60;padding:15px 20px;background:#f0fff4;margin:20px 0;">
  <strong>Санамж:</strong> Амжилттай бизнес эрхлэгчид алдаа гаргадаггүй биш — алдаанаасаа хурдан сурч, зохицдог хүмүүс юм.
</blockquote>`,
  },
];

async function main() {
  console.log(`🚀  seed-blog-batch2.ts эхэлж байна — ${BLOG_POSTS_BATCH2.length} нийтлэл...`);

  for (const post of BLOG_POSTS_BATCH2) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        coverImageUrl: post.coverImageUrl,
        published: post.published,
        publishedAt: post.publishedAt,
        tags: post.tags,
        authorName: post.authorName,
        sortOrder: post.sortOrder,
      },
      create: post,
    });
    console.log(`  ✅  ${post.slug}`);
  }

  console.log(`\n✅  Batch 2 дууслаа. Нийт ${BLOG_POSTS_BATCH2.length} нийтлэл upsert хийгдлээ.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
