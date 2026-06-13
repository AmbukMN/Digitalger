// Bulk имэйл кампанит ажлын БЭЛЭН template-ууд. Admin дандаа гараар бичих
// шаардлагагүй — нэг товчоор subject+body бөглөнө. {{name}} зэрэг placeholder
// нь backend дээр хэрэглэгчийн нэрээр солигдоно (хэрэв дэмжвэл).
// HTML нь RichEditor (emailMode)-д ордог — энгийн p/h2/ul/strong/a tag.

export interface EmailTemplate {
  key: string;
  label: string; // dropdown-д харагдах нэр
  emoji: string;
  subject: string;
  body: string; // HTML
}

// CTA товч — имэйлд (Gmail/Outlook) найдвартай харагдах inline-style товч.
// primary өнгө (#022179 navy brand), center, padding-тай. Линкийн оронд энэ ашиглана.
function ctaButton(text: string, href: string): string {
  return `<p style="text-align:center;margin:24px 0;"><a href="${href}" style="display:inline-block;background:#022179;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;">${text}</a></p>`;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: 'coupon-10',
    label: '10% хөнгөлөлтийн купон',
    emoji: '🎁',
    subject: '🎁 Танд 10% хөнгөлөлтийн купон бэлэглэж байна!',
    body: `<h2>Танд тусгай бэлэг! 🎁</h2>
<p>Сайн байна уу!</p>
<p>Бид танд <strong>10% хөнгөлөлтийн купон</strong> бэлэглэж байна. Дараах кодыг ашиглан дуртай бүтээгдэхүүнээ хямдхан аваарай:</p>
<p style="text-align:center;"><strong style="font-size:20px;">SAVE10</strong></p>
<p>Худалдан авалт хийхдээ энэ кодыг оруулаарай. Яараарай — урамшуулал хязгаартай!</p>
${ctaButton('Бүтээгдэхүүн үзэх', 'https://digitalger.mn/products')}`,
  },
  {
    key: 'new-product',
    label: 'Шинэ бүтээгдэхүүн зарлах',
    emoji: '✨',
    subject: '✨ Шинэ бүтээгдэхүүн нэмэгдлээ!',
    body: `<h2>Шинэ бүтээгдэхүүнтэй танилцаарай ✨</h2>
<p>Сайн байна уу!</p>
<p>Бид танд зориулж <strong>шинэ бүтээгдэхүүн</strong> нэмлээ. Чанартай, бэлэн загвар, файлуудыг шууд татаж ашиглаарай.</p>
${ctaButton('Шинэ бүтээгдэхүүн үзэх', 'https://digitalger.mn/products?sortBy=newest')}
<p>Танд таалагдана гэдэгт итгэлтэй байна!</p>`,
  },
  {
    key: 'flash-sale',
    label: 'Flash sale / Том хямдрал',
    emoji: '🔥',
    subject: '🔥 ТОМ ХЯМДРАЛ — зөвхөн өнөөдөр!',
    body: `<h2>🔥 Том хямдрал эхэллээ!</h2>
<p>Сайн байна уу!</p>
<p>Зөвхөн хязгаарлагдмал хугацаанд <strong>бүх бүтээгдэхүүн дээр онцгой хямдрал</strong> зарлаж байна.</p>
<p>Хүсэн хүлээсэн бүтээгдэхүүнээ хамгийн хямд үнээр авах боломж — бүү алдаарай!</p>
${ctaButton('Хямдралтай бүтээгдэхүүн', 'https://digitalger.mn/products?onSale=true')}`,
  },
  {
    key: 'reactivation',
    label: 'Эргэн идэвхжүүлэх (удаан ороогүй)',
    emoji: '👋',
    subject: '👋 Таныг санаж байна — эргэж ирээрэй!',
    body: `<h2>Таныг санаж байна 👋</h2>
<p>Сайн байна уу!</p>
<p>Уртхан хугацаанд тантай уулзаагүй байна. Энэ хооронд бид олон <strong>шинэ бүтээгдэхүүн, хямдрал</strong> нэмсэн.</p>
<p>Эргэж ирээд шинэ зүйлстэй танилцаарай — танд тусгай урамшуулал хүлээж байна!</p>
${ctaButton('Дэлгүүр үзэх', 'https://digitalger.mn/products')}`,
  },
  {
    key: 'thank-you',
    label: 'Талархал / Гишүүнчлэл',
    emoji: '🙏',
    subject: '🙏 Бидэнтэй хамт байгаад баярлалаа!',
    body: `<h2>Танд баярлалаа! 🙏</h2>
<p>Сайн байна уу!</p>
<p>DigitalGer-ийг сонгож, бидэнтэй хамт байгаад чин сэтгэлээсээ <strong>баярлалаа</strong>.</p>
<p>Бид танд хамгийн чанартай дижитал бүтээгдэхүүн, үйлчилгээг хүргэхийн төлөө ажилласаар байна.</p>
<p>Санал хүсэлт байвал бидэнтэй чөлөөтэй холбогдоорой!</p>`,
  },
  {
    key: 'announcement',
    label: 'Мэдээлэл / Зарлал',
    emoji: '📢',
    subject: '📢 Чухал мэдээлэл — DigitalGer',
    body: `<h2>📢 Мэдээлэл</h2>
<p>Сайн байна уу!</p>
<p>Танд дараах чухал мэдээллийг хүргэж байна:</p>
<p>[Энд мэдээллээ бичнэ үү]</p>
<p>Дэлгэрэнгүй мэдээллийг манай вэбсайтаас аваарай.</p>
${ctaButton('Вэбсайт үзэх', 'https://digitalger.mn')}`,
  },
];
