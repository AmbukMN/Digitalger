--
-- PostgreSQL database dump
--

\restrict DhMGITtEr61E3GHcpnJTfyx5t7o8eGpYB30E2hgcoqn88KphxyB1mEL0oP422So

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: CouponType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CouponType" AS ENUM (
    'PERCENT',
    'FIXED'
);


--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'SUCCESS',
    'FAILED'
);


--
-- Name: ProductType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductType" AS ENUM (
    'FILE',
    'TEMPLATE',
    'DOCUMENT',
    'VIDEO',
    'LESSON',
    'BUNDLE',
    'HYBRID'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'USER',
    'ADMIN'
);


--
-- Name: ZipJobStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ZipJobStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'DONE',
    'FAILED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


--
-- Name: Banner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Banner" (
    id text NOT NULL,
    title text NOT NULL,
    subtitle text,
    "imageUrl" text NOT NULL,
    "linkUrl" text,
    "linkLabel" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "bgColor" text,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "desktopImageUrl" text,
    "mobileImageUrl" text,
    "videoUrl" text
);


--
-- Name: BlogPost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BlogPost" (
    id text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content text NOT NULL,
    "coverImageUrl" text,
    published boolean DEFAULT false NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    tags text[],
    "authorName" text DEFAULT 'DigitalGer'::text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BundleItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BundleItem" (
    id text NOT NULL,
    "bundleId" text NOT NULL,
    name text NOT NULL,
    description text,
    "fileId" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "fileIds" text[] DEFAULT '{}'::text[] NOT NULL,
    label text
);


--
-- Name: Category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    icon text
);


--
-- Name: Coupon; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Coupon" (
    id text NOT NULL,
    code text NOT NULL,
    type public."CouponType" NOT NULL,
    value numeric(12,2) NOT NULL,
    "minPrice" numeric(12,2),
    "maxUses" integer,
    "usedCount" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Course; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Course" (
    id text NOT NULL,
    "productId" text NOT NULL
);


--
-- Name: CourseModule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CourseModule" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    title text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


--
-- Name: Download; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Download" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "fileId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: FAQ; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FAQ" (
    id text NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    active boolean DEFAULT true NOT NULL,
    category text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Lesson; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Lesson" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    title text NOT NULL,
    description text,
    "videoKey" text,
    "durationSec" integer,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isFreePreview" boolean DEFAULT false NOT NULL,
    "videoUrl" text,
    "moduleId" text
);


--
-- Name: MenuItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MenuItem" (
    id text NOT NULL,
    label text NOT NULL,
    url text,
    "pageSlug" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    target text DEFAULT '_self'::text NOT NULL,
    "openInNew" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "userId" text NOT NULL,
    total numeric(12,2) NOT NULL,
    currency text DEFAULT 'MNT'::text NOT NULL,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    "qpayIdentifier" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "couponCode" text
);


--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderItem" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "productId" text NOT NULL,
    price numeric(12,2) NOT NULL
);


--
-- Name: Page; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Page" (
    id text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    "qpayPaymentId" text,
    "rawPayload" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text NOT NULL,
    price numeric(12,2) NOT NULL,
    type text NOT NULL,
    "categoryId" text,
    published boolean DEFAULT false NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    rating double precision DEFAULT 0 NOT NULL,
    "ratingCount" integer DEFAULT 0 NOT NULL,
    "downloadCount" integer DEFAULT 0 NOT NULL,
    "previewUrl" text,
    "seoTitle" text,
    "seoDescription" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "discountEndsAt" timestamp(3) without time zone,
    "howToUse" text,
    "whatsIncluded" text,
    "compareAtPrice" numeric(12,2),
    "howToUseSteps" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "videoUrl" text,
    "proofAuthorName" text,
    "proofAuthorRole" text,
    "proofImageUrl" text,
    "proofQuote" text,
    "proofText" text,
    "categoryIds" text[] DEFAULT '{}'::text[] NOT NULL,
    "downloadFileKey" text
);


--
-- Name: ProductBundle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductBundle" (
    id text NOT NULL,
    "productId" text NOT NULL,
    title text NOT NULL,
    description text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "downloadFileKey" text
);


--
-- Name: ProductFAQ; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductFAQ" (
    "productId" text NOT NULL,
    "faqId" text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


--
-- Name: ProductFile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductFile" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "fileName" text NOT NULL,
    "fileKey" text NOT NULL,
    "mimeType" text,
    "sizeBytes" integer,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ProductImage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductImage" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "fileKey" text DEFAULT ''::text NOT NULL,
    alt text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "videoUrl" text
);


--
-- Name: ProductTestimonial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductTestimonial" (
    "productId" text NOT NULL,
    "testimonialId" text NOT NULL
);


--
-- Name: ProductTypeConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductTypeConfig" (
    id text NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    description text,
    icon text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Review" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "productId" text NOT NULL,
    rating integer NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: SiteSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SiteSetting" (
    id text DEFAULT 'default'::text NOT NULL,
    "siteName" text DEFAULT 'DigitalGer'::text NOT NULL,
    "siteUrl" text DEFAULT 'https://digitalger.mn'::text NOT NULL,
    "supportEmail" text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "logoUrl" text,
    "canonicalUrl" text,
    "fbPixelId" text,
    "googleAnalyticsId" text,
    "googleSiteVerification" text,
    "googleTagManagerId" text,
    "metaDescription" text,
    "metaKeywords" text,
    "metaTitle" text,
    "naverSiteVerification" text,
    "ogDescription" text,
    "ogImageUrl" text,
    "ogTitle" text,
    "robotsNoFollow" boolean DEFAULT false NOT NULL,
    "robotsNoIndex" boolean DEFAULT false NOT NULL,
    "sitemapChangeFreq" text DEFAULT 'weekly'::text,
    "sitemapEnabled" boolean DEFAULT true NOT NULL,
    "sitemapPriority" text DEFAULT '0.8'::text,
    "twitterCardType" text DEFAULT 'summary_large_image'::text
);


--
-- Name: Testimonial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Testimonial" (
    id text NOT NULL,
    name text NOT NULL,
    avatar text,
    role text,
    content text NOT NULL,
    rating integer DEFAULT 5 NOT NULL,
    featured boolean DEFAULT true NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ThemeSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ThemeSetting" (
    id text DEFAULT 'default'::text NOT NULL,
    "primaryColor" text DEFAULT '221 83% 53%'::text NOT NULL,
    "secondaryColor" text DEFAULT '210 40% 96%'::text NOT NULL,
    "accentColor" text DEFAULT '262 83% 58%'::text NOT NULL,
    "layoutMode" text DEFAULT 'light'::text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "defaultTheme" text DEFAULT 'system'::text NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    name text,
    "passwordHash" text,
    image text,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    "oauthProvider" text,
    "oauthId" text,
    "refreshToken" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isGuest" boolean DEFAULT false NOT NULL,
    phone text
);


--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: Wishlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Wishlist" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "productId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ZipJob; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ZipJob" (
    id text NOT NULL,
    "userId" text NOT NULL,
    status public."ZipJobStatus" DEFAULT 'PENDING'::public."ZipJobStatus" NOT NULL,
    "zipKey" text,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
cmpaztvct00027sv4tul3p5ll	cmpaztvck00007sv4bsmbqteo	oauth	google	test123	\N	\N	\N	\N	\N	\N	\N
cmpbb9ylo00027secbrox9fmx	cmpbb9yl800007seco3fxoylb	oauth	google	106130992204922006760	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: Banner; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Banner" (id, title, subtitle, "imageUrl", "linkUrl", "linkLabel", "sortOrder", active, "bgColor", "startsAt", "endsAt", "createdAt", "updatedAt", "desktopImageUrl", "mobileImageUrl", "videoUrl") FROM stdin;
banner-1	Байгууллагын бэлэн Албан баримтын иж бүрдэл	Монголын ХХК, стартап, жижиг дунд бизнесүүдэд зориулан боловсруулсан 70 файлын цогц багц юм	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/011ea367-31a7-411b-b161-01171584e69f.jpg	/products/alban-barimt-bundle	Баримт загвар үзэх	1	t	#022179	\N	\N	2026-05-17 16:00:17.408	2026-05-23 16:21:51.552	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/011ea367-31a7-411b-b161-01171584e69f.jpg	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/ecea476c-63d0-4acf-b48d-339e1ddb5b71.jpg	\N
banner-2	PLATINUM - 300+ бэлэн багцалсан төслүүд	Мал аж ахуй, хүлэмж, ресторан, барилга, оёдол гэх мэт 8 ангиллын бүх төрлийн бэлэн төсөл	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/8cb98e24-4623-47b6-adba-b7487b2c70ef.jpg	/products/platinum-belen-tusluud	PLATINUM төсөл багц үзэх	0	t	#022179	\N	\N	2026-05-17 16:00:17.425	2026-05-22 15:45:57.65	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/8cb98e24-4623-47b6-adba-b7487b2c70ef.jpg	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/fd119ab9-ddf7-4b90-8bdd-f1a5509da77c.jpg	\N
\.


--
-- Data for Name: BlogPost; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BlogPost" (id, title, slug, excerpt, content, "coverImageUrl", published, "publishedAt", tags, "authorName", "sortOrder", "createdAt", "updatedAt") FROM stdin;
cmpg54s0q00007s0o2deqxlth	Банкны зээл авах бүрэн гарын авлага — 2025 оны шинэчлэгдсэн	bank-zeel-avah-guide	Монголын аль банк хамгийн хямд хүүтэй вэ? Бизнесийн зээлд ямар бичиг баримт шаарддаг вэ? Бизнесийн зээл батлуулах 7 алхмыг задлан тайлбарлав.	<h2>Монголын банкны зээлийн орчин — 2025–2026 оны байдал</h2>\n<p>Монголбанкны Мөнгөний бодлогын хороо 2025 оны 3-р сард бодлогын хүүг <strong>12 хувь</strong>-д хүргэж өсгөсний дараа жилийн туршид тэр хэвээр хадгалсан. Арилжааны банкуудын жижиг, дунд бизнест олгох зээлийн жилийн хүү дунджаар <strong>16–19%</strong> байгаа ба 2025 оны 10-р сарын байдлаар улсын дундаж зээлийн хүү <strong>17.36%</strong> байна (CEIC Data). Зээлийн өсөлт хурдтай хэвээр — 2025 оны 11-р сарын байдлаар нийт зээлийн хэмжээ өмнөх оны мөн үеэс <strong>21 хувиар</strong> өссөн.</p>\n\n<p>Монголд зээл авахад барьцаа хөрөнгийн шаардлага маш өндөр. Төв Азийн улсуудтай харьцуулахад Монголд зээлийн <strong>99.7%</strong> нь барьцаа хөрөнгийг заавар шаарддаг бөгөөд энэ нь OECD орнуудын дундажаас хоёр дахин өндөр (АБХ-ийн судалгаа). Тиймээс бизнесийн зээл авахаар бэлдэж байгаа хүн эхлээд барьцаа хөрөнгийн асуудлыг шийдвэрлэх хэрэгтэй.</p>\n\n<h2>Монголын үндсэн 4 том банк ба тэдний онцлог</h2>\n<p>Монголын банкны зах зээлийн <strong>80 орчим хувийг</strong> дөрвөн банк эзэлдэг: Хаан банк, Голомт банк, Худалдаа хөгжлийн банк (ХХБ), ХасБанк. 2024 оны цэвэр ашгаар Хаан банк 640 тэрбум, Голомт 400 тэрбум, ХХБ 300 тэрбум төгрөг ашиг гаргасан.</p>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Банк</th>\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Бизнесийн зээлийн хүү</th>\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Онцлог салбар</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Хаан банк</td><td style="padding:10px;border:1px solid #e5e7eb;">16–20%</td><td style="padding:10px;border:1px solid #e5e7eb;">Жижиг дунд бизнес, ХАА</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Голомт банк</td><td style="padding:10px;border:1px solid #e5e7eb;">17–21%</td><td style="padding:10px;border:1px solid #e5e7eb;">Худалдаа, үйлдвэрлэл</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">ХХБ (TDB)</td><td style="padding:10px;border:1px solid #e5e7eb;">16–20%</td><td style="padding:10px;border:1px solid #e5e7eb;">Томоохон корпораци, гадаад худалдаа</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">ХасБанк</td><td style="padding:10px;border:1px solid #e5e7eb;">15–19%</td><td style="padding:10px;border:1px solid #e5e7eb;">Хөдөө аж ахуй, жижиг бизнес</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">ЖДҮ сан (дэмжлэгийн)</td><td style="padding:10px;border:1px solid #e5e7eb;"><strong>8–12%</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">Жижиг дунд үйлдвэрлэл</td></tr>\n</tbody>\n</table>\n\n<h2>Бизнесийн зээлийн төрлүүд</h2>\n\n<h3>1. Хөрөнгө оруулалтын зээл</h3>\n<p>Тоног төхөөрөмж, барилга байгууламж, үйлдвэрлэлийн хүчин чадлаа өргөжүүлэхэд авах урт хугацаат зээл. Хугацаа: <strong>1–10 жил</strong>. Зарим банк хөнгөлөлтийн хугацаа (зөвхөн хүү төлөх) өгдөг.</p>\n\n<h3>2. Эргэлтийн хөрөнгийн зээл</h3>\n<p>Бараа материал, үйл ажиллагааны зардал, ажилтны цалинг санхүүжүүлэхэд зориулсан богино хугацаат зээл. Хугацаа: <strong>6–12 сар</strong>.</p>\n\n<h3>3. Овердрафт / Кредит шугам</h3>\n<p>Харилцах дансны зарлагын хязгаарт зорилтот дүнгийн хүрээнд хэрэгцээ гарсан үедээ ашиглах уян хатан санхүүжилт. Жижиг дунд бизнест хамгийн тохиромжтой.</p>\n\n<h3>4. Лизинг</h3>\n<p>Тоног төхөөрөмж, тээврийн хэрэгсэл, техникийг урьдчилгаа төлбөртэй авч, сар бүр хэсэгчлэн төлдөг. Барьцаа нь тухайн хөрөнгө өөрөө байдаг тул заримдаа хялбар.</p>\n\n<h2>Банкны зээлд заавал шаардагддаг бичиг баримт</h2>\n\n<h3>Аль ч банканд заавал хэрэгтэй баримтууд:</h3>\n<ul>\n<li>✅ <strong>Аж ахуйн нэгжийн бүртгэлийн гэрчилгээ</strong> (улсын бүртгэл) + TIN дугаар</li>\n<li>✅ <strong>Санхүүгийн тайлан</strong> — сүүлийн 1–2 жилийн орлого, зарлага, баланс</li>\n<li>✅ <strong>Татварын тодорхойлолт</strong> — татварын өр дутагдалгүй гэсэн баталгаа</li>\n<li>✅ <strong>Нийгмийн даатгалын тодорхойлолт</strong></li>\n<li>✅ <strong>Бизнес төлөвлөгөө</strong> — санхүүгийн таамаглал, зах зээлийн шинжилгээ бүхий (банкны шийдлийн 70% энд)</li>\n<li>✅ <strong>Барьцаа хөрөнгийн баримт</strong> — үл хөдлөх хөрөнгийн гэрчилгээ, тоног төхөөрөмжийн нэхэмжлэх, гэрчилгээ</li>\n<li>✅ <strong>Иргэний үнэмлэх</strong> (хувь хүн / ТУЗ-ийн дарга)</li>\n</ul>\n\n<h3>Зарим банк нэмж шаарддаг:</h3>\n<ul>\n<li>📄 Захиалагч/гэрээллэгч байгууллагын гэрээний хуулбар</li>\n<li>📄 Газрын эрхийн баримт (ХАА, хүлэмж)</li>\n<li>📄 Хувийн дансны хуулга (сүүлийн 6 сар)</li>\n<li>📄 Байрны гэрээ (хэрэв түрээсэлсэн бол)</li>\n</ul>\n\n<h2>Барьцаа хөрөнгийн ангилал ба банкны үнэлгээний зарчим</h2>\n<p>Монголбанкны журмын дагуу арилжааны банкууд барьцаа хөрөнгийг зах зээлийн үнийн <strong>60–70%</strong>-д дүгнэн авдаг. Жишээ нь: 100 сая төгрөгийн орон сууц байвал банк 60–70 сая төгрөгийн зээл олгоно гэсэн үг.</p>\n\n<p><strong>Үл хөдлөх хөрөнгө</strong> — хамгийн хүлээн зөвшөөрөгддөг барьцаа: орон сууц, байшин, хашаа, үйлдвэрлэлийн байр, газрын эрх.</p>\n<p><strong>Хөдлөх хөрөнгө</strong> — тээврийн хэрэгсэл, тоног төхөөрөмж, банкин дахь хугацаат хадгаламж, үнэт металл, мал.</p>\n<p><strong>Биет бус хөрөнгө</strong> — хувьцаа, үнэт цаас, ашигт малтмалын лицензи, бараа нийлүүлэх гэрээний орлого.</p>\n\n<blockquote style="border-left:4px solid #f59e0b;padding:12px 16px;background:#fffbeb;margin:16px 0;">\n<strong>💡 Мэргэжлийн зөвлөмж:</strong> Барьцаа хөрөнгийн дутагдалтай жижиг дунд бизнес эрхлэгчид <strong>Зээлийн батлан даалтын сан (igf.mn)</strong>-д хандаж зөвхөн барьцааны хэсгийг нөхөж авах боломжтой.\n</blockquote>\n\n<h2>Зээлийн бүх зардлыг урьдчилан мэдэх — нуугдсан хураамжаас болгоомжил</h2>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Зардлын төрөл</th>\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Хэмжээ</th>\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Тайлбар</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Өргөдлийн хураамж</td><td style="padding:10px;border:1px solid #e5e7eb;">5,000–15,000 ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">Нэг удаа, татгалзсан ч буцаахгүй</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Зээл олголтын шимтгэл</td><td style="padding:10px;border:1px solid #e5e7eb;">0.5–1%</td><td style="padding:10px;border:1px solid #e5e7eb;">Зээлийн дүнгийн хувиар, нэг удаа</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Нотариатын зардал</td><td style="padding:10px;border:1px solid #e5e7eb;">Гэрээний дүнгээс хамааран</td><td style="padding:10px;border:1px solid #e5e7eb;">Зээлийн гэрээ хүчин төгөлдөр болгоход</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Үнэлгээний зардал</td><td style="padding:10px;border:1px solid #e5e7eb;">50,000–500,000 ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">Барьцаа хөрөнгийн мэргэжлийн үнэлгээ</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Гэрээ өөрчлөлтийн шимтгэл</td><td style="padding:10px;border:1px solid #e5e7eb;">0.5–1%</td><td style="padding:10px;border:1px solid #e5e7eb;">Нөхцөл өөрчлөхөд (хугацаа, хэмжээ)</td></tr>\n</tbody>\n</table>\n\n<p><strong>Жишээ тооцоолол:</strong> 50 сая ₮-ийн бизнесийн зээл авбал зөвхөн нэг удаагийн зардал нь: өргөдөл 10,000₮ + олголтын шимтгэл 375,000₮ (0.75%) + нотариат + үнэлгээ = нийт <strong>700,000–1,000,000 ₮</strong> орчим болж болно.</p>\n\n<h2>Зээлийн эргэн төлөлтийн 4 хэлбэр — алийг сонгох вэ?</h2>\n\n<p><strong>1. Тэнцүү нийт төлбөр (аннуитет)</strong> — сар бүр ижил дүн төлдэг. Тогтмол цалинтай ажилтнуудад тохиромжтой.</p>\n<p><strong>2. Тэнцүү үндсэн зээл + буурах хүү</strong> — эхний саруудад их, сүүлдээ бага төлдөг. Нийт хүүний зардал хамгийн бага болдог хэлбэр.</p>\n<p><strong>3. Улирлын хуваарь</strong> — бизнесийн орлого улирлын шинж чанартай бол (хөдөө аж ахуй, аялал жуулчлал) тохиромжтой.</p>\n<p><strong>4. Хөнгөлөлтийн хугацаатай</strong> — эхний 3–6 сард зөвхөн хүү төлж, үндсэн зээлийн эргэн төлөлтийг хойшлуулна. Бизнес эхлэх үед тохиромжтой.</p>\n\n<h2>Зээлийн түүх ба зээлдэгчийн ангилал</h2>\n<p>Монголбанкны журмын дагуу зээлдэгчийг хугацаа хэтэрсэн хоногоор ангилдаг:</p>\n<ul>\n<li>🟢 <strong>Хэвийн</strong> — 15 хүртэл хоног хэтэрсэн</li>\n<li>🟡 <strong>Анхаарал хандуулах</strong> — 16–90 хоног</li>\n<li>🟠 <strong>Хэвийн бус</strong> — 91–180 хоног</li>\n<li>🔴 <strong>Эргэлзээтэй</strong> — 181–360 хоног</li>\n<li>⛔ <strong>Муу</strong> — 361-с дээш хоног</li>\n</ul>\n<p>Сайн зээлдэгч болсноор дараа дараагийн зээлийн хүү буурч, хэмжээ нэмэгдэж, хугацаа уртасна. Муу зээлийн түүхтэй бол банкнаас дахин зээл авах боломж хаагдана.</p>\n\n<h2>Зээл батлуулах 8 алхам — практик гарын авлага</h2>\n\n<ol>\n<li><strong>Зорилго тодорхойл</strong> — яг юунд зээл авах вэ, хэдий хэмжээ хэрэгтэй вэ, хэрхэн эргүүлж төлөх вэ — эхлээд энэ гурвыг шийд.</li>\n<li><strong>Зөв банкаа сонго</strong> — ХАА банк хөдөө аж ахуйд, Хаан банк жижиг дунд бизнест, Голомт нь худалдаа, үйлдвэрлэлд, ХасБанк хөдөөгийн бизнест зориулагдсан. Банкны мэргэжилтэнтэй утсаар яриад таны чиглэлийг хэдийг дэмждэг болохыг лавла.</li>\n<li><strong>Бичиг баримтаа бүрдүүл</strong> — дээр жагсаасан жагсаалтаар бүгдийг хуулбарлаж бэлдэ. Нэг баримт дутуу байвал хэдэн долоо хоног хойшлоно.</li>\n<li><strong>Бизнес төлөвлөгөөгөө мэргэжлийн бич</strong> — энэ бол хамгийн чухал хэсэг. Санхүүгийн таамаглал, зах зээлийн шинжилгээ, эрсдэлийн үнэлгээ бүгдийг оруул.</li>\n<li><strong>Барьцаа хөрөнгийн үнэлгээ хийлгэ</strong> — банктай хамтардаг мэргэжлийн үнэлгээний компанид хандах шаардлагатай.</li>\n<li><strong>Зээлийн өргөдөл гарга</strong> — шаардлагатай бичиг баримтуудыг бүрэн дагалдуулан банкинд өгнө.</li>\n<li><strong>Банкны шийдлийг хүлээ</strong> — дунджаар 5–15 ажлын өдөр шаардагдана. Томоохон дүнд нь удаан болно.</li>\n<li><strong>Гэрээгээ нухацтай ун</strong> — гарын үсэг зурахаасаа өмнө хүү, хугацаа, эрт төлөлтийн нөхцөл, нэмэгдүүлсэн хүү зэрэг бүхнийг тодруул.</li>\n</ol>\n\n<h2>ЖДҮ сан — банкнаас хямд, хялбар сонголт</h2>\n<p>Засгийн газрын санхүүждэг <strong>Жижиг, Дунд Үйлдвэрийн Сан</strong> нь жилийн <strong>8–12%</strong> хүүтэй хөнгөлөлттэй зээл олгодог. Дунджаар 3–5 жилийн хугацаатай, 3–500 сая төгрөгийн санхүүжилт авах боломжтой. Барьцааны шаардлага харьцангуй зөөлөн бөгөөд хөдөлмөр эрхлэлт бий болгодог, дотоодын үйлдвэрлэлийг хөгжүүлдэг бизнесийг тэргүүлэн дэмждэг.</p>\n\n<h2>Зээл авахаас татгалзагдахад хамгийн нийтлэг шалтгаанууд</h2>\n<ul>\n<li>❌ Зээлийн муу түүх (хугацаа хэтэрсэн) — шийдэл: зээлийн лавлагаагаа урьдчилан шалга</li>\n<li>❌ Барьцаа хөрөнгийн дутагдал — шийдэл: Зээлийн батлан даалтын санд хандах</li>\n<li>❌ Орлогыг нотлох баримт байхгүй — шийдэл: нягтлан бодогчоор дамжуулан санхүүгийн тайлан хий</li>\n<li>❌ Бизнес төлөвлөгөө сул, тоо нотлогоогүй — шийдэл: мэргэжлийн загвар ашигла</li>\n<li>❌ Татварын өр — шийдэл: зээл авахын өмнө татварын өрөө барагдуул</li>\n</ul>\n\n<h2>Хүүний бодит тооцоолол — хэдэн төгрөг төлөх вэ?</h2>\n<p>Жишээ: <strong>50 сая ₮-ийн зээл, жилийн 18% хүү, 3 жилийн хугацаа</strong></p>\n<ul>\n<li>Сарын төлбөр (тэнцүү аннуитет): ~<strong>1,805,000 ₮</strong></li>\n<li>3 жилд нийт төлөх: ~<strong>65,000,000 ₮</strong></li>\n<li>Хүүнд гарах нийт зардал: ~<strong>15,000,000 ₮</strong></li>\n</ul>\n<p>Энгийн томьёо: Сарын хүүний зардал = (Зээлийн дүн × Жилийн хүү) ÷ 365 × 30</p>\n\n<h2>Дүгнэлт ба зөвлөмж</h2>\n<p>Монголын банкны зээлийн хүү харьцангуй өндөр хэвээр байгаа ч 2025–2026 онд зээлийн өсөлт хурдацтай. Бизнесийн зээл авах хамгийн чухал нөхцөл нь <strong>сайн бичигдсэн бизнес төлөвлөгөө</strong> юм. Санхүүгийн таамаглал, зах зээлийн судалгаа, эрсдэлийн дүн шинжилгээ бүхий стандарт бизнес төлөвлөгөө нь банкны менежерт таны бизнесийн ноцтой байдлыг харуулна.</p>\n<p>DigitalGer-ийн бэлэн бизнес төлөвлөгөөний загварууд нь Монголын банкуудын шаардлагад нийцсэн стандарт бүтэцтэй. Та зөвхөн өөрийн тоонуудыг оруулж, нэрийг солиход л болно — эхнээс бичих шаардлагагүй.</p>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/1b4fc533-3919-4523-a03a-ca2b3baac8dc.jpg	t	2025-06-10 00:00:00	{"банкны зээл","бизнес төлөвлөгөө",ЖДҮ,зөвлөмж}	DigitalGer баг	1	2026-05-21 23:47:28.346	2026-05-23 12:27:00.681
cmpifzs5y00077s5cvmaxl9qj	Facebook vs TikTok: Монгол бизнес-д аль платформ дээр ажиллах вэ?	facebook-vs-tiktok-mongolian-marketing	Монголд Facebook хэрэглэгч олон, TikTok хурдтай өсч байна. Бизнестэй хүнд аль нь илүү үр дүнтэй вэ? Судалгаа, тоо баримт, бодит жишээнд тулгуурласан харьцуулалт.	<h2>Монголын сошиал медиагийн ертөнц</h2>\n<p>2025 оны байдлаар Монголын интернет хэрэглэгчдийн тоо <strong>2.8 сая</strong>-д хүрсэн бөгөөд нийт хүн амын <strong>80% гаруй</strong> гар утсаар интернет ашигладаг. Монгол бизнесүүд дижитал маркетингт жил бүр илүү их хөрөнгө зарцуулж байна — гэхдээ аль платформд хэрэглэхэд хамгийн үр дүнтэй вэ?</p>\n\n<h2>Facebook — Монголын хамгийн том платформ</h2>\n<p>Facebook нь Монголд одоогоор хамгийн өргөн хэрэглэгддэг сошиал медиа хэвээр байна. Жижиг бизнесүүдийн <strong>83%</strong> Facebook ашигладаг бөгөөд олон монгол хэрэглэгч Facebook-ийг мэдээ, худалдаа, холбоо барихад голлон хэрэглэдэг.</p>\n\n<h3>Facebook-ийн давуу тал</h3>\n<ul>\n  <li><strong>Том хэрэглэгчийн бааз</strong> — 30–55 насны үзэгчид хамгийн их</li>\n  <li><strong>Facebook Marketplace</strong> — Монголд маш идэвхтэй худалдааны талбар</li>\n  <li><strong>Facebook Groups</strong> — Нийгэмлэг байгуулах, итгэлцэл бий болгоход сайн</li>\n  <li><strong>Нарийн таргетинг</strong> — Насны бүлэг, байршил, сонирхлоор оновчтой зар гаргах</li>\n  <li><strong>Мессежийн хэрэгсэл</strong> — Messenger-ээр шууд харилцаа хийх</li>\n</ul>\n\n<h3>Facebook-ийн сул тал</h3>\n<ul>\n  <li>Органик хүртээмж буурч байна — зар харуулахад илүү мөнгө шаарддаг болж байна</li>\n  <li>Залуу үеийн хэрэглэгчид TikTok руу шилжиж байна</li>\n  <li>Engagement rate буурсан: дундаж <strong>0.046%</strong> (маш бага)</li>\n</ul>\n\n<h2>TikTok — Хурдацтай өссөн шинэ хүч</h2>\n<p>TikTok Монголд 2020–2021 оноос эрчимтэй нэвтэрч, 2025 он гэхэд ялангуяа 16–35 насны хэрэглэгчдийн дунд Facebook-тай зэрэгцэж өрсөлддөг болсон. TikTok-ийн дундаж engagement rate <strong>1.73%</strong> — Facebook-ийн <strong>37 дахин</strong> өндөр.</p>\n\n<h3>TikTok-ийн давуу тал</h3>\n<ul>\n  <li><strong>Органик хүртээмж өндөр</strong> — Дагагчгүй ч видео вирал болж болно</li>\n  <li><strong>Залуу үзэгчид</strong> — 16–35 насны хэрэглэгчдэд хүрэхэд хамгийн сайн</li>\n  <li><strong>Худалдааны нөлөө их</strong> — Жижиг бизнесүүдийн 88% борлуулалт нэмэгдсэн гэж мэдэгдсэн</li>\n  <li><strong>TikTok Shop</strong> — Видео дотор шууд худалдаа хийх боломж</li>\n  <li><strong>Контент бодит, жинхэнэ</strong> — Хэт засмал биш, жинхэнэ агуулга илүү ажилладаг</li>\n</ul>\n\n<h3>TikTok-ийн сул тал</h3>\n<ul>\n  <li>Видео контент байнга гаргах хэрэгтэй — цаг их шаарддаг</li>\n  <li>35-аас дээш насны үзэгчдэд хүрэх хүртээмж бага</li>\n  <li>Ахмад, консерватив бизнесийн хэрэглэгчдэд тохиромжгүй байж болно</li>\n</ul>\n\n<h2>Харьцуулсан хүснэгт</h2>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:12px;">Үзүүлэлт</th>\n      <th style="padding:12px;text-align:center;">Facebook</th>\n      <th style="padding:12px;text-align:center;">TikTok</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Хэрэглэгчдийн нас</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">25–55+</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">16–35</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Engagement rate</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">0.046%</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;font-weight:bold;color:#27ae60;">1.73%</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Органик хүртээмж</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Буурсан</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;font-weight:bold;color:#27ae60;">Өндөр</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Контентийн төрөл</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Зураг, текст, видео</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Богино видео</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Зарын зардал</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Дунд</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Харьцангуй бага</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;">Жижиг бизнест тохирох</td>\n      <td style="padding:12px;text-align:center;">⭐⭐⭐⭐</td>\n      <td style="padding:12px;text-align:center;">⭐⭐⭐⭐⭐</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Ямар бизнест аль платформ тохирох вэ?</h2>\n\n<h3>Facebook сонгоорой хэрэв:</h3>\n<ul>\n  <li>Зорилтот үзэгчид 30–60 насны хүмүүс</li>\n  <li>Бүтээгдэхүүн/үйлчилгээний дэлгэрэнгүй тайлбар, мессежийн харилцаа чухал</li>\n  <li>Орон нутгийн нийгэмлэгт зарлал хийх</li>\n  <li>Байнгын харилцагчтай уламжлалт бизнес (автомашин, үл хөдлөх, гэр бүлийн үйлчилгээ)</li>\n</ul>\n\n<h3>TikTok сонгоорой хэрэв:</h3>\n<ul>\n  <li>Зорилтот үзэгчид залуу хүмүүс (18–35 нас)</li>\n  <li>Хувцас, гоо сайхан, хоол, тоглоом, технологи</li>\n  <li>Органик бүтээгдэхүүний промо, кейс study, хөгжилтэй агуулга</li>\n  <li>Брэнд таниулах шинэ компани</li>\n</ul>\n\n<h2>Шилдэг стратеги: Хоёуланг ашигла</h2>\n<p>Монголын дижитал маркетингийн мэргэжилтнүүдийн зөвлөгөөгөөр хамгийн үр дүнтэй стратеги нь <strong>хоёр платформыг нэгэн зэрэг ашиглах</strong> юм:</p>\n<ul>\n  <li><strong>TikTok</strong> — Шинэ үзэгчдэд хүрэх, брэнд таниулах, органик трафик</li>\n  <li><strong>Facebook</strong> — Харилцагч хадгалах, зар ажиллуулах, Messenger харилцаа</li>\n</ul>\n<p>Хэрэв зөвхөн нэгийг сонгох шаардлагатай бол: <strong>Зорилтот үзэгчидтэйгээ нас, платформ давхцуулж шийд.</strong></p>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/67590aac-06f7-47bf-ad70-d5a9bb675efd.jpg	t	2025-03-10 00:00:00	{маркетинг,Facebook,TikTok,"сошиал медиа",бизнес}	DigitalGer	14	2026-05-23 14:27:03.382	2026-05-23 14:55:37.341
cmpifzs7c00087s5c1qkmmo5m	Цалингаас бизнесмен болох — Ажилчнаас бизнес эрхлэгч болох 7 алхам	tsalingaas-biznes-boloh	Ажилдаа явж цалин авч байхдаа бизнес эхлүүлэх боломжтой юу? Тийм. Тогтмол цалингаас аажмаар бие даасан бизнест шилжих практик замнал, жишээ, алдаанаас сэргийлэх зөвлөгөө.	<h2>"Бизнес эхлүүлмээр байна, гэхдээ хаанаас?" гэдэг асуулт</h2>\n<p>Монголын хөдөлмөрийн зах зээлийн судалгаагаар ажиллагсдын <strong>64%</strong> нь ирээдүйд өөрийн бизнес эрхлэхийг хүсдэг. Гэхдээ ихэнх нь хэзээ нэгэн цагт л эхэлнэ гэж хүлээсэн хэвээр байдаг. Яагаад? Учир нь:</p>\n<ul>\n  <li>Тогтмол цалингаа алдахаас айдаг</li>\n  <li>Хаанаас эхлэхээ мэдэхгүй</li>\n  <li>Хангалттай хөрөнгөгүй гэж боддог</li>\n  <li>Цаг байхгүй гэж боддог</li>\n</ul>\n<p>Гэвч бодит байдалд <strong>цалинтайгаа зэрэгцэн бизнес эхлүүлэх</strong> нь хамгийн найдвартай арга юм. Дэлхийн амжилттай бизнес эрхлэгчдийн олонх нь тогтмол ажилтайгаа зэрэгцэн бизнесээ аажмаар өсгөсөн байдаг.</p>\n\n<h2>Яагаад ажилтайгаа зэрэгцэн эхлэх нь дээр вэ?</h2>\n<ul>\n  <li><strong>Санхүүгийн аюулгүй байдал</strong> — Цалин байгаа тул бизнес орлогогүй байсан ч гэр бүлийн зарлагаа хаана</li>\n  <li><strong>Туршиж үзэх боломж</strong> — Санаагаа бодит зах зээлд туршиж, алдаагаа засах цаг байна</li>\n  <li><strong>Хурдан ороход болно</strong> — Аль хэдийн хэрэглэгчтэй, орлоготой болсны дараа л ажлаасаа гарна</li>\n</ul>\n\n<h2>7 алхам: Цалинтаас бизнест шилжих замнал</h2>\n\n<h3>Алхам 1: Бизнесийн санааг сонго (1–2 долоо хоног)</h3>\n<p>Хамгийн сайн бизнесийн санаа нь таны <strong>одоогийн чадвар + зах зээлийн хэрэгцээ</strong>-ний огтлолцол дээр байдаг.</p>\n<ul>\n  <li>Би юунд сайн вэ? (дизайн, барилга, нягтлан, орчуулга гэх мэт)</li>\n  <li>Миний мэддэг зүйлийг хэн хэрэгтэй вэ?</li>\n  <li>Зах зээлд ямар асуудлыг шийдвэрлэж болох вэ?</li>\n</ul>\n\n<h3>Алхам 2: Хажуугийн ажлаар эхлэ (1–3 сар)</h3>\n<p>Ажил дараа, амралтын өдрүүдэд бизнесийн санаагаа туршиж үзнэ. Зорилго: анхны 1–3 харилцагч олж, жижиг орлого авах.</p>\n<p><strong>Жишээ:</strong> Дизайнер байвал Upwork эсвэл нутгийн компаниудад фриланс ажил хий → анхны орлого ав → туршлага хурим.</p>\n\n<h3>Алхам 3: Санхүүгийн яаралтай санг бүрдүүл</h3>\n<p>Ажлаасаа гарахаасаа өмнө <strong>6 сарын зарлагатай тэнцэх хуримтлал</strong> байх хэрэгтэй. Монголын дундаж гэр бүлийн сарын зарлага 1.5–2.5 сая ₮ бол:</p>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:10px;">Хадгалах хугацаа</th>\n      <th style="padding:10px;text-align:right;">Шаардлагатай хуримтлал</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">3 сар (хамгийн бага)</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">4.5–7.5 сая ₮</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">6 сар (зөвлөмж)</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">9–15 сая ₮</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;">12 сар (тогтвортой)</td>\n      <td style="padding:10px;text-align:right;">18–30 сая ₮</td>\n    </tr>\n  </tbody>\n</table>\n\n<h3>Алхам 4: Анхны харилцагч олох</h3>\n<p>Эхний харилцагч нь ихэвчлэн таны дотно хүрээлэлд байдаг — найз, хамаатан, хуучин хамтран зүтгэгч. Харамзалгүй хандаж, туслалцааг эрэлхийл.</p>\n\n<h3>Алхам 5: Тогтмол орлогын босгыг тогтоо</h3>\n<p>Ажлаасаа гарах нөхцөл — бизнесийн орлого нь одоогийн цалингийн <strong>дор хаяж 70–80%</strong>-д хүрсэн байх. Энэ нь шилжилтийг аюулгүй болгоно.</p>\n\n<h3>Алхам 6: Ажлаасаа гарах</h3>\n<p>Нөхцөл биелсний дараа хүндэтгэлтэйгээр, ажил олгогчдоо талархлаа илэрхийлэн гарна. "Хамтрагч байж болно" гэсэн сайн харилцааг хадгалах нь ирээдүйд тус болно.</p>\n\n<h3>Алхам 7: Бизнесийг цөм руу ажиллуул</h3>\n<p>Бүрэн цагийн эрхлэгч болсны дараа:</p>\n<ul>\n  <li>Нийгмийн даатгалаа хувиараа төл (Сайн дурын НД)</li>\n  <li>Эрүүл мэндийн даатгалд хамрагд</li>\n  <li>Татварын бүртгэл хий</li>\n  <li>Санхүүгийн тооцооны систем бий болго</li>\n</ul>\n\n<h2>Хамгийн нийтлэг алдаанууд</h2>\n<ul>\n  <li><strong>Хэт эрт гарах</strong> — Орлого баттай болохоос өмнө ажлаасаа гарах</li>\n  <li><strong>Хуримтлалгүй</strong> — Эхний жилд орлого тогтворгүй байдаг, нөөцгүй бол сандарна</li>\n  <li><strong>Ганцаараа бүхнийг хийх</strong> — Чадахгүй зүйлдээ хэн нэгнийг авах эсвэл аутсорсинг хий</li>\n  <li><strong>Татвар, бүртгэлийг орхих</strong> — Эхнээсээ зөв хийхгүй бол дараа хоёр дахин хэцүү</li>\n</ul>\n\n<blockquote style="border-left:4px solid #1a3c8f;padding:15px 20px;background:#f0f4ff;margin:20px 0;">\n  <strong>Санаж байх зүйл:</strong> Монгол Улсад 2025 оны байдлаар идэвхтэй ажиллаж байгаа аж ахуйн нэгжийн тоо жилд дунджаар 15,000-аар нэмэгдсэн. Та эхлэх хамгийн сайн цаг бол <em>одоо</em> юм.\n</blockquote>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/96a7c243-7ad3-4884-a674-0be1d6f9d348.jpg	t	2025-03-17 00:00:00	{бизнес,эрхлэгч,цалин,эхлэл,карьер}	DigitalGer	15	2026-05-23 14:27:03.432	2026-05-23 14:56:36.724
cmpifzs7i00097s5cv5yb1f3i	Жижиг бизнесийн 7 нийтлэг алдаа — Монгол бизнес эрхлэгчдийн туршлагаас	jijig-biznesiin-7-aldaa	Монголд бүртгэлтэй аж ахуйн нэгжийн 58.9% нь идэвхгүй болсон. Амжилтгүй болох хамгийн нийтлэг 7 шалтгааныг таниулж, та ижил алдаанд унахаас сэргийлнэ.	<h2>Монголын бизнесийн хэцүү бодит байдал</h2><p>2025 оны мэдээллээр Монгол Улсад бүртгэлтэй нийт аж ахуйн нэгжийн <strong>58.9%</strong> нь идэвхгүй болсон байна. 2016 онтой харьцуулахад идэвхгүй компанийн тоо <strong>2.4 дахин</strong> өссөн. Дэлхийн судалгаагаар стартапуудын <strong>90%</strong> эхний 5 жилдээ хаагддаг.</p><p>Энэ нь бизнес эхлэхэд хэцүү гэсэн үг биш — зөрчилтэй алдаанаас сурч, урьдчилан сэргийлэх боломжтой гэсэн үг юм.</p><h2>Алдаа 1: Зах зээлийн судалгаагүйгээр эхлэх</h2><p>Монгол эрхлэгчдийн хамгийн нийтлэг алдаа нь <strong>"Би энэ бүтээгдэхүүнийг дуртай учир хамаг хүн авна"</strong> гэж бодох явдал юм. Дэлхийн стартап судалгаагаар бизнес амжилтгүй болох <strong>1-р шалтгаан</strong> нь "зах зээлийн хэрэгцээ байхгүй байсан" (42%) юм.</p><p><strong>Шийдэл:</strong> Бизнес эхлэхийн өмнө дор хаяж 50–100 боломжит харилцагчтай ярилц. Тэд таны бүтээгдэхүүнд мөнгөө төлөхөд бэлэн үү? Хэдийд нь, ямар нөхцөлд?</p><h2>Алдаа 2: Мөнгийн урсгалыг (cash flow) буруу тооцох</h2><p>Ашиг гарч байгаа ч компани мөнгөгүй болж хааж болно — cash flow буруу тооцсоноос. Монгол жижиг бизнесүүдийн <strong>29%</strong> мөнгөний урсгалын асуудлаас хаагддаг.</p><p><strong>Жишээ:</strong> Та бараагаа зарсан, харилцагч 30 хоногийн дараа төлнө гэж тохирсон. Гэвч чиний нийлүүлэгч 7 хоногт мөнгө авхыг шаарддаг. 23 хоногийн зөрүүд мөнгөний хомсдол үүсдэг.</p><p><strong>Шийдэл:</strong> Сар бүрийн орлого болон зарлагын урсгалыг тооцоол. Орлого орж ирэх хугацааг нийлүүлэгчийн төлбөрийн хугацаатай тааруул.</p><h2>Алдаа 3: Үнэ хэтэрхий бага тогтоох</h2><p>"Хямд байвал харилцагч олноо ирнэ" гэж бодож үнэ бага тогтоодог. Гэвч бодит байдалд хямд үнэ нь:</p><ul><li><p>Мэргэжлийн бус, итгэлгүй харагдуулдаг</p></li><li><p>Ашгийн маржинг дарж, хөгжих боломжийг хасдаг</p></li><li><p>Маркетинг, үйлчилгээ сайжруулах хөрөнгөгүй болгодог</p></li></ul><p><strong>Шийдэл:</strong> Бүтээгдэхүүний <strong>бодит зардал</strong> (материал + цаг + бусад) зөв тооцоол. Дараа нь зах зээлийн дундаж үнийг судалж, өөрийн давуу талаасаа ногдуулж үнэ тогтоо.</p><h2>Алдаа 4: Маркетингт хөрөнгө зарцуулахгүй байх</h2><p>"Сайн бүтээгдэхүүн бол өөрөө зарагдана" гэж боддог. Гэвч орчин үеийн зах зээлд харагдахгүй бол байхгүйтэй адил. Монголын жижиг бизнесүүд маркетингт орлогынхоо дунджаар <strong>3–5%</strong> зарцуулдаг бол амжилттай компаниуд <strong>10–20%</strong> зарцуулдаг.</p><p><strong>Шийдэл:</strong></p><ul><li><p>Сошиал медиад тогтмол, үнэ цэнэтэй контент гарга</p></li><li><p>Google Maps, Facebook Page-ээ бүртгэж, хэрэглэгчдийн сэтгэгдэл цуглуул</p></li><li><p>Орлогынхоо дор хаяж 5–8%-ийг маркетингд зарцуул</p></li></ul><h2>Алдаа 5: Бүхнийг ганцаараа хийх</h2><p>Монгол эрхлэгч нийтлэгээр захирал + нягтлан + маркетер + борлуулагч + жолооч нэгэн зэрэг байхыг оролддог. Энэ нь ажлын чанарыг бууруулж, эрхлэгчийг шатаадаг.</p><p>Ажлын төрөл Зөвлөмж Нягтлан, татвар Хагас цагийн нягтлан авь (100–200K/сар) Дизайн Canva, Fiverr-аас фриланс хий Хуулийн асуудал Хуульчтай зөвлөлдөх (зарим нь үнэгүй консультаци өгдөг) Интернет маркетинг Залуу маркетинг менежер авах эсвэл ChatGPT ашигла</p><h2>Алдаа 6: Харилцагчдаасаа сэтгэгдэл (feedback) авахгүй байх</h2><p>Таны бизнесийн хамгийн чухал мэдлэгийн эх сурвалж бол харилцагчид. Гэвч олон эрхлэгч шүүмжлэл дуулахаас айж, сэтгэгдэл авдаггүй.</p><p><strong>Шийдэл:</strong> Борлуулалт хийсний дараа "Та манай бүтээгдэхүүн/үйлчилгээнд сэтгэл хангалуун байсан уу? Юуг сайжруулах вэ?" гэж асуу. 10 харилцагчийн 7 нь хариулна — энэ мэдээлэл мөнгөнд хэмжэгдэхгүй үнэтэй.</p><h2>Алдаа 7: Дижитал эрэмбэгүй, онлайнд харагдахгүй байх</h2><p>2025 онд Монгол хэрэглэгчид бараа, үйлчилгээ хайхдаа эхлээд Facebook, Google, TikTok харанa. Хэрэв тантай холбогдох хуудасгүй, утасгүй, мэдээлэлгүй бол харилцагч өрсөлдөгч рүү явна.</p><p><strong>Хамгийн багадаа хийх ёстой зүйл:</strong></p><ul><li><p>Facebook Business Page нээ — үнэгүй</p></li><li><p>Google Maps-д бизнесээ бүртгэ — үнэгүй</p></li><li><p>Утасны дугаар, ажлын цаг, хаяг тодорхой бич</p></li><li><p>Сард дор хаяж 2–4 удаа пост гарга</p></li></ul><h2>Дүгнэлт: Алдааг бус амжилтыг хуулбарла</h2><p>Монголд бизнесийн орчин хэцүү ч бодит жишээнүүд байдаг — жижиг гарааснаас том болсон компаниуд. Тэдний нийтлэг онцлог нь: зах зээлийг сайн судалсан, мөнгийн урсгалаа хянасан, маркетингт тогтмол хөрөнгө оруулсан, харилцагчдаа сонссон явдал юм. Дээрх 7 алдаанаас сэргийлснээр таны бизнесийн амьд үлдэх магадлал эрс нэмэгдэнэ.</p><blockquote><p><strong>Санамж:</strong> Амжилттай бизнес эрхлэгчид алдаа гаргадаггүй биш — алдаанаасаа хурдан сурч, зохицдог хүмүүс юм.</p></blockquote><p></p>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/2482a207-e7c9-4aa7-8836-a680b2f57150.jpg	t	2025-03-24 00:00:00	{бизнес,алдаа,"жижиг бизнес",зөвлөгөө,эрхлэгч}	DigitalGer	16	2026-05-23 14:27:03.439	2026-05-23 14:57:06.78
cmpg54sap00057s0orya7jkoh	Бизнес төлөвлөгөө хэрхэн бичих вэ — банкинд батлуулах 8 хэсэг	biznes-tolvlogoo-bichih-guide	Банкинд батлагдах бизнес төлөвлөгөөд ямар 8 хэсэг заавал орох ёстой вэ? Хамгийн нийтлэг алдаанаас хэрхэн зайлсхийх вэ? Жишээ бүхий тайлбар.	<h2>Яагаад бизнес төлөвлөгөө гэдэг зүйл банкинд маш чухал вэ?</h2>\n\n<p>Монголын банкуудаас жижиг, дунд бизнест олгосон зээлийн <strong>дунджаар 65–75% нь буцаан авахад хүндрэлтэй байдаг</strong> гэж Монголбанкны судалгаа харуулдаг. Энэ нь банкны зээлийн мэргэжилтнүүдийг зээлдэгчийг маш нарийн шалгаж дэлгэрэнгүй бизнес төлөвлөгөөг шаардах үндэс болдог.</p>\n\n<p>Монголд <strong>зээл авахад хамгийн нийтлэг татгалзах шалтгаан</strong> нь барьцааны дутагдал биш — харин <strong>бизнес төлөвлөгөөний чанар муу байх</strong> юм. Хаан банк, Голомт банк, ХасБанк зэрэг томоохон банкуудын зээлийн мэргэжилтнүүдтэй хийсэн ярилцлагад <em>"бодитой биш санхүүгийн таамаглал"</em> ба <em>"зах зээлийн шинжилгээ байхгүй"</em> гэсэн 2 шалтгаан тогтмол давтагддаг.</p>\n\n<blockquote style="border-left:4px solid #3b82f6;padding:12px 16px;background:#eff6ff;margin:16px 0;">\n<strong>📊 Мэдэх хэрэгтэй тоо баримт:</strong> Монголд ажилладаг 14 банкны нийт зээлийн багц 2025 онд <strong>33.1 их наяд ₮</strong> давсан. Жижиг дунд үйлдвэрийн зээлийн өрсөлдөөн нэмэгдэж, батлагдах нь зогсоогүй харин батлагдах стандарт улам өндөр болж байна. Сайн бизнес төлөвлөгөөтэй зээлдэгч <strong>35–45 хоног</strong>-т зээл авдаг бол муу төлөвлөгөөтэй нь <strong>3–6 сар</strong> хүлээж, эцэстээ татгалзуулдаг.\n</blockquote>\n\n<h2>Монголын банкны шаардлагад нийцсэн 8 хэсгийн бүтэц</h2>\n\n<p>Дараах бүтэц нь Монголын ихэнх банкны дотоод шаардлагад нийцсэн, зээлийн мэргэжилтнүүд хамгийн хурдан боловсруулдаг стандарт загвар юм. <strong>Нэг ч хэсгийг орхивол батлагдах хугацаа уртасна</strong> — зарим банк бүрдүүлэлтийг буцааж залруулахыг хүсдэг тул нэмэлт 2–4 долоо хоног алддаг.</p>\n\n<h3>1-р хэсэг: Товч тоймлол (Executive Summary) — 1–2 хуудас</h3>\n\n<p>Банкны зээлийн мэргэжилтэн эхлэж энэ хэсгийг уншаад <em>"үргэлжлүүлэн уншмаар байна уу, үгүй юу?"</em> гэж шийддэг. Тиймээс энэ 1–2 хуудас нь таны <strong>анхны сэтгэгдэл</strong> юм.</p>\n\n<p><strong>Заавал орох мэдээлэл:</strong></p>\n<ul>\n<li>🏢 Бизнесийн нэр, бүртгэлийн хаяг, улсын бүртгэлийн дугаар</li>\n<li>💰 Хэдий хэмжээний зээл хүсэж байна вэ? (тодорхой дүнг бичнэ — "ойролцоогоор" гэдэг хүлцэгдэхгүй)</li>\n<li>🎯 Зээлийг юунд ашиглах вэ? (тоног төхөөрөмж, эргэлтийн хөрөнгө, байр — задлан бичнэ)</li>\n<li>📅 Зээлийн хугацаа хэд байна вэ? Сард хэдийг нөхөн олгох вэ?</li>\n<li>💼 Барьцаанд юу тавих вэ? (дүн, нэр төрлийг тодорхой бичнэ)</li>\n<li>📈 3 жилийн дараа бизнес ямар байна гэж таамаглаж байна вэ? (орлого, ашгийн тоо)</li>\n</ul>\n\n<p><strong>Жишээ (хүлэмжийн аж ахуйн зээлийн өргөдөл):</strong></p>\n<blockquote style="border-left:4px solid #10b981;padding:12px 16px;background:#f0fdf4;margin:16px 0;font-style:italic;">\n"Дархан-Уул аймгийн Дархан сумд 500 м² дулааны хүлэмж байгуулах зорилгоор 45 сая төгрөгийн 3 жилийн хугацаатай зээл хүсэж байна. Зээлийг хүлэмжийн хийц (28 сая ₮), халаалтын систем (12 сая ₮), суурилуулалт (5 сая ₮)-д зарцуулна. Барьцаа: Дархан дүүрэгт 60 м² орон сууцны үл хөдлөх хөрөнгө (үнэлгээний дүн 75 сая ₮). Эхний жилийн орлогын таамаглал: 48 сая ₮. Зээлийн сарын нөхөн олгох хэмжээ: 1,650,000 ₮."\n</blockquote>\n\n<h3>2-р хэсэг: Компанийн танилцуулга — 1–2 хуудас</h3>\n\n<p>Банк та хэн болохыг мэдэхийг хүсдэг. Шинэ бизнес бол бүр ч дэлгэрэнгүй бичих хэрэгтэй — учир нь тань дээр зээлийн түүх байхгүй тул <strong>хүний хүчин зүйл (personal factor)</strong> маш чухал болдог.</p>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Орох мэдээлэл</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Яагаад чухал вэ?</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Байгуулагдсан огноо, улсын бүртгэл</td><td style="padding:10px;border:1px solid #e5e7eb;">Хуулийн зэрэглэл, бүртгэлийн дугаар шалгана</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Үндсэн үйл ажиллагааны чиглэл</td><td style="padding:10px;border:1px solid #e5e7eb;">НӨАТУС-ийн ангиллаас тодорхойлно</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Эзний ажлын туршлага, боловсрол</td><td style="padding:10px;border:1px solid #e5e7eb;">Салбарт туршлагагүй бол эрсдэл өндөр гэж тооцно</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Одоогийн ажилтны тоо, цалингийн санг</td><td style="padding:10px;border:1px solid #e5e7eb;">Нийгмийн даатгалын төлбөрийн баталгаа болно</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Өмнөх зээлийн түүх (хэрэв байвал)</td><td style="padding:10px;border:1px solid #e5e7eb;">Зээлийн эерэг түүх — хамгийн том давуу тал</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Гэр бүлийн нийт орлого (жижиг бизнес бол)</td><td style="padding:10px;border:1px solid #e5e7eb;">Нөхөн олгох чадварын нэмэлт баталгаа болно</td></tr>\n</tbody>\n</table>\n\n<p>💡 <strong>Зөвлөгөө:</strong> Өмнө нь ажилласан газар, олж авсан мэргэжлийн гэрчилгээ, тусгай зөвшөөрлийг бүгдийг хавсарга. Салбарт 5+ жил ажилласан бол зайлшгүй тэмдэглэ — банкны мэргэжилтэн туршлагагүй анхан шатны хүнд зээл олгохоос эмээдэг.</p>\n\n<h3>3-р хэсэг: Бүтээгдэхүүн/Үйлчилгээний тайлбар — 2–3 хуудас</h3>\n\n<p>Энэ хэсэгт <strong>"юу зарах вэ"</strong>-ийн тайлбараас гадна <strong>"хэрхэн зарах вэ, яаж үйлдвэрлэх вэ"</strong>-ийг тодруулна. Банк техник шинжилгээ хийдэг биш — тиймээс хэт техникийн биш, энгийн ойлгомжтой хэлээр бичнэ.</p>\n\n<ul>\n<li>📦 <strong>Бүтээгдэхүүн/үйлчилгээний нэршил</strong> — нэр, тоо хэмжээ, нэгжийн үнэ</li>\n<li>⚙️ <strong>Үйлдвэрлэлийн/үйлчилгээний процесс</strong> — хэдэн шат, хэн хариуцдаг</li>\n<li>🏆 <strong>Өрсөлдөгчдөөс ялгарах онцлог</strong> — үнэ? чанар? байршил? хурд?</li>\n<li>📜 <strong>Шаардлагатай тусгай зөвшөөрөл</strong> — хүнсний аюулгүй байдал, гаалийн, байгаль орчны гэх мэт</li>\n<li>🔄 <strong>Нийлүүлэлтийн гинжин хэлхээ</strong> — түүхий эдийг хаанаас авах, хэнд зарах</li>\n</ul>\n\n<h3>4-р хэсэг: Зах зээлийн шинжилгээ — 3–5 хуудас ⚡</h3>\n\n<p>Монголын банкуудын зээлийн хороондоо хамгийн удаан ярилцдаг хэсэг нь <strong>зах зээлийн шинжилгээ</strong>. Учир нь энэ хэсэг нь бизнесийн орлогын найдвартай байдлыг баталгаажуулдаг.</p>\n\n<p><strong>"Зах зээл их том" гэдэг хангалтгүй. Тоо хэрэгтэй.</strong></p>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Асуулт</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Хэрхэн хариулах вэ</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Мэдээллийн эх сурвалж</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Нийт зах зээлийн хэмжээ хэд вэ?</td><td style="padding:10px;border:1px solid #e5e7eb;">Жилийн нийт борлуулалтын дүн (₮ эсвэл тоо хэмжээ)</td><td style="padding:10px;border:1px solid #e5e7eb;">ҮСХ, Монголбанк, салбарын холбоо</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Зах зээл өсч байна уу?</td><td style="padding:10px;border:1px solid #e5e7eb;">Өнгөрсөн 3–5 жилийн өсөлтийн хувь</td><td style="padding:10px;border:1px solid #e5e7eb;">ҮСХ-ийн он дамнасан тайлан</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Зорилтот хэрэглэгч хэн бэ?</td><td style="padding:10px;border:1px solid #e5e7eb;">Нас, орлого, байршил, хэрэгцээ</td><td style="padding:10px;border:1px solid #e5e7eb;">Судалгаа, ажиглалт, интернет</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Өрсөлдөгчид хэн бэ?</td><td style="padding:10px;border:1px solid #e5e7eb;">3–5 гол өрсөлдөгчийн нэр, давуу болон сул тал</td><td style="padding:10px;border:1px solid #e5e7eb;">Шууд ажиглалт, интернет судалгаа</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Таны зах зээлийн хувь хэд болох вэ?</td><td style="padding:10px;border:1px solid #e5e7eb;">Бодитой, дорвитой тоо — 1%, 5%? (хэт өндөр бол итгэхгүй)</td><td style="padding:10px;border:1px solid #e5e7eb;">Өөрийн борлуулалтын таамаглал</td></tr>\n</tbody>\n</table>\n\n<p>💡 <strong>Зөвлөгөө:</strong> Монголын Үндэсний Статистикийн Хороо (1212.mn), Гаалийн ерөнхий газар, Монголын Үйлдвэрчний эвлэлийн холбоо зэрэг байгууллагын нийтэд нээлттэй тайлангуудыг ашиглаарай. Аль нэг захиалагч, дэлгүүртэй урьдчилсан хэлцэл, захидал байвал заавал хавсарга.</p>\n\n<h3>5-р хэсэг: Маркетингийн стратеги — 2–3 хуудас</h3>\n\n<p>Банк маркетингийн мэргэжилтэн биш — тиймээс гоёмсог маркетингийн онол бичих шаардлагагүй. Харин <strong>"хэрэглэгчдийг хэрхэн олж авах вэ, зардал хэд болох вэ"</strong>-ийг ойлгомжтой бичихэд хангалттай.</p>\n\n<ul>\n<li>💲 <strong>Үнийн стратеги</strong> — өрсөлдөгчдөөс хямд уу, бодит зах зээлийн үнэтэй харьцуулна</li>\n<li>📢 <strong>Сурталчилгааны суваг</strong> — Facebook, Instagram, дэлгүүр, өрхийн сурталчилгаа гэх мэт</li>\n<li>🤝 <strong>Борлуулалтын суваг</strong> — шууд борлуулалт, дистрибьютер, онлайн дэлгүүр</li>\n<li>💸 <strong>Маркетингийн жилийн төсөв</strong> — тодорхой дүнтэй байх</li>\n</ul>\n\n<h3>6-р хэсэг: Үйл ажиллагааны төлөвлөгөө — 2–3 хуудас</h3>\n\n<p>Энэ хэсэг нь бизнесийг өдөр тутмын ажиллагааны талаас харуулдаг. Банкны мэргэжилтнүүд <em>"яг хэзээнээс, яаж ажиллана вэ?"</em> гэдгийг мэдэхийг хүсдэг.</p>\n\n<ul>\n<li>📍 <strong>Байршил, талбай</strong> — эзэмшлийн гэрчилгээ эсвэл түрээсийн гэрээний хуулбар хавсарга</li>\n<li>🏭 <strong>Тоног төхөөрөмжийн жагсаалт</strong> — нэр, тоо, нэгжийн үнэ, нийлүүлэгчийн нэр</li>\n<li>👥 <strong>Ажилтны бүтэц</strong> — хэд хэдэн хүн, ямар мэргэжил, хэдийн цалин</li>\n<li>📅 <strong>Хэрэгжилтийн хуваарь</strong> — зээл авснаас хойш хэдэн сарт бэлэн болох вэ?</li>\n<li>🔧 <strong>Гол нийлүүлэгчид</strong> — нэр, байршил, урьдчилсан үнийн санал</li>\n</ul>\n\n<h3>7-р хэсэг: Санхүүгийн таамаглал — 5–10 хуудас 🔴 ХАМГИЙН ЧУХАЛ</h3>\n\n<p>Банкны шийдвэрлэлтийн <strong>70%-ийг энэ хэсэг тодорхойлдог</strong>. Нэг ч хадгалагдаагүй ч санхүүгийн таамаглал нь зах зээлийн бодит нөхцөл, өрсөлдөгчдийн үнэ, таны зардлын тооцоолол дээр суурилсан байх ёстой.</p>\n\n<p><strong>Заавал орох 5 баримт бичиг:</strong></p>\n\n<p><strong>① Орлого, зардлын тооцоолол (3–5 жил)</strong></p>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:8px;border:1px solid #e5e7eb;">Үзүүлэлт</th>\n<th style="padding:8px;border:1px solid #e5e7eb;">1-р жил</th>\n<th style="padding:8px;border:1px solid #e5e7eb;">2-р жил</th>\n<th style="padding:8px;border:1px solid #e5e7eb;">3-р жил</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Нийт орлого</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">+15–25% өсч</td><td style="padding:8px;border:1px solid #e5e7eb;">+15–25% өсч</td></tr>\n<tr><td style="padding:8px;border:1px solid #e5e7eb;">Бүтээгдэхүүн/үйлчилгээний зардал</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td></tr>\n<tr><td style="padding:8px;border:1px solid #e5e7eb;">Ажилтны цалин</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td></tr>\n<tr><td style="padding:8px;border:1px solid #e5e7eb;">Зээлийн хүүгийн зардал</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td></tr>\n<tr><td style="padding:8px;border:1px solid #e5e7eb;">Бусад үйл ажиллагааны зардал</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td></tr>\n<tr style="font-weight:700;background:#fef3c7;"><td style="padding:8px;border:1px solid #e5e7eb;">Цэвэр ашиг</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td><td style="padding:8px;border:1px solid #e5e7eb;">XX сая ₮</td></tr>\n</tbody>\n</table>\n\n<p>⚠️ <strong>Анхаар:</strong> Зээлийн хүүгийн зардлыг зарлагын баганад орхивол банк анзааргүй биш — зориудаар нуусан гэж үздэг. Бүх зардлаа нийтлүүл.</p>\n\n<p><strong>② Мөнгөн урсгалын тооцоолол (Cash Flow) — сар бүрийн</strong></p>\n\n<p>Сар бүрийн мөнгөн урсгал нь зээлийн нөхөн олголтын чадварыг хамгийн шууд харуулна. Орлого орох сар, зардал их гарах сар тодорхой бичнэ. Улирлын бизнес (ургамал тариалалт, аялал жуулчлал г.м.) бол өвлийн сарын хямралыг хэрхэн давах вэ гэдгийг тайлбарла.</p>\n\n<p><strong>③ Нөхөн олгох хугацааны тооцоолол (Payback Period)</strong></p>\n\n<blockquote style="border-left:4px solid #f59e0b;padding:12px 16px;background:#fffbeb;margin:16px 0;">\n<strong>Жишээ тооцоолол:</strong><br/>\nНийт хөрөнгийн хэмжээ: 80 сая ₮ (өөрийн хөрөнгө 20 + зээл 60 сая ₮)<br/>\nЖилийн цэвэр ашиг: 35 сая ₮<br/>\nНөхөн олгох хугацаа: 80 ÷ 35 = <strong>2.3 жил</strong> (банкны дотоод шаардлага ихэвчлэн 5 жилд багтаана)\n</blockquote>\n\n<p><strong>④ Дотоодын өгөөжийн хувь (IRR) ба Цэвэр өнөөгийн үнэ цэнэ (NPV)</strong></p>\n<p>ЖДҮ болон ХАА-н том зээлд (50 сая ₮-оос дээш) эдгээр хоёр үзүүлэлтийг шаарддаг болж байна. Excel загварт автоматаар тооцоолдог функц байдаг — DigitalGer-ийн бизнес төлөвлөгөөний загварт бэлэн томьёо нь орсон байгаа.</p>\n\n<p><strong>⑤ Тэнцвэрийн цэг (Break-even Point)</strong></p>\n<p>Ямар хэмжээний борлуулалтад алдагдалгүй болох вэ? = Тогтмол зардал ÷ (Нэгжийн үнэ − Нэгжийн хувьсагч зардал). Энэ тоог мэдэж байвал банкинд итгэл төрүүлдэг.</p>\n\n<h3>8-р хэсэг: Эрсдэлийн дүн шинжилгээ — 2–3 хуудас</h3>\n\n<p>Олон бизнес эрхлэгчид <em>"банк эрсдэлийг харвал татгалзана"</em> гэж бодоод энэ хэсгийг бичдэггүй — энэ нь том алдаа. <strong>Эрсдэлийг тодорхойлж, шийдлийг нь бичсэн бизнес эрхлэгч нь улам итгэлтэй харагдана.</strong></p>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Эрсдэлийн төрөл</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Жишээ</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Даван туулах арга</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Зах зээлийн эрсдэл</td><td style="padding:10px;border:1px solid #e5e7eb;">Борлуулалт таамаглалаас 30% буурвал</td><td style="padding:10px;border:1px solid #e5e7eb;">Нөөц санхүүжилт, зардлын тааруулалт</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Үнийн эрсдэл</td><td style="padding:10px;border:1px solid #e5e7eb;">Түүхий эдийн үнэ 20% өсвөл</td><td style="padding:10px;border:1px solid #e5e7eb;">Нийлүүлэгчтэй тогтмол үнийн гэрээ</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Үйл ажиллагааны эрсдэл</td><td style="padding:10px;border:1px solid #e5e7eb;">Гол ажилтан гарвал</td><td style="padding:10px;border:1px solid #e5e7eb;">Нэмэлт ажилтан сургах төлөвлөгөө</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Валютын эрсдэл</td><td style="padding:10px;border:1px solid #e5e7eb;">Импортын тоног төхөөрөмж бол</td><td style="padding:10px;border:1px solid #e5e7eb;">Форвард гэрээ эсвэл нөөц хөрөнгө</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Байгалийн эрсдэл (ХАА бол)</td><td style="padding:10px;border:1px solid #e5e7eb;">Ган, зуд, өвчин</td><td style="padding:10px;border:1px solid #e5e7eb;">Даатгал, олон талт үйлдвэрлэл</td></tr>\n</tbody>\n</table>\n\n<h2>Хамгийн нийтлэг 8 алдаа — жинхэнэ жишээтэй</h2>\n\n<h3>❌ 1. Санхүүгийн таамаглал хэт өөдрөг</h3>\n<p>Эхний жилдээ 500 сая ₮ орлого олно гэж бичсэн жижиг нарийн боов хийдэг бизнес — банкны мэргэжилтэн тэр мөчид уртаас нь шидэнэ. <strong>Бодитой байх нь хэт даруухан байхаас дээр.</strong> "Хамгийн сайн тохиолдол", "дундаж тохиолдол", "хамгийн муу тохиолдол" гэсэн 3 хувилбар бичих нь мэргэжлийн байдлыг харуулдаг.</p>\n\n<h3>❌ 2. Зах зээлийн шинжилгээнд "их эрэлттэй" гэж л бичих</h3>\n<p>Тоо байхгүй бол таамаглал гэж тооцно. "Монголд хүнсний ногооны зах зээл жилд 150 тэрбум ₮ байдаг, дотоодын нийлүүлэлт 60% хангадаг" гэж тодорхой бичсэн нь хамаагүй дээр.</p>\n\n<h3>❌ 3. Зээлийн хүүгийн зардлыг тооцооллоос орхих</h3>\n<p>Жилийн 18%-ийн хүүтэй 50 сая ₮ зээл авбал жилд 9 сая ₮ зардал гарна. Энэ тоог орлого-зарлагын тооцооллоосоо хасаагүй бол цаасан дээр ашигтай боловч бодит байдалд алдагдалтай болох аюул бий.</p>\n\n<h3>❌ 4. Барьцааны үнэлгээг хэт өндөр тохируулах</h3>\n<p>Банкны үнэлгээч таны орон сууцыг зах зээлийн үнийн 60–70%-д үнэлнэ (LTV). Та "90 сая ₮-ийн орон сууц байна" гэж бодоход банк "63 сая ₮" гэж тооцоолдог. Барьцааны дутагдал зээл татгалзах шалтгаан болдог тул урьдчилан мэдэж тооцоол.</p>\n\n<h3>❌ 5. Өрсөлдөгч байхгүй гэж бичих</h3>\n<p>"Манай бүтээгдэхүүн Монголд анхных, өрсөлдөгч байхгүй" — банкны мэргэжилтэн ингэж бичсэнийг харахад зах зээлийн мэдлэг дутмаг гэж ойлгодог. <strong>Өрсөлдөгч байна гэдгийг хүлээн зөвшөөр, тэдгээрээс яаж ялгарах вэ гэдгийг бич.</strong></p>\n\n<h3>❌ 6. Хэт урт, уншиход хэцүү бичиг</h3>\n<p>100 хуудасны бизнес төлөвлөгөө нь мэргэжилтний нүдийг ядрааж, чухал мэдээлэл алдагдуулна. Оновчтой хэмжээ: <strong>30–50 хуудас</strong> үндсэн баримт бичиг + хавсралтууд (зураг, гэрчилгээ, гэрээ).</p>\n\n<h3>❌ 7. Тоог тайлбарлахгүй орхих</h3>\n<p>"Борлуулалт: 48 сая ₮" гэж бичиж дараагийн мөрт өөр зүйл бичвэл банк "яаж 48 сая ₮ болох вэ?" гэж асуух нь тодорхой. Бүх тоон мэдээлэл нь өмнөх тайлбартай байх ёстой.</p>\n\n<h3>❌ 8. Нийлүүлэлтийн гинжний эрсдэлийг орхих</h3>\n<p>Хэрэв таны гол түүхий эд нэг л нийлүүлэгчээс ирдэг бол тэр нийлүүлэгч зогсвол бизнес зогсно. Банк үүнийг мэдмэгц эрсдэл өндөр гэж тодорхойлно. <strong>2–3 нийлүүлэгчийн нэрийг жагсаа.</strong></p>\n\n<h2>Монголын банкны онцлог шаардлага — яг юу хавсаргах вэ?</h2>\n\n<p>Монголын банкуудын ихэнх нь дараах бичиг баримтыг бизнес төлөвлөгөөтэй хамт шаарддаг:</p>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Бичиг баримт</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Хаанаас авах вэ</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Хугацаа</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Улсын бүртгэлийн гэрчилгээ</td><td style="padding:10px;border:1px solid #e5e7eb;">ХЗЯ-ны e-Mongolia портал</td><td style="padding:10px;border:1px solid #e5e7eb;">Шинэ хуулбар</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Татварын тодорхойлолт</td><td style="padding:10px;border:1px solid #e5e7eb;">НҮТГ (tatvar.mn)</td><td style="padding:10px;border:1px solid #e5e7eb;">30 хоногийн дотор</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Нийгмийн даатгалын тодорхойлолт</td><td style="padding:10px;border:1px solid #e5e7eb;">НДА (ndaatgal.mn)</td><td style="padding:10px;border:1px solid #e5e7eb;">30 хоногийн дотор</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Санхүүгийн тайлан (2–3 жилийн)</td><td style="padding:10px;border:1px solid #e5e7eb;">Тань дээрх нягтлан бодох бүртгэл</td><td style="padding:10px;border:1px solid #e5e7eb;">Сүүлийн 3 жилийн</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Барьцааны үнэлгээний дүгнэлт</td><td style="padding:10px;border:1px solid #e5e7eb;">Банкны итгэмжлэгдсэн үнэлгээч</td><td style="padding:10px;border:1px solid #e5e7eb;">90 хоногийн дотор</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Барьцааны өмчийн баримт</td><td style="padding:10px;border:1px solid #e5e7eb;">Газрын харилцааны байгууллага</td><td style="padding:10px;border:1px solid #e5e7eb;">Шинэ хуулбар</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Зорилтот хэрэглэгчийн захидал/гэрээ</td><td style="padding:10px;border:1px solid #e5e7eb;">Таны хэлцэл хийсэн байгууллага</td><td style="padding:10px;border:1px solid #e5e7eb;">Байвал заавал хавсарга</td></tr>\n</tbody>\n</table>\n\n<h2>ЖДҮ сангийн бизнес төлөвлөгөөний онцлог шаардлага</h2>\n\n<p>ЖДҮ сангийн 3–5%-ийн хүүтэй зээл авахад банкны энгийн зээлийн шаардлагаас <strong>нэмэлт 3 үзүүлэлт</strong> шаардагддаг:</p>\n\n<ul>\n<li>👥 <strong>Ажлын байрны нэмэгдэл</strong> — хэдэн шинэ ажлын байр бий болгох вэ? Сар сарын цалингийн фонд хэд болох вэ?</li>\n<li>🌍 <strong>Орон нутгийн хөгжилд оруулах хувь нэмэр</strong> — аймаг, сумын татварын орлого нэмэгдэх байдлаар тооцоолол</li>\n<li>♀️ <strong>Жендэрийн тэгш байдал</strong> — эмэгтэй ажилтны хувь, удирдлагад эмэгтэй байдал</li>\n</ul>\n\n<p>ЖДҮ сангаас 2025 онд <strong>40 тэрбум ₮</strong>-ийн санхүүжилт олгохоор батлагдсан. Энэ боломжийг ашиглах зай байна — harин дан ганц банкны зээлтэй харьцуулбал ЖДҮ-д <strong>дундаж 5–7 сарын хүлээлтийн хугацаа</strong> бий гэдгийг анхаар.</p>\n\n<h2>Бизнес төлөвлөгөөг хурдан, чанартай бэлдэх арга</h2>\n\n<p>Бизнес төлөвлөгөөний хамгийн том саад бол <strong>цаг хугацаа</strong>. Мэргэжлийн зөвлөх ажиллуулбал 3–5 сая ₮ зарцуулдаг бол загвараас эхлэн өөрөө хийвэл нэлээд хэмнэнэ.</p>\n\n<p>Загвар ашиглахдаа дараах алхмуудыг дага:</p>\n\n<ol>\n<li><strong>Зах зээлийн мэдээлэл цуглуул</strong> — ҮСХ-ийн тайлан, хэрэглэгчдийн судалгаа, өрсөлдөгчдийн шинжилгээ</li>\n<li><strong>Санхүүгийн тооцоолол хий</strong> — Excel загварыг ашиглаад орлого, зардал, мөнгөн урсгалыг тооцоол</li>\n<li><strong>Загварын хоосон талбарт өөрийн тоонуудыг оруул</strong> — нэр, байршил, хэмжээ, үнэ</li>\n<li><strong>Банкны мэргэжилтэнтэй урьдчилан уулз</strong> — тэд юуг тусгайлан хүсч байгааг мэд</li>\n<li><strong>Санхүүгийн зөвлөхтэй нягтлан шалга</strong> — тоонуудын уялдаа нягтал</li>\n</ol>\n\n<h2>Дүгнэлт</h2>\n\n<p>Монголын банкуудын стандарт нэмэгдэж байгаа боловч <strong>сайн бичигдсэн, тооцоолол бүхий бизнес төлөвлөгөөтэй зээлдэгчийн батлагдах боломж мэдэгдэхүйц өндөр</strong> байдаг. Санхүүгийн таамаглал нь бодитой, зах зээлийн шинжилгээ нь тоо баримт дээр суурилсан, эрсдэлийн дүн шинжилгээ нь шийдэлтэй байхад л банк итгэлтэйгээр хамтран ажиллахыг хүсдэг.</p>\n\n<p>Дээрх 8 хэсгийн бүтцийг дагаж, алдааг нь мэдэж, бодитой тооцооллоор дүүргэхэд тань DigitalGer-ийн бэлэн загвар туслана. Бэлэн загварт дараах давуу талууд бий: 8 хэсгийн бүтэц бэлэн, санхүүгийн тооцооллын Excel загвар орсон, банкны шаардлагад нийцсэн форматаар хэвлэгдэнэ, жишээ өгүүлбэр, жишээ тоо бүхий тайлбар орсон.</p>\n<p><a href="/products">DigitalGer дэлгүүр</a>-ээс өөрийн салбарт тохирсон бизнес төлөвлөгөөний загварыг татаж аваарай — ХАА, хүлэмж, мал аж ахуй, оёдол, хүнс боловсруулах үйлдвэр зэрэг 10 гаруй ангиллаар бэлэн загвар байна.</p>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/f3ab2dc4-ee00-4d8f-bde9-7f0d265a05fd.jpg	t	2025-11-12 00:00:00	{"бизнес төлөвлөгөө","банкны зээл","санхүүгийн тооцоолол","гарын авлага"}	DigitalGer баг	6	2026-05-21 23:47:28.705	2026-05-23 12:28:15.952
cmpg54s9500027s0ou582tmuu	Хүлэмжийн аж ахуй эхлүүлэх — хөрөнгө оруулалтаас орлого хүртэл	hulemjiin-aj-ahui-ehleh	Монголд хүлэмжийн аж ахуй хэчнээн ашигтай вэ? Анхан шатны хөрөнгө оруулалт хэд байх вэ? Бодит тооцоолол, туршлагатай фермерийн зөвлөмжийг задлав.	<h2>Яагаад хүлэмжийн аж ахуй одоо хамгийн сайн цаг вэ?</h2>\n<p>Монголын хүнсний ногооны хангамжийн дутагдал бодит байна. АХБ-ийн судалгаагаар (2024) Монголд төмс хасвал нийт хэрэглэх хүнсний ногооны <strong>40 орчим хувийг</strong> Хятад болон бусад улсаас импортолдог. Засгийн газар 2025 он гэхэд дотоодын үйлдвэрлэлээр хэрэгцээний <strong>100%</strong>-ийг хангана гэсэн зорилт тавьсан хэдий ч энэ зорилт хүрэхгүй байна — энэ бол таны зах зээл.</p>\n\n<p>2023 онд хүнсний ногооны үйлдвэрлэл <strong>183,000 тонн</strong>-ы дээд амжилтад хүрсэн боловч эрэлтийг нийлүүлэлт давж чадахгүй хэвээр. Хятадын ногооны нийлүүлэлт тогтворгүй — хилийн нөхцөл, тарифийн өөрчлөлт, улирлын ялгавар нэмэгдэнэ. Дотоодын хүлэмжийн үйлдвэрлэгч нь жилийн туршид тогтвортой үнэ, найдвартай захиалагчидтай ажиллана.</p>\n\n<h2>Хүлэмжийн аж ахуйн 4 загвар — юуг сонгох вэ?</h2>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Загвар</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Хэмжээ</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Анхны хөрөнгө</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Зориулалт</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Туршилтын / гэрийн</td><td style="padding:10px;border:1px solid #e5e7eb;">50–100 м²</td><td style="padding:10px;border:1px solid #e5e7eb;">3–8 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">Туршлага хуримтлуулах, гэр бүлийн хэрэгцээ</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Жижиг арилжааны</td><td style="padding:10px;border:1px solid #e5e7eb;">200–500 м²</td><td style="padding:10px;border:1px solid #e5e7eb;">15–35 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">Зах, дэлгүүрт нийлүүлэх</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Дунд арилжааны</td><td style="padding:10px;border:1px solid #e5e7eb;">1,000–2,000 м²</td><td style="padding:10px;border:1px solid #e5e7eb;">60–150 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">Дэлгүүр, сургууль, байгууллагатай гэрээ</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Том 4 улирлын</td><td style="padding:10px;border:1px solid #e5e7eb;">5,000 м²+</td><td style="padding:10px;border:1px solid #e5e7eb;">200–500 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">Супермаркет, хүнс үйлдвэртэй гэрээ, экспорт</td></tr>\n</tbody>\n</table>\n\n<h2>500 м² хүлэмжийн бодит тооцоолол — анхлан суурилагч эзний жилийн орлого</h2>\n\n<p>Доорх тооцоолол нь 500 м² халаалттай хүлэмжид, жилд 3 ургацтай (1–10-р сар), 2 ажилтантай тохиолдолд үндэслэсэн:</p>\n\n<h3>Өргөст хэмх (Cucumber)</h3>\n<ul>\n<li>Ургац: 12–18 кг/м² нэг ургацад → 500 м² × 15 кг × 3 ургац = <strong>22,500 кг/жил</strong></li>\n<li>Борлуулалтын үнэ (улиралд хамаарч): 3,500–6,000 ₮/кг</li>\n<li>Жилийн нийт орлого: ~<strong>90–135 сая ₮</strong></li>\n</ul>\n\n<h3>Улаан лооль (Tomato)</h3>\n<ul>\n<li>Ургац: 20–30 кг/м² → 500 м² × 25 кг × 2 ургац = <strong>25,000 кг/жил</strong></li>\n<li>Борлуулалтын үнэ: 4,000–8,000 ₮/кг (өвлийн улиралд хамгийн өндөр)</li>\n<li>Жилийн нийт орлого: ~<strong>100–200 сая ₮</strong></li>\n</ul>\n\n<h3>Зардлын тооцоолол — 500 м², жилд</h3>\n<ul>\n<li>Дулаалга, цахилгаан, усны зардал: 15–25 сая ₮</li>\n<li>Үр, бордоо, тоног төхөөрөмжийн элэгдэл: 5–10 сая ₮</li>\n<li>2 ажилтны цалин (сард 1.2–1.5 сая): 29–36 сая ₮/жил</li>\n<li>Бусад зардал: 5–10 сая ₮</li>\n<li><strong>Нийт зардал: 54–81 сая ₮/жил</strong></li>\n</ul>\n\n<blockquote style="border-left:4px solid #10b981;padding:12px 16px;background:#f0fdf4;margin:16px 0;">\n<strong>💰 Нийт ашиг:</strong> Улаан лооль тариалбал жилийн орлого 100–200 сая ₮, зардал 54–81 сая ₮ гарбал <strong>цэвэр ашиг 46–119 сая ₮/жил</strong> болно. 60–80 сая ₮-ийн хөрөнгө оруулалтын нөхөн олгох хугацаа: <strong>1–2 жил</strong>.\n</blockquote>\n\n<h2>Хүлэмжийн анхны хөрөнгийн задаргаа — 500 м²</h2>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Зардлын зүйл</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Хэмжээ</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Хүлэмжийн бүтэц (металл, шил/поликарбонат)</td><td style="padding:10px;border:1px solid #e5e7eb;">20–40 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Халаалтын систем</td><td style="padding:10px;border:1px solid #e5e7eb;">8–15 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Усалгааны систем (дусал)</td><td style="padding:10px;border:1px solid #e5e7eb;">3–6 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Газрын ажил, суурь</td><td style="padding:10px;border:1px solid #e5e7eb;">3–5 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Цахилгааны холболт</td><td style="padding:10px;border:1px solid #e5e7eb;">2–5 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Эхний ургацын үр, бордоо</td><td style="padding:10px;border:1px solid #e5e7eb;">1–3 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;font-weight:600;">Нийт</td><td style="padding:10px;border:1px solid #e5e7eb;font-weight:600;">37–74 сая ₮</td></tr>\n</tbody>\n</table>\n\n<h2>Аль ургамал тариалах нь ашигтай вэ? — Монгол зах зээлийн шинжилгээ</h2>\n\n<p><strong>1. Өвлийн саруудад (10–4 сар) хамгийн өндөр үнэтэй:</strong></p>\n<ul>\n<li>Улаан лооль — кг-д 8,000–15,000 ₮ хүрч болно (Хятадын нийлүүлэлт хасагдах үед)</li>\n<li>Хонго (Capsicum/Pepper) — кг-д 10,000–20,000 ₮</li>\n<li>Огноо (Cucumber) — кг-д 5,000–8,000 ₮</li>\n</ul>\n\n<p><strong>2. Жилийн туршид тогтмол эрэлттэй:</strong></p>\n<ul>\n<li>Сонгино (Spring onion), Навчит сонгино — хотын захуудад байнгын эрэлт</li>\n<li>Цагаан байцаа, Нарийн ногоо — супермаркетын гэрээт захиалга</li>\n</ul>\n\n<p><strong>3. Хурдан эргэлттэй (6–8 долоо хоногт ургаж ургац өгдөг):</strong></p>\n<ul>\n<li>Тарвас, Гишүүнэ — нэгдүгээр ургацыг 2 сарт аван, жилд 4–5 удаа тарих боломжтой</li>\n</ul>\n\n<h2>Борлуулалтын суваг — хаана зарах вэ?</h2>\n\n<ol>\n<li><strong>Захын дэлгүүрт шууд зарах</strong> — Нарантуул, Дэнж, Хар зах зэрэг том захад лангуу авах эсвэл тогтмол нийлүүлэгч болно. Хамгийн хурдан мөнгөний эргэлт.</li>\n<li><strong>Супермаркеттай гэрээ байгуулах</strong> — Номин, Меркури, Их дэлгүүрүүд дотоодын нийлүүлэгчийг хайдаг. Тогтвортой үнэ, том хэмжээний захиалга. Мөнгө 30 хоногт орно.</li>\n<li><strong>Сургууль, цайны газар, байгууллагатай гэрээ</strong> — жилийн гэрээгээр тогтмол нийлүүлэх. Үнэ дундаж ч тооцоолол хялбар.</li>\n<li><strong>Цахим дэлгүүр / хэрэглэгчид шууд</strong> — Хүнсний цахим захиалгын зах зээл Монголд өсч байна.</li>\n</ol>\n\n<h2>ЖДҮ сангаас хүлэмжийн аж ахуйд санхүүжилт авах</h2>\n\n<p>Хүлэмж, тариалангийн аж ахуй нь ЖДҮ сангийн <strong>тэргүүлэх 21 салбар</strong>-т орно. 2024 онд жилийн <strong>3%</strong> хүүтэй, 5 жилийн хугацаатай, эхний жилийн үндсэн зээлийн төлбөрөөс чөлөөлөх нөхцөлтэй зээл авах боломжтой байсан. 2025 онд ижил нөхцөлтэй 40 тэрбум ₮-ийн санхүүжилт батлагдсан.</p>\n\n<p>Банкнаас зээл авах тохиолдолд дараах бичиг баримт заавал шаардагдана:</p>\n<ul>\n<li>📋 Газрын эрхийн баримт (аймаг, сумын захиргааны шийдвэр буюу газар эзэмших гэрчилгээ)</li>\n<li>📋 Хүлэмжийн барилгын зураг, инженерийн тооцоолол</li>\n<li>📋 Усны нөөцийн баримт — гүний худаг буюу усны хоолойн холболтын гэрчилгээ</li>\n<li>📋 <strong>Бизнес төлөвлөгөө</strong> — ургацын тооцоолол, борлуулалтын суваг, орлогын таамаглал</li>\n<li>📋 Захиалагчийн захиа эсвэл урьдчилсан гэрээ (аль болохоор байвал)</li>\n</ul>\n\n<h2>Хүлэмжийн аж ахуй эхлүүлэхэд хийх 6 алхам</h2>\n\n<ol>\n<li><strong>Байршил сонгох</strong> — УБ хотын ойролцоо (Дархан, Налайх, Баянзүрх зэрэг) нийлүүлэлтийн зардал бага. Усны нөөц, цахилгааны нэвтрэлт шалгах.</li>\n<li><strong>Хүлэмжийн загварыг тогтоох</strong> — Монголын уур амьсгалд халаалттай хуванцар хүрэм эсвэл шилтэй металл хийцийн хүлэмж хамгийн тохиромжтой.</li>\n<li><strong>Мэргэжлийн зөвлөгөө авах</strong> — ХАА-н мэргэжлийн байгууллага, ХААИС-ийн судлаачтай зөвлөлдөх. Ургамал хамгааллын асуудлыг урьдчилан шийд.</li>\n<li><strong>Санхүүжилтийн эх үүсвэрийг тогтоох</strong> — ЖДҮ (sme.gov.mn), ХАА банк, эсвэл Хаан банкны хөдөө аж ахуйн зээлийн хөтөлбөрт хандах.</li>\n<li><strong>Борлуулалтын гэрээ урьдчилан хий</strong> — хүлэмж баригдаж дуусахаасаа өмнө захиалагчтай ярилцаж эхэл.</li>\n<li><strong>Жижигхнээр эхэл, туршлага хуримтлуул</strong> — 100–200 м²-аас эхлэж, эхний ургацын дараа хэмжээгээ өргөт.</li>\n</ol>\n\n<h2>Хүлэмжийн аж ахуй эхлүүлэхэд хамгийн нийтлэг алдаанууд</h2>\n\n<ul>\n<li>❌ <strong>Халаалтыг дутуу тооцоолох</strong> — Монголын өвлийн хүйтэнд халаалтын зардал тооцооллыг давж гарах нийтлэг алдаа. Дулааны хэмжилт, тусгаарлалтын зардлыг нарийн тооцоол.</li>\n<li>❌ <strong>Борлуулалтын сувгаа тодорхойлохгүй байх</strong> — ургац хадгалагдах хугацаа богино. Хаа зарахаа урьдчилан мэдэхгүй бол алдагдал гарна.</li>\n<li>❌ <strong>Усны асуудлыг үл тооцох</strong> — Монголын хуурай уур амьсгалд гүний худаг заавал хэрэгтэй.</li>\n<li>❌ <strong>Мэргэжилгүйгээр эхлэх</strong> — хамгийн багадаа нэг улирал ажилласан туршлагатай хүлэмжийн аж ахуйд дадлага хийх нь их ашигтай.</li>\n</ul>\n\n<h2>Дүгнэлт</h2>\n<p>Монголын хүнсний ногооны зах зээл дотоодын нийлүүлэлтийг хааяа л хангаж чаддаг. Хятадын импортын нийлүүлэлт тогтворгүй байгаа тул дотоодын хүлэмжийн үйлдвэрлэгч нь тогтвортой, найдвартай нийлүүлэгчийн байр суурьт байна. ЖДҮ сангийн жилийн 3%-ийн хүүтэй зээл, Хаан банкны ХАА-н зээлийн хөтөлбөр зэрэг санхүүжилтийн олон боломж нээлттэй байгаа. Хамгийн чухал зүйл бол зах зээлийн шинжилгээ, санхүүгийн тооцоолол бүхий найдвартай бизнес төлөвлөгөө.</p>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/91400eb0-bb1b-4675-8754-af08d7b23114.jpg	t	2025-08-20 00:00:00	{хүлэмж,тариалан,"хөдөө аж ахуй",орлого}	DigitalGer баг	3	2026-05-21 23:47:28.65	2026-05-23 12:27:50.434
cmpg54s9x00037s0ov1h1k9g1	Сүүний үнээний ферм эхлүүлэх — 2025 оны бодит зардал тооцоолол	mal-aj-ahuiin-biznes-ehleh	50 толгой сүүний үнээтэй фермийн нийт хөрөнгө оруулалт хэд болох вэ? Жилийн орлого хэд байх вэ? Нөхөн олгох хугацаа хэд вэ? Бүгдийг тайлбарлав.	<h2>Монголын сүүний зах зээл — тоо баримт дээр үндэслэсэн дүн шинжилгээ</h2>\n<p>"Сүү" ХК 2025 онд малчид, фермерүүдээс <strong>31.2 сая литр</strong> сүү татан авч Монгол Улсын 68 жилийн түүхэн дээд амжилтыг тогтоолоо (ikon.mn). 2020 онд зөвхөн 6.8 сая литр байсан нийлүүлэлт 2025 онд 4.6 дахин нэмэгдэж, <strong>дотоодын сүүний үйлдвэрлэл гайхалтай хурдацтай өсч байна</strong>.</p>\n\n<p>Монгол хүний сүүний хэрэглээ НҮБ-ын зөвлөмжөөс <strong>3.4 дахин бага</strong> байна (ikon.mn) — энэ нь зах зээлийн аварга том боломж гэсэн үг. Хот суурин газрын эрчимжсэн амьдралын хэв маяг, хүн амын орлого нэмэгдэх тусам сүүний хэрэглээ өсөх тулд дотоодын нийлүүлэлтийн дутагдал үргэлжлэх нь тодорхой.</p>\n\n<h2>Засгийн газрын 1,000 ₮/литрийн урамшуулал — маш чухал давуу тал</h2>\n\n<p>Засгийн газраас үйлдвэрийн аргаар боловсруулсан сүүний нийлүүлэлтэд <strong>литр тутамд 1,000 ₮-ийн урамшуулал</strong> олгодог. Гэрийнхээ сааль + урамшуулалын нэгдэл нь фермийн орлогыг мэдэгдэхүйц нэмэгдүүлдэг. 2024–2025 онд 14 аймгийн 32 үйлдвэр, цех энэ урамшуулалд хамрагдана.</p>\n\n<blockquote style="border-left:4px solid #f59e0b;padding:12px 16px;background:#fffbeb;margin:16px 0;">\n<strong>💡 Тооцоолол:</strong> 50 үнээтэй ферм, жилд 150,000 литр сүү → урамшуулалд: <strong>150,000 × 1,000 ₮ = 150 сая ₮/жил</strong> нэмэлт орлого. Энэ нь урамшуулалд хамрагдахад л боломжтой.\n</blockquote>\n\n<h2>50 толгой сүүний үнээтэй фермийн бодит тооцоолол</h2>\n\n<h3>Анхны хөрөнгийн задаргаа</h3>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Зардлын зүйл</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Бага хувилбар</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Өндөр хувилбар</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Сүүний үнээ (50 толгой)</td><td style="padding:10px;border:1px solid #e5e7eb;">175 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">300 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Байр, хашаа (саравч, агуулах)</td><td style="padding:10px;border:1px solid #e5e7eb;">30 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">80 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Саалтын машин, тоног төхөөрөмж</td><td style="padding:10px;border:1px solid #e5e7eb;">20 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">50 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Тэжээлийн нөөц (3–6 сарын)</td><td style="padding:10px;border:1px solid #e5e7eb;">15 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">30 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Бусад (усан хангамж, цахилгаан)</td><td style="padding:10px;border:1px solid #e5e7eb;">10 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">20 сая ₮</td></tr>\n<tr style="font-weight:600;background:#fef3c7;"><td style="padding:10px;border:1px solid #e5e7eb;">НИЙТ</td><td style="padding:10px;border:1px solid #e5e7eb;">250 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">480 сая ₮</td></tr>\n</tbody>\n</table>\n\n<p><em>Дундаж хувилбар (~350 сая ₮) нь зах зээлийн бодит ажиллагаатай жишигт хамгийн ойрхон байна.</em></p>\n\n<h3>Жилийн орлогын тооцоолол</h3>\n\n<p>Монголд сүүний чиглэлийн сайн үүлдрийн үнээ (Holstein, Симментал)-д <strong>хоногийн 10–25 литр сүү</strong> гардаг. Дундажаар 15 литр/хоног × 300 хоног ажиллах хугацааг үндэслэвэл:</p>\n\n<ul>\n<li>50 үнээ × 15 литр/хоног × 300 хоног = <strong>225,000 литр/жил</strong></li>\n<li>Сүүний борлуулалтын үнэ (үйлдвэрт): 1,800–2,500 ₮/литр</li>\n<li>Борлуулалтын орлого: <strong>405–562 сая ₮/жил</strong></li>\n<li>Засгийн газрын урамшуулал (литр × 1,000₮): <strong>225 сая ₮/жил нэмэлт</strong> (урамшуулалд хамрагдсан тохиолдолд)</li>\n</ul>\n\n<h3>Жилийн зардал</h3>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Зардлын зүйл</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Жилийн дүн</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Тэжээлийн зардал (50 үнээ)</td><td style="padding:10px;border:1px solid #e5e7eb;">80–120 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Ажилтны цалин (3–5 хүн)</td><td style="padding:10px;border:1px solid #e5e7eb;">40–60 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Мал эмнэлэг, вакцин</td><td style="padding:10px;border:1px solid #e5e7eb;">5–10 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Цахилгаан, тээвэр, бусад</td><td style="padding:10px;border:1px solid #e5e7eb;">15–25 сая ₮</td></tr>\n<tr style="font-weight:600;"><td style="padding:10px;border:1px solid #e5e7eb;">Нийт зардал</td><td style="padding:10px;border:1px solid #e5e7eb;">140–215 сая ₮</td></tr>\n</tbody>\n</table>\n\n<blockquote style="border-left:4px solid #10b981;padding:12px 16px;background:#f0fdf4;margin:16px 0;">\n<strong>💰 Жилийн цэвэр ашиг (урамшуулалгүй):</strong> 405–562 сая (орлого) − 140–215 сая (зардал) = <strong>190–347 сая ₮/жил</strong><br/>\n<strong>Хөрөнгө нөхөн олгох хугацаа: 1–2 жил</strong>\n</blockquote>\n\n<h2>Сүүний үнээний ямар үүлдэр нь Монголд тохиромжтой вэ?</h2>\n\n<ul>\n<li><strong>Holstein (Хар цагаан тороор)</strong> — хамгийн өндөр сүүний гарцтай (жилд 7,500–14,000 литр). Гэхдээ тэжээлийн шаардлага өндөр, халуун дулаан байр шаарддаг.</li>\n<li><strong>Симментал</strong> — дундаж сүүний гарц, тэжээлд дасалтай. Монголын уур амьсгалд илүү хатуужилтай.</li>\n<li><strong>Монгол × Сайжруулсан хольц</strong> — дотоодын нөхцөлд амьд үлдэх чадвар сайтай. Сүүний гарц харьцангуй бага ч зардал бага.</li>\n</ul>\n\n<p><strong>Зөвлөмж:</strong> Анхлан суурилагчдад Симментал эсвэл сайжруулсан хольц үүлдрийг санал болгоно. Туршлага хуримтлуулсны дараа Holstein-д шилжих боломжтой.</p>\n\n<h2>Сүүний фермийн борлуулалтын 3 суваг</h2>\n\n<ol>\n<li><strong>"Сүү" ХК болон бусад үйлдвэртэй гэрээ</strong> — Монголын гол сүүний үйлдвэрт нийлүүлбэл тогтмол үнэ, дамжуулах логистик. Урамшуулалд хамрагдах боломж нээлттэй.</li>\n<li><strong>Сургууль, цайны газар, байгууллагатай шууд гэрээ</strong> — захиалгын гэрээгээр тогтмол дүн, харьцангуй өндөр үнэ (2,500–3,500 ₮/литр).</li>\n<li><strong>Сүүн бүтээгдэхүүн үйлдвэрлэх</strong> — өөрийн ферм дээр йогурт, тарг, ааруул, бяслаг хийж хоёр дахь шатны боловсруулалтад орвол нэмүү өртөг ихэссэнээр ашиг нэмэгдэнэ.</li>\n</ol>\n\n<h2>ХАА болон арилжааны банкнаас санхүүжилт авах нөхцөл</h2>\n\n<p>Сүүний фермийн чиглэлд <strong>ХасБанк, Хаан банк</strong>-аас тусгай ХАА-н зээлийн хөтөлбөр байдаг. АХБ 2025 оны 12-р сарыг Хаан банктай <strong>100 сая ам.долларын зээлийн гэрээ</strong> байгуулсан бөгөөд энэ нь ХАА болон мал аж ахуйн жижиг дунд бизнест зориулагдсан байна.</p>\n\n<p>Банкнаас зээл авах гол бичиг баримт:</p>\n<ul>\n<li>📋 Газрын эрхийн баримт (газар эзэмших гэрчилгээ)</li>\n<li>📋 <strong>Бизнес төлөвлөгөө</strong> — тэжээлийн нормчлол, сүүний гарцын тооцоолол, борлуулалтын гэрээ</li>\n<li>📋 Үнээний худалдан авах гэрээ / эх сурвалжийн нотолгоо</li>\n<li>📋 Сүүний үйлдвэрт нийлүүлэх урьдчилсан гэрээ эсвэл захиалгын захиа</li>\n<li>📋 Тоног төхөөрөмжийн нэхэмжлэх / гэрчилгээ</li>\n<li>📋 Барьцаа хөрөнгийн баримт</li>\n</ul>\n\n<h2>Ерөнхийлөгчийн тогтоол — 30 ферм байгуулах зорилт</h2>\n<p>Монгол Улсын Ерөнхийлөгч 2024–2025 онд сүүний чиглэлийн фермүүдэд ажиллаж, "Шаардлага хангасан <strong>30 ферм байгуулснаар дотоодын сүүний хэрэгцээг бүрэн хангах</strong> боломжтой" гэж мэдэгдсэн. Засгийн газрын өндөр анхааралтай байгаа энэ салбарт санхүүжилт, урамшуулал хэвийнх байна.</p>\n\n<h2>Сүүний ферм байгуулахад алдаа гаргах нийтлэг 5 тохиолдол</h2>\n\n<ol>\n<li><strong>Тэжээлийн зардлыг дутуу тооцоолох</strong> — хөрсний чанар, тэжээлийн бэлтгэл нь ашгийг хамгийн ихээр нөлөөлдөг хүчин зүйл.</li>\n<li><strong>Борлуулалтын сувгаа шийдвэрлэхгүй эхлэх</strong> — сүүг хаана зарах, хэдийд зарах нь мөнгөн урсгалд шийдвэрлэх нөлөөтэй.</li>\n<li><strong>Мал эмнэлгийн зардлыг алгасах</strong> — тахал, өвчин гарвал нэг улиралд ашгаа алдаж болно.</li>\n<li><strong>Тоног төхөөрөмжид хэмнэх</strong> — хямд саалтын машин нь ариун цэврийн стандартыг хангахгүй, үйлдвэрт сүүг буцааж болно.</li>\n<li><strong>Бэлчээр буюу тэжээлийн суурийг тооцоолохгүй байх</strong> — 50 үнээ өвөлжиж хаврыг гаргах хэмжээний тэжээлийн нөөц байхгүй бол нэмэлт зардал маш их гарна.</li>\n</ol>\n\n<h2>Дүгнэлт: Монголын сүүний ферм бодит ашигтай бизнес</h2>\n<p>Монголын сүүний зах зээл хурдацтай өсч байгаа тул хамгийн тохиромжтой цаг нь одоо. Засгийн газрын урамшуулал, АХБ-аар дамжсан ХАА-н зээл, ЖДҮ-ийн санхүүжилт зэрэг дэмжлэгийн олон хэрэгсэл байна. Хамгийн чухал зүйл бол тэжээлийн нормчлол, сүүний гарцын тооцоолол, борлуулалтын суваг бүрэн тусгасан мэргэжлийн бизнес төлөвлөгөө байгуулах явдал юм.</p>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/bfefec05-2ce8-4e0b-9c52-2211a8e91609.jpg	t	2025-09-10 00:00:00	{"мал аж ахуй","сүүний ферм",зээл,"орлого тооцоолол"}	DigitalGer баг	4	2026-05-21 23:47:28.677	2026-05-23 12:27:58.967
cmpg54sa400047s0o5z5p8v7f	Оёдлын цех байгуулах — хамгийн бага хөрөнгөөр хамгийн хурдан өгөөж	oyodliin-tseh-baiguulah	Монголд оёдлын цех хэчнээн хурдан ашиг гаргадаг вэ? 10 машинтай цехийн нийт зардал хэд болох вэ? Банкнаас зээл авах боломжтой юу?	<h2>Монголын оёдлын үйлдвэрлэлийн боломж — яагаад яг одоо?</h2>\n<p>Монгол бол дэлхийн <strong>6 дугаар том кашмирын экспортлогч</strong> орон. 2024 онд Монголын кашмирын экспортын нийт дүн <strong>70.56 сая ам.доллар</strong> хүрсэн бол ноос, малын үс болон холбоотой текстилийн бүтээгдэхүүний нийт экспорт хэдэн зуун сая ам.долларт хүрдэг. GOBI Cashmere дангаараа <strong>1,500+ ажилтантай</strong>, жилд 162,000 оёмол бүтээгдэхүүн үйлдвэрлэдэг.</p>\n\n<p>Гэвч том компаниас гадна олон мянган тонн ноос, кашмир, текстилийн материал жил бүр экспортлогдож байна — харин оёдлын боловсруулалт хийгдэлгүй. Дотоодын зах зээлд дүр зураглавал: иргэдийн өдөр тутамд өмсдөг хувцасны 80 гаруй хувь нь импортоос ирдэг. "Made in Mongolia" хувцасны эрэлт хотын иргэдийн дунд өсч байна.</p>\n\n<h2>Оёдлын цехийн бизнесийн 4 загвар — аль нь таны хэмжээнд тохирох вэ?</h2>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Загвар</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Машины тоо</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Ажилтан</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Анхны хөрөнгө</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Зорилтот захиалагч</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Гэрийн жижиг цех</td><td style="padding:10px;border:1px solid #e5e7eb;">2–5</td><td style="padding:10px;border:1px solid #e5e7eb;">1–3</td><td style="padding:10px;border:1px solid #e5e7eb;">3–10 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">Тусгай захиалга, засвар үйлчилгээ</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Жижиг арилжааны цех</td><td style="padding:10px;border:1px solid #e5e7eb;">5–15</td><td style="padding:10px;border:1px solid #e5e7eb;">5–15</td><td style="padding:10px;border:1px solid #e5e7eb;">15–50 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">Uniform гэрээ, дэлгүүр</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Дунд оврын үйлдвэр</td><td style="padding:10px;border:1px solid #e5e7eb;">20–50</td><td style="padding:10px;border:1px solid #e5e7eb;">20–50</td><td style="padding:10px;border:1px solid #e5e7eb;">60–200 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">Экспорт, том байгууллага</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Том кашмирын үйлдвэр</td><td style="padding:10px;border:1px solid #e5e7eb;">50+</td><td style="padding:10px;border:1px solid #e5e7eb;">100+</td><td style="padding:10px;border:1px solid #e5e7eb;">500 сая ₮+</td><td style="padding:10px;border:1px solid #e5e7eb;">Олон улсын брэнд, хэт арилжааны экспорт</td></tr>\n</tbody>\n</table>\n\n<h2>10 машинтай жижиг оёдлын цехийн задаргаа тооцоолол</h2>\n\n<h3>Анхны хөрөнгийн зардал</h3>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Зардлын зүйл</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Бага хувилбар</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Өндөр хувилбар</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Үндсэн оёдлын машин (10 ш)</td><td style="padding:10px;border:1px solid #e5e7eb;">8 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">25 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Overlok, дарах машин</td><td style="padding:10px;border:1px solid #e5e7eb;">3 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">8 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Таслах машин, дэлгэх ширээ</td><td style="padding:10px;border:1px solid #e5e7eb;">1 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">3 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Байрны засвар, ширээ, сандал, тавилга</td><td style="padding:10px;border:1px solid #e5e7eb;">2 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">8 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Анхны материал, даавуу</td><td style="padding:10px;border:1px solid #e5e7eb;">2 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">5 сая ₮</td></tr>\n<tr style="font-weight:600;background:#fef3c7;"><td style="padding:10px;border:1px solid #e5e7eb;">НИЙТ</td><td style="padding:10px;border:1px solid #e5e7eb;">16 сая ₮</td><td style="padding:10px;border:1px solid #e5e7eb;">49 сая ₮</td></tr>\n</tbody>\n</table>\n\n<h3>Жилийн орлогын тооцоолол</h3>\n\n<p>10 машин, 10 оёдолчинтой цех (нэг ажилтан нэг машин):</p>\n<ul>\n<li>Нэг оёдолчин сард дунд оврын хувцасны <strong>150–250 ширхэг</strong> оёдог</li>\n<li>10 оёдолчин × 200 ширхэг × 11 сар = <strong>22,000 ширхэг/жил</strong></li>\n<li>Оёдлын хөлс (нэг ширхэгт): 8,000–25,000 ₮ (захиалагч хэн бэ, материал нь хэн гаргах вэ гэдэгт хамаарна)</li>\n<li>Жилийн нийт орлого: <strong>176–550 сая ₮</strong></li>\n</ul>\n\n<h3>Жилийн зардал</h3>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;">Зардлын зүйл</th>\n<th style="padding:10px;border:1px solid #e5e7eb;">Дүн (жилд)</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">10 оёдолчины цалин (800K–1.2M сард)</td><td style="padding:10px;border:1px solid #e5e7eb;">96–144 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Байрны түрээс (40–80 м² завод)</td><td style="padding:10px;border:1px solid #e5e7eb;">6–20 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Нийгмийн даатгал, татвар</td><td style="padding:10px;border:1px solid #e5e7eb;">20–30 сая ₮</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Утас, хэрэгсэл, засвар</td><td style="padding:10px;border:1px solid #e5e7eb;">5–10 сая ₮</td></tr>\n<tr style="font-weight:600;"><td style="padding:10px;border:1px solid #e5e7eb;">Нийт зардал</td><td style="padding:10px;border:1px solid #e5e7eb;">127–204 сая ₮</td></tr>\n</tbody>\n</table>\n\n<blockquote style="border-left:4px solid #10b981;padding:12px 16px;background:#f0fdf4;margin:16px 0;">\n<strong>💰 Жилийн цэвэр ашиг:</strong> 176–550 сая (орлого) − 127–204 сая (зардал) = <strong>49–346 сая ₮/жил</strong><br/>\n<strong>Хөрөнгө нөхөн олгох хугацаа: 6–18 сар</strong> (буюу аль нэг том гэрээ байгаад эхлэх)\n</blockquote>\n\n<h2>Хамгийн ашигтай 3 борлуулалтын суваг</h2>\n\n<h3>1. Байгууллагын uniform гэрээ — хамгийн тогтвортой орлого</h3>\n<p>Сургууль, эмнэлэг, банк, аюулгүй байдлын компани, рестораны ажилтан бүр uniform хэрэгтэй. Жилд нэг удаа шинэчлэгддэг компанийн uniform захиалга нь тогтмол их хэмжээний цэвэр орлого өгдөг. 100 ажилтантай 1 компанийн uniform = 2–5 сая ₮ нэг захиалга.</p>\n\n<h3>2. Дэлгүүрт нийлүүлэх / брэндэд оёдлын ажил хийх</h3>\n<p>Монголын хувцасны дэлгүүрүүд (Голомт, Nation, MonCos гэх мэт) дотоодын нийлүүлэгч хайдаг. "OEM" загвараар (захиалагчийн загварыг оёж өгөх) ажиллах нь материалын асуудлыг захиалагч шийддэг тул эрсдэл буурна.</p>\n\n<h3>3. Экспорт — кашмирын дэлхийн зах зээл рүү</h3>\n<p>Монголын кашмир дэлхийд алдартай. Японы, Европын брэндүүд Монголын сайн чанарын гар оёдлын бүтээгдэхүүнд сонирхлоо нэмэгдүүлж байна. Жижиг цехийн хувьд B2B платформаар экспортын нийлүүлэгч болох боломжтой.</p>\n\n<h2>ЖДҮ сангаас санхүүжилт авах — оёдлын цех тэргүүлэх чиглэлд</h2>\n\n<p>Оёдол, нэхмэл үйлдвэрлэл нь ЖДҮ сангийн хөнгөн үйлдвэрлэлийн тэргүүлэх чиглэлд орно. <strong>Жилийн 3% хүү, 5 жилийн хугацаа</strong>-тай санхүүжилт авах боломжтой. Шаардлагатай баримтууд:</p>\n<ul>\n<li>📋 <strong>Бизнес төлөвлөгөө</strong> — үйлдвэрлэлийн хэмжээ, нормчлол, захиалагчийн жагсаалт, санхүүгийн тооцоолол</li>\n<li>📋 Тоног төхөөрөмжийн нэхэмжлэх / гэрээ</li>\n<li>📋 Байрны гэрээ (хэрэв түрээс)</li>\n<li>📋 Захиалагч байгууллагын захиалгын захиа (байгаа бол)</li>\n<li>📋 ЖДҮ-ийн тодорхойлолт</li>\n</ul>\n\n<h2>Оёдлын цех байгуулахад ЖДҮ-ийн мэргэжилтэн онцгой анхаардаг зүйлс</h2>\n\n<ul>\n<li><strong>Хэдэн ажлын байр бий болгох вэ?</strong> — 10 оёдолчины цех нь 10 жижиг дунд орлоготой гэр бүлд тогтмол орлого олгодог гэдгийг тодорхой бичих.</li>\n<li><strong>Эмэгтэй ажлын байр</strong> — оёдлын цехийн ажилтдын 90%+ эмэгтэй. ЖДҮ энэ хэсгийг тусгайлан дэмжидэг.</li>\n<li><strong>Орон нутгийн нийлүүлэлт</strong> — Монголын ноос, кашмир, эсгий зэрэг түүхий эдийг ашиглах бол давуу үнэлгээ авна.</li>\n</ul>\n\n<h2>Цехийн байршлыг хэрхэн сонгох вэ?</h2>\n\n<p>Оёдлын цехийн байршил нь ашгийн чухал хүчин зүйл:</p>\n<ul>\n<li><strong>Тээврийн боомтуудын ойролцоо</strong> — Замын-Үүд, Дархан, Эрдэнэт зэрэг хотуудад түрээсийн үнэ UB-ийгаас 50–60% хямд, экспортын логистик хялбар.</li>\n<li><strong>Улаанбаатарт</strong> — захиалагчид ойрхон, боловсон хүчний нийлүүлэлт сайн, гэхдээ түрээс өндөр.</li>\n<li><strong>Аймгийн төвд</strong> — ЖДҮ-ийн шаардлагад орон нутгийн хөгжил давуу үнэлгээтэй, цалин харьцангуй бага.</li>\n</ul>\n\n<h2>Нийтлэг алдаанаас зайлсхийх — практик зөвлөгөө</h2>\n\n<ol>\n<li><strong>Боловсон хүчний асуудлыг дутуу тооцоолох</strong> — сайн оёдолчин олоход хэцүү. Сургалтад хөрөнгө оруулах буюу МСҮТ-тэй хамтран ажиллах.</li>\n<li><strong>Захиалгагүйгээр машин авах</strong> — эхлээд нэг том захиалга аваад, тэр захиалгад үндэслэн машин авах нь эрсдэлийг бууруулна.</li>\n<li><strong>Чанарын хяналтын системгүй байх</strong> — нэг бэртсэн бүтээгдэхүүн таны нэр хүндийг алдагдуулна.</li>\n<li><strong>Бараа материалын эргэлтийг буруу тооцоолох</strong> — ихэнх жижиг цехүүд материалыг хэт их худалдан авч, мөнгөн урсгалд хүндрэлд ордог.</li>\n</ol>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/9ddf9f5a-c981-4477-9b69-b023eacd91f9.jpg	t	2025-10-05 00:00:00	{оёдол,цех,бизнес,"хөрөнгө оруулалт"}	DigitalGer баг	5	2026-05-21 23:47:28.684	2026-05-23 12:28:06.863
cmpifzrxe00007s5ckl9jb08t	МХБ-д хэрхэн хөрөнгө оруулах вэ — Эхлэгчдэд зориулсан бүрэн гарын авлага	mhb-horongo-oruulalt-guide	Монголын хөрөнгийн биржид хэрхэн данс нээх, хувьцаа сонгох, анхны хөрөнгө оруулалтаа хийх — алхам алхмаар тайлбарласан практик заавар.	<h2>МХБ гэж юу вэ?</h2>\n<p>Монголын хөрөнгийн бирж (МХБ) нь 1991 онд байгуулагдсан, Монголын хамгийн том санхүүгийн зах зээл юм. Өнөөдрийн байдлаар МХБ-д <strong>200 гаруй компанийн хувьцаа</strong> арилжаалагддаг бөгөөд нийт зах зээлийн үнэлгээ <strong>3 их наяд төгрөгөөс дээш</strong> болж өссөн байна.</p>\n<p>Олон монгол хүн "хөрөнгө оруулалт" гэхээр зөвхөн үл хөдлөх хөрөнгө эсвэл алт бодно. Гэвч МХБ нь ердийн иргэнд ч нээлттэй — та ердөө 100,000 төгрөгөөс эхлэн хөрөнгө оруулалт хийж болно.</p>\n\n<h2>Яагаад МХБ-д хөрөнгө оруулах вэ?</h2>\n<p>Сүүлийн 5 жилийн статистикийг харвал МХБ-ийн индекс (MSE Top-20) дунджаар жилд <strong>15–25%</strong> өсч байсан. Банкны хадгаламжийн хүү 8–10% байдгийг бодоход хөрөнгийн бирж илүү өгөөжтэй байх боломжтой.</p>\n\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:10px;text-align:left;">Хөрөнгө оруулалтын хэлбэр</th>\n      <th style="padding:10px;text-align:center;">Жилийн дундаж өгөөж</th>\n      <th style="padding:10px;text-align:center;">Эрсдэл</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Банкны хадгаламж</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">8–10%</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Маш бага</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">МХБ хувьцаа (Top-20)</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">15–25%</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Дунд</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Үл хөдлөх хөрөнгө</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">10–20%</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Дунд</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;">Алт</td>\n      <td style="padding:10px;text-align:center;">5–15%</td>\n      <td style="padding:10px;text-align:center;">Дунд</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Алхам 1: Брокер компани сонгох</h2>\n<p>МХБ-д хувьцаа худалдан авахын тулд заавал <strong>брокер компаниар дамжих</strong> ёстой. Монголд санхүүгийн зохицуулах хорооноос (СЗХ) зөвшөөрөл авсан хэд хэдэн брокер байдаг:</p>\n\n<ul>\n  <li><strong>TDB Securities</strong> — Худалдаа хөгжлийн банкны охин компани, найдвартай, онлайн платформтай</li>\n  <li><strong>Golomt Securities</strong> — Голомт банктай холбоотой, уламжлалт брокер</li>\n  <li><strong>BDS Securities</strong> — Хэд хэдэн онлайн хэрэгсэлтэй</li>\n  <li><strong>Tushig Securities</strong> — Эхлэгчдэд ойр, зааварчилгаатай</li>\n</ul>\n\n<p>Брокер сонгохдоо дараах зүйлийг харгалзах хэрэгтэй: комиссын хэмжээ (ихэвчлэн 0.3–1%), онлайн платформ байгаа эсэх, хэрэглэгчийн үйлчилгээ.</p>\n\n<h2>Алхам 2: Бүртгэлд хамрагдах (данс нээх)</h2>\n<p>Данс нээхэд шаардлагатай баримт бичиг:</p>\n<ul>\n  <li>Иргэний үнэмлэх (эх хувь + хуулбар)</li>\n  <li>Оршин суугаа хаягийн тодорхойлолт</li>\n  <li>Гар утасны дугаар</li>\n  <li>Анхны хөрөнгийн эх үүсвэр (зарим брокер шаардана)</li>\n</ul>\n<p>Данс нээлт ихэнх тохиолдолд <strong>2–5 ажлын өдөр</strong> үргэлжилнэ. Зарим брокер онлайнаар бүртгэл хийх боломжтой болгосон.</p>\n\n<h2>Алхам 3: Дансаа цэнэглэх</h2>\n<p>Данс нээгдсэний дараа брокерийн зааж өгсөн дансанд мөнгөө шилжүүлнэ. Анхны доод хэмжээ брокероос хамаарч <strong>50,000–500,000 төгрөг</strong> байдаг. Мөнгө шилжүүлсний дараа ихэвчлэн нэг ажлын өдрийн дотор идэвхжинэ.</p>\n\n<h2>Алхам 4: Хувьцаа судлах, сонгох</h2>\n<p>Хувьцаа сонгохдоо шинэ хөрөнгө оруулагчид дараах аргыг ашиглаж болно:</p>\n\n<h3>Найдвартай компани хайх шалгуур</h3>\n<ul>\n  <li><strong>P/E харьцаа (Price/Earnings)</strong> — 10-аас доош байвал хямд үнэтэй байж болно</li>\n  <li><strong>Ногдол ашиг (Dividend)</strong> — жил бүр ногдол ашиг тараадаг компани тогтвортой</li>\n  <li><strong>Орлогын өсөлт</strong> — сүүлийн 3 жилийн санхүүгийн тайланг шалгах</li>\n  <li><strong>Салбарын байдал</strong> — уул уурхай, банк, дэд бүтцийн салбар Монголд харьцангуй тогтвортой</li>\n</ul>\n\n<h3>МХБ-д арилжаалагдах алдартай хувьцаанууд</h3>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:10px;text-align:left;">Компани</th>\n      <th style="padding:10px;text-align:left;">Салбар</th>\n      <th style="padding:10px;text-align:center;">Тэмдэглэл</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Монгол Шуудан (MNS)</td>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Логистик</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Тогтвортой</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Талх чихэр (TCH)</td>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хүнс</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Ногдол ашигтай</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">APU компани</td>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хүнс, ундаа</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Том компани</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;">Монголын хөрөнгийн бирж (MSE)</td>\n      <td style="padding:10px;">Санхүү</td>\n      <td style="padding:10px;text-align:center;">Өсөлттэй</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Алхам 5: Захиалга өгөх</h2>\n<p>Брокерийн платформд нэвтэрч, сонгосон хувьцааны тэмдэглэгээг оруулаад, тоо хэмжээ болон үнийг тогтоон захиалга өгнө. Захиалгын хоёр төрөл байдаг:</p>\n<ul>\n  <li><strong>Market Order</strong> — Зах зээлийн одоогийн үнээр шууд худалдан авах</li>\n  <li><strong>Limit Order</strong> — Та тохируулсан үнэд хүрэхэд л автоматаар худалдан авах</li>\n</ul>\n\n<h2>МХБ-ийн татвар ба зардал</h2>\n<p>Хөрөнгийн ашгид <strong>10%</strong> татвар ногдоно (хувь хүн). Брокерийн комисс арилжааны дүнгийн <strong>0.3–1%</strong> байдаг. Жилийн дансны хөлс зарим брокерт байдаг тул урьдчилан лавлах хэрэгтэй.</p>\n\n<h2>Эхлэгчдэд зориулсан 5 дүрэм</h2>\n<ol>\n  <li><strong>Бүх мөнгөө нэг хувьцаанд битгий хийгээрэй</strong> — 5–10 компанид тараах нь эрсдэлийг бууруулна</li>\n  <li><strong>Урт хугацаанд бод</strong> — МХБ богино хугацаанд хэлбэлздэг, 3–5 жилийн хугацаатай хандах нь зөв</li>\n  <li><strong>Санхүүгийн тайланг унш</strong> — Жил бүрийн тайланг МХБ-ийн сайтаас үнэгүй татаж авна</li>\n  <li><strong>Шунахайрах хэрэггүй</strong> — "Маргааш 2 дахин өснө" гэж хэн нэгэн хэлбэл болгоомжлох хэрэгтэй</li>\n  <li><strong>Зөвхөн алдаж болох мөнгөөрөө хөрөнгө оруул</strong> — Зээл авч хувьцаа авах нь маш аюултай</li>\n</ol>\n\n<blockquote style="border-left:4px solid #1a3c8f;padding:15px 20px;background:#f0f4ff;margin:20px 0;font-style:italic;">\n  "Хөрөнгийн зах зээл нь тэвчээргүй хүнийх acheiev тэвчээртэй хүнд шилжүүлдэг механизм юм." — Уоррен Баффет\n</blockquote>\n\n<h2>Дүгнэлт</h2>\n<p>МХБ-д хөрөнгө оруулах нь эхлэхэд хэцүү мэт боловч алхам алхмаар бол бүрэн боломжтой. Брокер сонгох → данс нээх → жижиг дүнгээр эхлэх → суралцах — энэ дарааллаар явбал таны санхүүгийн ирээдүй илүү найдвартай болно. Монголын эдийн засаг өсөлттэй байгаа энэ үед МХБ нь таны хадгалсан мөнгийг ажиллуулах хамгийн хүртээмжтэй арга юм.</p>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/56b5f39a-8ee1-4162-8458-2a7efa8dcd1d.jpg	t	2025-01-20 00:00:00	{"хөрөнгө оруулалт",МХБ,хувьцаа,санхүү,бирж}	DigitalGer	7	2026-05-23 14:27:03.073	2026-05-23 14:52:51.075
cmpg54s1500017s0ozzzzf2wg	ЖДҮ сангаас санхүүжилт авах — алхам алхмаар	jdyu-sangiin-sanhuujilt-avah	ЖДҮ санд ямар бизнес тохирдог вэ? Хэдий хэмжээний санхүүжилт авах боломжтой вэ? Хүсэлтийн маягтаас зэрэгцүүлэн тайлбарлав.	<h2>ЖДҮ сан гэж юу вэ? — Монгол Улсын хамгийн хямд бизнесийн санхүүжилт</h2>\n<p>Монгол Улсын Засгийн газрын харъяа <strong>Жижиг, Дунд Үйлдвэрийн Газар (sme.gov.mn)</strong> нь жил бүр тэрбум тэрбум төгрөгийн хөнгөлөлттэй зээл олгодог. Арилжааны банкуудын зээлийн хүү жилийн 16–19% байхад ЖДҮ сангийн зээлийн хүү <strong>жилийн 3–5%</strong> байна. Энэ бол Монгол дахь хамгийн хямд хуулийн дагуу олгогддог бизнесийн санхүүжилт юм.</p>\n\n<p>2024 онд нийт <strong>36.1 тэрбум төгрөгийн</strong> санхүүжилт олгогдсон бол 2025 онд <strong>40 тэрбум төгрөгийн</strong> санхүүжилт батлагдсан. Энэ мөнгийг олон жижиг бизнес эрхлэгч авдаг — таниас хурдан бэлдсэн хүн авна.</p>\n\n<h2>2024–2025 оны зээлийн нөхцөл — бодит тоо баримт</h2>\n\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<thead><tr style="background:#f3f4f6;">\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Хөтөлбөр</th>\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Зээлийн хүү</th>\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Хугацаа</th>\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Чөлөөлөх хугацаа</th>\n<th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Зориулалт</th>\n</tr></thead>\n<tbody>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Үндсэн хөтөлбөр (21 салбар)</td><td style="padding:10px;border:1px solid #e5e7eb;"><strong>Жилийн 3%</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">5 жил</td><td style="padding:10px;border:1px solid #e5e7eb;">1 жил хүртэл</td><td style="padding:10px;border:1px solid #e5e7eb;">Үндсэн хөрөнгө оруулалт</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Загвар хоршоо хөтөлбөр</td><td style="padding:10px;border:1px solid #e5e7eb;"><strong>Жилийн 5%</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">5 жил</td><td style="padding:10px;border:1px solid #e5e7eb;">1 жил хүртэл</td><td style="padding:10px;border:1px solid #e5e7eb;">Хоршооны үндсэн хөрөнгө</td></tr>\n<tr><td style="padding:10px;border:1px solid #e5e7eb;">Жимс, жимсгэний аж ахуй</td><td style="padding:10px;border:1px solid #e5e7eb;"><strong>Жилийн 3%</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">8 жил</td><td style="padding:10px;border:1px solid #e5e7eb;">3 жил хүртэл</td><td style="padding:10px;border:1px solid #e5e7eb;">Үндсэн + эргэлтийн хөрөнгө</td></tr>\n</tbody>\n</table>\n\n<blockquote style="border-left:4px solid #10b981;padding:12px 16px;background:#f0fdf4;margin:16px 0;">\n<strong>📊 Харьцуулалт:</strong> Банкны зээлийн хүү жилийн 18% үед 50 сая ₮-ийн зээлийн жилийн хүүний зардал <strong>9 сая ₮</strong> болно. ЖДҮ-ийн 3% хүүтэй тэр л зээлийн хүүний зардал зөвхөн <strong>1.5 сая ₮</strong> болно — жилд <strong>7.5 сая ₮</strong> хэмнэнэ.\n</blockquote>\n\n<h2>ЖДҮ сангийн санхүүжилтэнд тохирох 21 салбар</h2>\n<p>Засгийн газраас батлагдсан тэргүүлэх 21 салбарт хамаарвал хамгийн хямд хүүтэй зээл авах боломжтой. Гол чиглэлүүд:</p>\n<ul>\n<li>🌾 <strong>Хүлэмж, тариалан</strong> — ногоо, жимс, жимсгэнэ, мөөг, далдуу мод</li>\n<li>🐄 <strong>Мал аж ахуй</strong> — сүүний ферм, эрчимжсэн мал аж ахуй, шувуу аж ахуй</li>\n<li>🏭 <strong>Хүнс боловсруулах</strong> — гурил тээрэм, сүүн бүтээгдэхүүн, мах боловсруулалт</li>\n<li>🧵 <strong>Хөнгөн үйлдвэрлэл</strong> — оёдол, нэхмэл, ноос боловсруулалт</li>\n<li>🌿 <strong>Жимс, жимсгэний аж ахуй</strong> — нарийн нөхцөлтэй тусгай хөтөлбөр</li>\n<li>🏗️ <strong>Барилгын материал үйлдвэрлэл</strong></li>\n<li>♻️ <strong>Хог хаягдал боловсруулалт, дахин боловсруулалт</strong></li>\n<li>💊 <strong>Эм, эмнэлгийн хэрэгсэл үйлдвэрлэл</strong></li>\n</ul>\n\n<h2>ЖДҮ-д хандах алхам алхмаар гарын авлага</h2>\n\n<h3>Алхам 1: Бизнесийн аж ахуйн нэгжийн (ЖДҮ) тодорхойлолт авах</h3>\n<p>ЖДҮ-ийн тодорхойлолтыг <strong>burtgel.sme.gov.mn</strong> цахим системээр авна. Энэ тодорхойлолт нь таны аж ахуйн нэгж жижиг, дунд үйлдвэрт хамаарч байна гэсэн баталгаа юм. Шаардлага:</p>\n<ul>\n<li>Ажилчдын тоо: 200-с хэтрэхгүй байх</li>\n<li>Нийт хөрөнгийн хэмжээ: 1.5 тэрбум ₮-ноос хэтрэхгүй байх</li>\n<li>Жилийн борлуулалт: тодорхой хязгаараас хэтрэхгүй байх</li>\n</ul>\n\n<h3>Алхам 2: Тухайн жилийн зар хүлээх, хянах</h3>\n<p>ЖДҮ сан жил бүрийн 1–2 дугаар сард зар нийтэлж, 30 хоногийн хугацаанд төслийн материал хүлээн авдаг. <strong>sme.gov.mn</strong>-ийг байнга шалгаж, Facebook хуудсыг дагаж бай (facebook.com/SMEs.agency).</p>\n\n<h3>Алхам 3: Бичиг баримт бүрдүүлэх</h3>\n<p>Журмын дагуу бүрдүүлэх бичиг баримтууд:</p>\n<ul>\n<li>📋 <strong>Зээлийн өргөдөл</strong> (sme.gov.mn-ийн батлагдсан загвараар)</li>\n<li>📋 <strong>Бизнес төлөвлөгөө</strong> — санхүүгийн тооцоолол, зах зээлийн шинжилгээ бүхий</li>\n<li>📋 <strong>Аж ахуйн нэгжийн бүртгэлийн гэрчилгээ</strong></li>\n<li>📋 <strong>ЖДҮ-ийн тодорхойлолт</strong></li>\n<li>📋 <strong>Санхүүгийн тайлан</strong> (сүүлийн жилийн)</li>\n<li>📋 <strong>Татварын тодорхойлолт</strong></li>\n<li>📋 <strong>Барьцаа хөрөнгийн баримт</strong></li>\n<li>📋 <strong>Ажилчдын тоог нотлох баримт</strong> (нийгмийн даатгал)</li>\n</ul>\n\n<h3>Алхам 4: Цахим системд бүртгүүлж, хүсэлт илгээх</h3>\n<p><strong>sme.gov.mn</strong>-д бүртгүүлж, цахим системд нэвтэрч бичиг баримтаа хавсаргана. Зөвхөн цахимаар хүлээн авдаг тул биечлэн очих шаардлагагүй.</p>\n\n<h3>Алхам 5: Сонгон шалгаруулалтыг хүлээх</h3>\n<p>ЖДҮ-ийн мэргэжилтнүүд болон Хүнс, хөдөө аж ахуйн яамны төлөөлөгчдөөс бүрдсэн хороо <strong>1–2 сарын хугацаанд</strong> төслүүдийг шалгаруулна. Шалгуурууд:</p>\n<ul>\n<li>✅ Нийгмийн ач холбогдол — хэдэн ажлын байр бий болгох вэ?</li>\n<li>✅ Орон нутгийн хөгжилд нөлөө</li>\n<li>✅ Байгаль орчинд нөлөөлөл</li>\n<li>✅ Хүйсийн тэгш байдал (эмэгтэй менежерийн хувь)</li>\n<li>✅ Бизнесийн тогтвортой байдал</li>\n<li>✅ Санхүүгийн таамаглалын бодитой байдал</li>\n</ul>\n\n<h3>Алхам 6: Батлагдсан тохиолдолд — дамжуулагч банктай гэрээ байгуулах</h3>\n<p>ЖДҮ сан шууд зээл олгохгүй — харилцдаг арилжааны банкаараа дамжуулан зээлийг авна. Гэрээ байгуулж, зээлийн нөхцөлийг тогтоон, шилжүүлэлт хийгдэнэ.</p>\n\n<h2>ЖДҮ-ийн бизнес төлөвлөгөөнд банкнаасаа ялгаатай шаардагддаг зүйлс</h2>\n\n<p>ЖДҮ-ийн мэргэжилтнүүд санхүүгийн тооцооллоос гадна дараах зүйлсийг тусгайлан хардаг:</p>\n\n<ul>\n<li><strong>Ажлын байр:</strong> Тухайн төсөл хэдэн шинэ ажлын байр бий болгох вэ? Одоо хэдэн хүн ажиллаж байна, зээлийн дараа хэд болох вэ?</li>\n<li><strong>Орон нутгийн нөлөө:</strong> Аймаг, суманд байгаа бизнест давуу үнэлгээ өгнө. Нийслэлийн бизнесийн өрсөлдөөн өндөр.</li>\n<li><strong>Импорт орлуулах чадвар:</strong> Танай бүтээгдэхүүн гаднаас авчирч байсан зүйлийг орлуулах уу? Гүйцэтгэл нь өндөр үнэлгээтэй.</li>\n<li><strong>Экспортын боломж:</strong> Монголоос гаргаж болох бүтээгдэхүүн үйлдвэрлэх бол нэмэлт давуу тал.</li>\n</ul>\n\n<h2>Хэдий хэмжээний санхүүжилт авах боломжтой вэ?</h2>\n\n<p>2024 оны нийт санхүүжилт <strong>36.1 тэрбум ₮</strong> байсан ба 21 салбарт хуваагдсан. Нэг аж ахуйн нэгжид олгох хамгийн их хэмжээ хөтөлбөрт тусгагдана. Дунджаар нэг бизнест <strong>50–500 сая ₮</strong> санхүүжилт авах боломжтой.</p>\n\n<p>Хүлэмжийн аж ахуй, мал аж ахуй, оёдлын цехийн хувьд дундаж зээлийн хэмжээ 30–150 сая ₮ байдаг. Том үйлдвэр байгуулахад 300–500 сая ₮ хүртэл авах боломжтой.</p>\n\n<h2>ЖДҮ зээлд нийтлэг татгалздаг шалтгаанууд</h2>\n\n<ol>\n<li><strong>Бизнес төлөвлөгөө сул:</strong> Зах зээлийн судалгааны тоо нотлоогүй, санхүүгийн тооцоолол хэтэрхий өөдрөг эсвэл тодорхой бус</li>\n<li><strong>Ажлын байрны тоо хангалтгүй:</strong> Хэт автоматжсан, хүн цөөтэй бизнес мэс</li>\n<li><strong>Бизнес угаасаа аашигтай байдаг нотолгоо байхгүй:</strong> Тухайн салбарын орлогын бодит жишиг баримт хэрэгтэй</li>\n<li><strong>Хугацаа алдсан:</strong> 30 хоногийн хүлээн авах хугацааг алдах нь нийтлэг алдаа</li>\n<li><strong>Татварын өр:</strong> Татварын тодорхойлолтод өр байвал шууд татгалздаг</li>\n</ol>\n\n<h2>Нийслэлийн ЖДҮ — хотын оршин суугчдад тусдаа хөтөлбөр</h2>\n<p>Улаанбаатар хотын оршин суугчдад зориулсан <strong>Нийслэлийн Жижиг, Дунд Үйлдвэрлэлийг Дэмжих Төв (jdu.ub.gov.mn)</strong> тусдаа санхүүжилт олгодог. Хотын хэмжээнд жижиг дунд бизнесийг дэмжих тусгай хөтөлбөртэй.</p>\n\n<h2>ЖДҮ + DigitalGer: Сонгон шалгаруулалтад илүү өрсөлдөх</h2>\n<p>ЖДҮ-ийн сонгон шалгаруулалтад орлцож байгаа хэдэн зуун аж ахуйн нэгжийн дундаас шалгаран гарахын тулд бизнес төлөвлөгөөний чанар шийдвэрлэх үүрэгтэй. DigitalGer-ийн бэлэн бизнес төлөвлөгөөний загварт ЖДҮ-ийн шаардлагад нийцсэн нийгмийн нөлөөллийн үнэлгээ, ажлын байрны тооцоолол, байгаль орчины нөлөөлөл зэрэг хэсгүүд тусгагдсан байдаг. Загвараа ашигласнаар шаардлагатай бүх хэсгийг алдалгүй бүрдүүлнэ.</p>\n\n<p><strong>Холбоо барих:</strong> 7748-5555-1 | sme.gov.mn | Facebook: SMEs.agency</p>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/285c1655-5a56-4013-bbfe-6ce7e926d157.jpg	t	2025-07-15 00:00:00	{ЖДҮ,санхүүжилт,бизнес,зээл}	DigitalGer баг	2	2026-05-21 23:47:28.361	2026-05-23 12:27:41.18
cmpifzryx00017s5c54cajaqa	50/30/20 санхүүгийн дүрэм — Цалингаа зөв хуваарилах энгийн арга	50-30-20-sanhuugiin-durem	Цалинаа авмагц хэрхэн хуваарилах вэ? 50/30/20 дүрэм нь дэлхийд хамгийн өргөн хэрэглэгддэг санхүүгийн хуваарилалтын арга — Монгол амьдралд хэрхэн хэрэгжүүлэх тухай.	<h2>Яагаад ихэнх монгол цалин сарын эцэст дуусдаг вэ?</h2>\n<p>Монгол Улсын Үндэсний Статистикийн Хорооны 2025 оны мэдээллээр дундаж цалин <strong>2,479,600 төгрөг</strong> болж өссөн. Гэвч ихэнх монгол иргэн сарын эцэст мөнгө дуусаж хэцүүддэг — яагаад гэвэл тодорхой хуваарилалтын системгүй байдаг.</p>\n<p>50/30/20 дүрэм нь Харвардын профессор, АНУ-ын Сенатор Элизабет Уоррений бичсэн "All Your Worth" номноос гаралтай бөгөөд дэлхий даяар хэдэн арван сая хүн хэрэглэдэг хамгийн энгийн санхүүгийн аргачлал юм.</p>\n\n<h2>50/30/20 дүрэм яг юу вэ?</h2>\n<p>Цалингийнхаа цэвэр орлогыг (татвар суутгасны дараа) гурван хэсэгт хуваана:</p>\n\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:12px;text-align:left;">Хэсэг</th>\n      <th style="padding:12px;text-align:center;">Хувь</th>\n      <th style="padding:12px;text-align:left;">Юунд зарцуулах вэ</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Хэрэгцээ</strong></td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;font-size:1.2em;font-weight:bold;color:#1a3c8f;">50%</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Түрээс, хоол, нийтийн үйлчилгээ, тээвэр, эрүүл мэнд</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Хүсэл</strong></td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;font-size:1.2em;font-weight:bold;color:#e67e22;">30%</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Ресторан, кино, шопинг, аялал, хобби</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;"><strong>Хадгаламж / Зээл</strong></td>\n      <td style="padding:12px;text-align:center;font-size:1.2em;font-weight:bold;color:#27ae60;">20%</td>\n      <td style="padding:12px;">Хадгаламж, хөрөнгө оруулалт, зээлийн нэмэлт төлбөр</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Монгол цалинд хэрхэн тооцох вэ?</h2>\n<p>Жишээ: Дундаж цалин <strong>2,000,000 төгрөг</strong> авдаг ажилчин:</p>\n\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:10px;">Зүйл</th>\n      <th style="padding:10px;text-align:right;">Дүн (₮)</th>\n      <th style="padding:10px;text-align:left;">Жишээ зарцуулалт</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">50% — Хэрэгцээ</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;"><strong>1,000,000</strong></td>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Түрээс 600K + хоол 250K + тээвэр 150K</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">30% — Хүсэл</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;"><strong>600,000</strong></td>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Ресторан 200K + хувцас 200K + кино/цэнгэл 200K</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;">20% — Хадгаламж</td>\n      <td style="padding:10px;text-align:right;"><strong>400,000</strong></td>\n      <td style="padding:10px;">Банк 200K + МХБ хувьцаа 100K + яаралтай сан 100K</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>50% хэрэгцээнд юу ороно?</h2>\n<p><strong>Ороно:</strong> орон сууцны түрээс эсвэл ипотекийн төлбөр, хоол хүнс, нийтийн үйлчилгээ (цахилгаан, дулаан, ус), нийтийн тээвэр эсвэл машины зардал, эрүүл мэндийн даатгал, сургуулийн хэмжээ, харилцаа холбоо (утас, интернет).</p>\n<p><strong>Ороохгүй:</strong> Ресторан, кофе шоп, шопинг, цэнгэл — эдгээр нь "хүсэл"-д хамаарна.</p>\n\n<blockquote style="border-left:4px solid #27ae60;padding:15px 20px;background:#f0fff4;margin:20px 0;">\n  <strong>Чухал зөвлөгөө:</strong> Монголд орон сууцны түрээс хэтэрхий өндөр учир 50%-ийн хязгаарт багтаахад хэцүү байж болно. Энэ тохиолдолд 60/20/20 эсвэл 65/15/20 хувьтай эхэлж, аажмаар зохицуулах нь зүйтэй.\n</blockquote>\n\n<h2>20%-ийг яаж хуваарилах вэ?</h2>\n<p>20%-ийн хадгаламжийг дор хаяж гурван хэсэгт хуваах нь зөв:</p>\n<ol>\n  <li><strong>Яаралтай сан (Emergency Fund)</strong> — 3–6 сарын зарлагатай тэнцэх дүн. Ажлаа алдах, эрүүл мэндийн асуудал гарахад ашиглах.</li>\n  <li><strong>Хадгаламж</strong> — Тодорхой зорилготой (машин, орон сууц, аялал)</li>\n  <li><strong>Хөрөнгө оруулалт</strong> — МХБ хувьцаа, хадгаламжийн бонд эсвэл хөрөнгийн сан</li>\n</ol>\n\n<h2>Хэрэв хэрэгцээ 50%-иас хэтэрвэл яах вэ?</h2>\n<p>Монгол хотхоны түрээс өндөр байдаг тул ихэнх залуу хүмүүст 50% хангалтгүй байдаг. Үүнийг шийдэх хэд хэдэн арга байна:</p>\n<ul>\n  <li><strong>Хамтрагчтай түрээслэх</strong> — зардлыг хуваах</li>\n  <li><strong>Орон сууцаа шилжүүлэх</strong> — цалинтай тохирох бүс нутаг хайх</li>\n  <li><strong>Нэмэлт орлого нэмэх</strong> — фриланс, хавсарга ажил хийх</li>\n  <li><strong>Хэрэгцээний зардалаа бууруулах</strong> — тогтмол зардлаа хянах</li>\n</ul>\n\n<h2>Амжилттай хэрэгжүүлэх 3 дадал</h2>\n<ol>\n  <li><strong>Цалин авмагцаа автоматаар хуваарил</strong> — өөр дансанд 20%-ийг шууд шилжүүл</li>\n  <li><strong>Сарын эцэст тооцоо хар</strong> — ямар категорид хэт зарцуулав?</li>\n  <li><strong>3 сарт нэг удаа дүгнэлт хий</strong> — тохируулга хийж сайжруул</li>\n</ol>\n\n<h2>Дүгнэлт</h2>\n<p>50/30/20 дүрэм нь санхүүгийн мэдлэг дутмаг байсан ч шууд эхлүүлж болох хамгийн энгийн арга юм. Монгол иргэдийн дундаж цалин 2.5 сая төгрөгт хүрсэн энэ үед зөв хуваарилалт хийх нь тань ирээдүйн санхүүгийн эрх чөлөөг тодорхойлно. Цалин авсан тэр өдрөөсөө эхлэ — яах вэ, юу алдах вэ?</p>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/669aea18-8d28-4dff-85af-67e40374f015.jpg	t	2025-01-27 00:00:00	{"хувийн санхүү",50/30/20,төсөв,цалин,хадгаламж}	DigitalGer	8	2026-05-23 14:27:03.129	2026-05-23 14:53:01.873
cmpifzs0c00027s5caryuist8	Ипотекийн зээл авах бүрэн гарын авлага — 6%-ийн хөтөлбөрөөс эхлэн	ipotekiin-zeel-avah-guide	Монголд орон сууц авах хамгийн алдартай арга — ипотекийн зээл. 6%-ийн засгийн газрын хөтөлбөр, шаардлага, алхам алхмаар бүрдүүлэх материал, тооцооллыг бүрэн тайлбарлав.	<h2>Ипотекийн зээл гэж юу вэ?</h2>\n<p>Ипотекийн зээл нь орон сууц буюу үл хөдлөх хөрөнгийг барьцаалан авах урт хугацааны зээл юм. Монголд засгийн газар болон Монголбанкны хамтарсан <strong>6%-ийн ипотекийн хөтөлбөр</strong> нь иргэдэд хамгийн хүртээмжтэй орон сууц худалдан авах боломж олгодог.</p>\n\n<p>2026 оны 2 дугаар сарын байдлаар орон сууцны ипотекийн зээлийн дундаж хүү <strong>6.5%</strong> байна — энэ нь арилжааны банкны 13–18%-тай харьцуулахад асар их хэмнэлт юм.</p>\n\n<h2>6%-ийн ипотекийн хөтөлбөр</h2>\n<p>Засгийн газрын дэмжлэгтэй 6%-ийн хөтөлбөр нь дараах онцлогтой:</p>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:12px;text-align:left;">Үзүүлэлт</th>\n      <th style="padding:12px;text-align:left;">Нөхцөл</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Жилийн хүү</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>6%</strong></td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Зээлийн хэмжээ</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Хамгийн их 240 сая ₮</strong></td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Зээлийн хугацаа</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Хамгийн их 20 жил</strong></td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Урьдчилгаа төлбөр</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Үнийн дүнгийн 30% (LTV 70%)</strong></td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Орлогын харьцаа</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Сарын зээлийн төлбөр орлогын 45%-иас хэтрэхгүй</strong></td>\n    </tr>\n    <tr>\n      <td style="padding:12px;">Хамрагдах нөхцөл</td>\n      <td style="padding:12px;">Урьд нь ипотек аваагүй, хугацаа хэтэрсэн зээлгүй</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Хэн авч болох вэ? — Шалгуур нөхцөл</h2>\n<ul>\n  <li>Монгол Улсын иргэн, 18 насанд хүрсэн</li>\n  <li>Урьд нь ипотекийн болон нийгмийн орон сууцны хөтөлбөрт хамрагдаагүй байх</li>\n  <li>Ямар нэгэн санхүүгийн байгууллагад хугацаа хэтэрсэн зээлгүй байх</li>\n  <li>Тогтмол орлоготой, нийгмийн даатгалд бүртгэлтэй байх</li>\n  <li>Сарын орлого нь зээлийн төлбөрийн хоёр дахин болох</li>\n</ul>\n\n<h2>Шаардлагатай бичиг баримт</h2>\n<ol>\n  <li>Иргэний үнэмлэхний хуулбар</li>\n  <li>Оршин суугаа газрын бүртгэлийн тодорхойлолт</li>\n  <li>Нийгмийн даатгалын дэвтэр (сүүлийн 12 сарын)</li>\n  <li>Цалингийн тодорхойлолт (ажлын газраас, 3–6 сарын)</li>\n  <li>Татварын тодорхойлолт (ХХОАТ-ын)</li>\n  <li>Гэрлэлтийн гэрчилгээ (хамтран зээл авах тохиолдолд)</li>\n  <li>Худалдан авах орон сууцны гэрчилгээ, кадастрын зургийн хуулбар</li>\n  <li>Орон сууцны үнэлгээний акт (банкны зөвшөөрсөн үнэлгээний компаниас)</li>\n</ol>\n\n<h2>Алхам алхмаар процесс</h2>\n\n<h3>1-р алхам: Урьдчилсан зөвшөөрөл авах</h3>\n<p>Банкинд очоод зээлийн урьдчилсан зөвшөөрөл (pre-approval) авна. Энэ шатанд цалингийн тодорхойлолт, НД-ийн дэвтрийг авчирч, хэдий хэмжээний зээл авах боломжтойгоо тодруулна. Хугацаа: <strong>3–5 ажлын өдөр</strong>.</p>\n\n<h3>2-р алхам: Орон сууц сонгох</h3>\n<p>Зах зээл дээр 6%-ийн хөтөлбөрт хамрагдах орон сууцнуудаас сонгоно. Банкинд бүртгэлтэй барилгын компаниудын орон сууц л зээлд тохирно — банкнаасаа урьдчилан лавлах хэрэгтэй.</p>\n\n<h3>3-р алхам: Үнэлгээ хийлгэх</h3>\n<p>Банкны зөвшөөрсөн үнэлгээний компаниар орон сууцнаа үнэлүүлнэ. Зардал: <strong>150,000–300,000 ₮</strong>. Хугацаа: 2–3 ажлын өдөр.</p>\n\n<h3>4-р алхам: Зээлийн өргөдөл гаргах</h3>\n<p>Бүх баримт бичгийг бүрдүүлж банкинд өргөдөл гаргана. Банк зээлийн шийдвэр гаргахад <strong>7–14 ажлын өдөр</strong> шаардана.</p>\n\n<h3>5-р алхам: Гэрээ байгуулах</h3>\n<p>Зээл батлагдсаны дараа банктай зээлийн гэрээ, барьцааны гэрээ байгуулна. Нотариатаар гэрчлүүлнэ. Урьдчилгаа төлбөрийг худалдагчид төлнө.</p>\n\n<h3>6-р алхам: Улсын бүртгэлд бүртгүүлэх</h3>\n<p>Өмчлөх эрхийг шилжүүлэх — улсын бүртгэлийн газарт бүртгүүлж гэрчилгээ авна. Хугацаа: 3–5 ажлын өдөр.</p>\n\n<h2>Практик тооцоолол: 150 сая төгрөгийн зээл</h2>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:10px;">Үзүүлэлт</th>\n      <th style="padding:10px;text-align:right;">Дүн</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Орон сууцны үнэ</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">214,000,000 ₮</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Урьдчилгаа (30%)</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">64,200,000 ₮</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Зээлийн дүн</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">150,000,000 ₮</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хүү (жилийн 6%)</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">6%</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Хугацаа</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">20 жил</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Сарын төлбөр</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;"><strong>~1,074,643 ₮</strong></td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;">Нийт төлбөр (20 жилд)</td>\n      <td style="padding:10px;text-align:right;"><strong>~257,914,320 ₮</strong></td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Хамтран зээл авах давуу тал</h2>\n<p>Гэр бүл нийлж хамтарсан орлогоор зээл авах нь их дүнтэй зээл авах боломжийг нэмэгдүүлдэг. Жишээлбэл, нэг хүний цалин 1,500,000 ₮ бол зөвхөн ~800,000 ₮-ийн сарын төлбөр тэнцүүлнэ. Хоёулаа нийлбэл 3,000,000 ₮ орлоготой тул ~1,350,000 ₮ хүртэлх сарын төлбөрийг тэнцүүлэх боломжтой болно.</p>\n\n<h2>Зөвлөгөө: Зээлийн өмнө бэлтгэл хийх</h2>\n<ul>\n  <li>Зээлийн түүхийг цэвэрлэ — Хэрэв хугацаа хэтэрсэн зээл байвал эхлэж барагдуул</li>\n  <li>НД-ийн дэвтрийг тасалдалгүй хадгал — 12 сарын тасралтгүй бүртгэл чухал</li>\n  <li>Урьдчилгааг урьдчилан бэлтгэ — 30%-ийн урьдчилгааг хэдэн жилийн хугацаанд хуримтлуул</li>\n  <li>Нэмэлт зардал тооцоо — үнэлгээ, нотариат, бүртгэлийн хөлс нийтдээ 1–3 сая ₮</li>\n</ul>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/6e1f72fe-88df-4c6e-8a3e-2baa9c377860.jpg	t	2025-02-03 00:00:00	{ипотек,"орон сууц",зээл,банк,"6 хувь"}	DigitalGer	9	2026-05-23 14:27:03.181	2026-05-23 14:53:11.2
cmpifzs1s00037s5ct9tpdtx8	ХХК байгуулах дэлгэрэнгүй заавар — 2025 оны шинэчилсэн алхамууд	hhk-baiguulah-zaavar	Хязгаарлагдмал хариуцлагатай компани (ХХК) хэрхэн байгуулах вэ? Улсын бүртгэлийн газар, шаардлагатай баримт, хугацаа, зардал — бүрэн тайлбарласан гарын авлага.	<h2>ХХК гэж юу вэ, яагаад сонгох вэ?</h2>\n<p>Хязгаарлагдмал хариуцлагатай компани (ХХК) нь Монголд хамгийн түгээмэл хэлбэрийн хуулийн этгээд юм. 2025 оны байдлаар Монгол Улсад бүртгэлтэй нийт аж ахуйн нэгжийн <strong>70% гаруй</strong> нь ХХК хэлбэртэй байдаг.</p>\n\n<h3>ХХК-ийн давуу тал</h3>\n<ul>\n  <li><strong>Хязгаарлагдмал хариуцлага</strong> — Компанийн өр төлбөрт хувийн эд хөрөнгө хариуцахгүй (зөвхөн оруулсан хөрөнгийн хэмжээгээр)</li>\n  <li><strong>Нэг хүнд боломжтой</strong> — Ганцаараа ч ХХК байгуулж болно</li>\n  <li><strong>Гэрээ байгуулах, банкны данс нээх</strong> — Хуулийн этгээдийн нэрийн өмнөөс үйл ажиллагаа явуулна</li>\n  <li><strong>Итгэл найдвар</strong> — Харилцагч нар ХХК-тай ажиллахыг илүүд үздэг</li>\n</ul>\n\n<h2>ХХК байгуулахад шаардагдах нөхцөл</h2>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:12px;text-align:left;">Шаардлага</th>\n      <th style="padding:12px;text-align:left;">Дэлгэрэнгүй</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Үүсгэн байгуулагч</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">1–50 хүн (хуулийн этгээд ч байж болно)</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Хамгийн бага дүрмийн сан</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Дотоодын ХХК-д заавал бус (хуулиар тогтоогдоогүй)</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Гадаад хөрөнгө оруулагч</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">100,000 USD/хувьцаа эзэмшигч бүр</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Хаяг</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Монгол дахь хуулийн хаяг шаардлагатай</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;">Гүйцэтгэх захирал</td>\n      <td style="padding:12px;">Монгол иргэн байх шаардлагагүй</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Алхам 1: Компанийн нэр захиалах</h2>\n<p>Улсын Бүртгэлийн Ерөнхий Газрын (УБЕГ) цахим системд нэвтэрч, компанийн нэрийн бүртгэл хийнэ. Нэр нь:</p>\n<ul>\n  <li>Кирилл үсгээр байх ёстой</li>\n  <li>Аль хэдийн бүртгэлтэй нэртэй давхцахгүй байх</li>\n  <li>Улс, Монгол, засгийн газар гэх мэт үгс орохгүй (тусгай зөвшөөрөлгүйгээр)</li>\n</ul>\n<p>Нэр баталгаажсаны дараа <strong>30 хоногийн дотор</strong> компанийг бүртгүүлэх шаардлагатай, эс тэгвэл хугацаа дуусна.</p>\n\n<h2>Алхам 2: Дүрэм боловсруулах</h2>\n<p>ХХК-ийн дүрэм нь компанийн үндсэн баримт бичиг юм. Дүрэмд заавал тусгах зүйлс:</p>\n<ul>\n  <li>Компанийн нэр, хаяг</li>\n  <li>Үйл ажиллагааны чиглэл (ААНБ-ийн ангилалтай нийцүүлэн)</li>\n  <li>Дүрмийн сангийн хэмжээ</li>\n  <li>Хувьцаа эзэмшигчдийн бүтэц, эрх</li>\n  <li>Удирдлагын бүтэц (захирлын бүрэн эрх гэх мэт)</li>\n</ul>\n<p>Хуульч эсвэл нотариатаар хийлгэх боломжтой — зардал <strong>50,000–200,000 ₮</strong> байдаг.</p>\n\n<h2>Алхам 3: Шаардлагатай баримт бичиг бүрдүүлэх</h2>\n<ol>\n  <li>ХХК байгуулах тухай үүсгэн байгуулагчдын шийдвэр (протокол)</li>\n  <li>Компанийн дүрэм (2 хувь)</li>\n  <li>Үүсгэн байгуулагч нарын иргэний үнэмлэхний хуулбар</li>\n  <li>Хуулийн хаягийн гэрчилгээ (байрны гэрэлтгэлийн гэрчилгээ эсвэл байр ашиглалтын гэрээ)</li>\n  <li>Бүртгэлийн хураамж төлсөн баримт</li>\n</ol>\n\n<h2>Алхам 4: УБЕГ-т бүртгүүлэх</h2>\n<p>Бичиг баримтаа бүрдүүлж УБЕГ-т (эсвэл цахимаар burtgel.mn сайтаар) өргөдөл гаргана.</p>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:10px;">Бүртгэлийн хугацаа</th>\n      <th style="padding:10px;text-align:right;">Хураамж</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Энгийн (7 ажлын өдөр)</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">50,000 ₮</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Яаралтай (3 ажлын өдөр)</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">100,000 ₮</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;">Маш яаралтай (1 ажлын өдөр)</td>\n      <td style="padding:10px;text-align:right;">150,000 ₮</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Алхам 5: Татварын бүртгэл</h2>\n<p>УБЕГ-ийн гэрчилгээ авмагцаа <strong>ажлын 10 өдрийн дотор</strong> харьяа татварын хэлтэст бүртгүүлэх шаардлагатай. Татварын бүртгэл хийж, НӨАТ-ын бүртгэлийн асуудлыг тодруулна:</p>\n<ul>\n  <li>НӨАТ-д заавал бүртгүүлэх шалгуур: жилийн борлуулалт <strong>50 сая ₮</strong>-иас дээш байвал</li>\n  <li>Ажилчидтай бол цалин хөлсний татвар суутгах үүрэгтэй</li>\n</ul>\n\n<h2>Алхам 6: Нийгмийн даатгалын бүртгэл</h2>\n<p>НД-д харьяа байрлалаас хамаарч дүүргийн НД-ийн хэлтэст бүртгүүлнэ. Ажилтан авсан бол <strong>ажил эхэлсэнөөс 7 хоногийн дотор</strong> бүртгэх ёстой.</p>\n\n<h2>Алхам 7: Банкны данс нээх</h2>\n<p>Бүртгэлийн гэрчилгээ, дүрэм, захирлын иргэний үнэмлэхтэйгээр банкинд хуулийн этгээдийн данс нээнэ. Ихэнх банк <strong>1–3 ажлын өдрийн дотор</strong> данс нээдэг.</p>\n\n<h2>Нийт зардлын тооцоолол</h2>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:10px;">Зардлын зүйл</th>\n      <th style="padding:10px;text-align:right;">Дүн (₮)</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">УБЕГ-ийн бүртгэлийн хураамж</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">50,000–150,000</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Нотариатын зардал</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">30,000–80,000</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Дүрэм боловсруулах (хуульч)</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">50,000–200,000</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Тамга хийлгэх</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">20,000–50,000</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;font-weight:bold;">Нийт дүн</td>\n      <td style="padding:10px;text-align:right;font-weight:bold;">150,000–480,000 ₮</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>ХХК байгуулсны дараах үүрэг</h2>\n<ul>\n  <li><strong>Улирлын тайлан</strong> — 3 сар тутамд татварын тайлан гаргана</li>\n  <li><strong>Жилийн тайлан</strong> — жилийн эцэст санхүүгийн тайлан гаргана</li>\n  <li><strong>УБЕГ-т мэдэгдэх</strong> — захирал, хаяг, дүрмийн өөрчлөлтийг 30 хоногийн дотор бүртгүүлнэ</li>\n  <li><strong>НД тайлан</strong> — сар бүр ажилчдын НД тайлан гаргана</li>\n</ul>\n\n<blockquote style="border-left:4px solid #1a3c8f;padding:15px 20px;background:#f0f4ff;margin:20px 0;">\n  <strong>Зөвлөгөө:</strong> ХХК байгуулах нийт процесс одоо онлайнаар (burtgel.mn, e-mongolia.mn) хийх боломжтой болсон. Цахимаар бүртгэх нь хугацааг эрс багасгана.\n</blockquote>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/0c9844e6-6c15-4fe3-bf13-bee0aa10364c.jpg	t	2025-02-10 00:00:00	{ХХК,"компани байгуулах",бизнес,бүртгэл,эрхлэгч}	DigitalGer	10	2026-05-23 14:27:03.232	2026-05-23 14:53:21.064
cmpifzs3300047s5cwwzavla4	Фрилансерийн татвар — Монгол фрилансер хэрхэн татвараа зөв төлөх вэ	frilanseriin-tatvar-guide	Фриланс ажил хийж цалин авдаг ч татвараа мэдэхгүй? Монголд фрилансерт хамаарах татварын хуулиуд, тайлан гаргах арга, оновчлолын боломжуудыг тайлбарлав.	<h2>Монголд фриланс хийхэд татвар хамаарах уу?</h2>\n<p>Тийм — Монголд орлого олох бүр татварт хамаарна. Фриланс, туслах ажил, онлайн платформоор (Upwork, Fiverr, YouTube гэх мэт) орлого олох бүх орлогод <strong>Хувь хүний орлогын албан татвар (ХХОАТ)</strong> ногдоно. Гэвч ихэнх фрилансер татвараа огт төлдөггүй — энэ нь цаашид торгуулийн эрсдэлтэй.</p>\n\n<h2>Монголын татварын тогтолцоо — Фрилансерт хамаарах хэсэг</h2>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:12px;text-align:left;">Орлогын төрөл</th>\n      <th style="padding:12px;text-align:center;">Татварын хувь</th>\n      <th style="padding:12px;text-align:left;">Тайлбар</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Цалин хөлс (ажлын гэрээтэй)</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;"><strong>10%</strong></td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Ажил олгогч суутгадаг</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Үйлчилгээний орлого (фриланс)</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;"><strong>10%</strong></td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Өөрөө тайлагнах</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Хөрөнгө оруулалтын орлого</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;"><strong>10%</strong></td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Ногдол ашиг, хүүгийн орлого</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;">Эд хөрөнгийн орлого</td>\n      <td style="padding:12px;text-align:center;"><strong>10%</strong></td>\n      <td style="padding:12px;">Орон сууцны түрээсийн орлого</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Фрилансер татвараа хэрхэн төлөх вэ?</h2>\n<p>Монголд фрилансер ажил хийхдээ хоёр аргаар татвараа барагдуулж болно:</p>\n\n<h3>Арга 1: Хувиараа эрхлэгчээр бүртгүүлэх</h3>\n<p>Хамгийн хялбар арга — татварын хэлтэст хувиараа эрхлэгчээр бүртгүүлэх. Бүртгэлийн дараа:</p>\n<ul>\n  <li>Улирал тутам (3 сар тутам) татварын тайлан гаргана</li>\n  <li>Орлогынхоо 10%-ийг ХХОАТ болгон төлнө</li>\n  <li>Нийгмийн даатгалд сайн дурын үндсэн дээр хамрагдаж болно</li>\n</ul>\n\n<h3>ХХК байгуулж ажиллах</h3>\n<p>Орлого томорвол ХХК байгуулж, аж ахуйн нэгжийн орлогын татвар (ААН ОТ) — 10% эсвэл нэг доголт татварын дэглэм ашиглах боломжтой.</p>\n\n<h2>Нэг доголт татвар (patent) гэж юу вэ?</h2>\n<p>Жилийн орлого <strong>50 сая ₮</strong>-иас хэтрэхгүй жижиг үйл ажиллагаа эрхлэгчид "нэг доголт татвар" (патент) ашиглаж болно. Энэ нь татварын тайланд ороогүйгээр сар бүр тогтсон дүн төлдөг тогтолцоо юм.</p>\n\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:10px;">Үйл ажиллагааны төрөл</th>\n      <th style="padding:10px;text-align:right;">Сарын патентийн дүн</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">IT, дизайн, онлайн үйлчилгээ</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">~15,000–25,000 ₮</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Орчуулга, бичгийн ажил</td>\n      <td style="padding:10px;text-align:right;border-bottom:1px solid #dee2e6;">~10,000–20,000 ₮</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;">Зөвлөх үйлчилгээ</td>\n      <td style="padding:10px;text-align:right;">~20,000–30,000 ₮</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Гадаадаас орлого авах тохиолдолд</h2>\n<p>Upwork, Fiverr, YouTube, Patreon гэх мэт гадаадын платформоос орлого авч байгаа бол:</p>\n<ul>\n  <li>Монгол банкны дансанд орсон мөнгөнд <strong>Монголын хуулийн дагуу 10% ХХОАТ</strong> хамаарна</li>\n  <li>Зарим платформ (YouTube, Google) гадаадын татварыг суутгадаг — давхар татвараас зайлсхийх гэрээ байдаг тул шалгах хэрэгтэй</li>\n  <li>Гадаадын мөнгө хүлээн авах үед банк гарал үүслийг нотлох баримт шаардаж болно</li>\n</ul>\n\n<h2>Татвар төлөхгүй бол яах вэ?</h2>\n<p>Монголын Татварын ерөнхий газар сүүлийн жилүүдэд дижитал орлого мөрдөн шалгах чадавхиа нэмэгдүүлсэн. Татвараа төлөхгүйн үр дагавар:</p>\n<ul>\n  <li>Хугацаа хэтэрсэн татвар дээр <strong>сар бүр 0.1%</strong> торгуулийн хүү</li>\n  <li>Их дүн болвол эрүүгийн хариуцлагад татагдах боломжтой</li>\n  <li>Зээл, ипотек авах, гадаадад гарах зэрэгт саад болж болно</li>\n</ul>\n\n<blockquote style="border-left:4px solid #e74c3c;padding:15px 20px;background:#fff5f5;margin:20px 0;">\n  <strong>Анхааруулга:</strong> 2024 оноос банкны дансны хөдөлгөөнийг татварын алба шууд харах боломжтой болсон. "Мэдэхгүй" гэдэг нь хамгаалалт биш.\n</blockquote>\n\n<h2>Татварын зардлыг хэрхэн оновчтой болгох вэ?</h2>\n<ol>\n  <li><strong>Зардлаа баримтжуул</strong> — Ажилд шаардлагатай зардал (компьютер, интернет, програм хангамж) татварын суурийг бууруулна</li>\n  <li><strong>Хувиараа эрхлэгчээр бүртгүүл</strong> — Хэрэв бүртгэлгүй байвал аль болох хурдан бүртгүүлэх</li>\n  <li><strong>Данс тусгаарла</strong> — Ажлын орлогыг хувийн зарлагаас тусад нь данс хөтөл</li>\n  <li><strong>Нягтлан бодогчтой зөвлөл</strong> — Орлого өсөхийн хэрээр мэргэжлийн нягтлан авах нь хэмнэлттэй</li>\n</ol>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/827b6e7b-afe0-4ba4-9745-c49568be2487.jpg	t	2025-02-17 00:00:00	{фриланс,татвар,ХХОАТ,хувиараа,"онлайн ажил"}	DigitalGer	11	2026-05-23 14:27:03.279	2026-05-23 14:53:30.341
cmpifzs4f00057s5cq8oq13p3	Ажлын гэрээнд заавал анхаарах 7 заалт — Эрхээ мэдэж байгаарай	ajliin-gereenii-7-zaalt	Ажлын гэрээ гарын үсэг зурахаасаа өмнө юуг анхаарах вэ? Монголын Хөдөлмөрийн хуульд тулгуурлан, ажилчдын эрхийг хамгаалах 7 чухал заалтыг задлан тайлбарлав.	<h2>Яагаад ажлын гэрээ чухал вэ?</h2>\n<p>Монголын Хөдөлмөрийн тухай хуулийн дагуу ажил олгогч нь ажлын гарааны эхний <strong>10 хоногийн дотор</strong> бичгийн хэлбэрийн ажлын гэрээ байгуулах үүрэгтэй. Гэвч практикт олон ажилтан гэрээгээ уншилгүй гарын үсэг зурдаг — энэ нь ирээдүйд маш том хохирол болдог.</p>\n<p>2024 оны Хөдөлмөрийн маргааны комиссын тайланд дурдсанаар нийт маргааны <strong>63%</strong> нь ажлын гэрээний тодорхой бус болон дутуу заалтаас үүсдэг байна.</p>\n\n<h2>1-р заалт: Ажлын байрны тодорхойлолт</h2>\n<p>Гэрээнд таны хийх ажлын <strong>тодорхой жагсаалт</strong> байх ёстой. "Бусад ажил хийх" гэсэн ерөнхий заалт нь таныг дур мэдэн ямар ч ажилд оруулах боломж олгодог.</p>\n\n<p><strong>Анхаарах асуулт:</strong></p>\n<ul>\n  <li>Ажлын байрны нэр тодорхой байна уу?</li>\n  <li>Үндсэн үүрэг чиглэл бичигдсэн үү?</li>\n  <li>"Гэрээнд зааснаас бусад ажил" хийлгэж болохгүй байх нөхцөл байна уу?</li>\n</ul>\n\n<h2>2-р заалт: Цалин, нэмэгдэл, урамшуулал</h2>\n<p>Цалин нь гэрээнд <strong>тоо хэмжээгээр (төгрөгөөр)</strong> тусгагдсан байх ёстой. "Сайн ажиллавал нэмнэ", "сарын орлогоос хамаарна" гэсэн тодорхойгүй томьёолол хүлээн зөвшөөрч болохгүй.</p>\n\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:12px;text-align:left;">Зүйл</th>\n      <th style="padding:12px;text-align:left;">Хуулийн шаардлага</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Хамгийн бага цалин (2025)</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>792,000 ₮/сар</strong> (2025.04.01-ээс)</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Цалин олгох хугацаа</td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Сард нэгдэл дээр 2 удаа (хуулийн заавал)</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;">Илүү цагийн нэмэгдэл</td>\n      <td style="padding:12px;">Цагийн тарифын 1.5 дахин</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>3-р заалт: Ажлын цаг, амралт</h2>\n<p>Монголын Хөдөлмөрийн хуулиар:</p>\n<ul>\n  <li>Долоо хоногт <strong>40 цаг</strong> (өдөрт 8 цаг) — хэвийн ажлын цаг</li>\n  <li>Долоо хоногт 56 цагаас дээш ажиллуулж <strong>болохгүй</strong></li>\n  <li>Жилийн үндсэн чөлөө: <strong>15 ажлын өдөр</strong> (ажилласан жилийн тоогоор нэмэгдэнэ)</li>\n  <li>Эмэгтэйчүүдийн жирэмсний чөлөө: <strong>120 хоног</strong></li>\n</ul>\n\n<blockquote style="border-left:4px solid #f39c12;padding:15px 20px;background:#fffbf0;margin:20px 0;">\n  <strong>Анхааруулга:</strong> "Хагас цагаар ажиллах" гэж бичигдсэн байгаа ч бодитоор бүтэн цагаар ажиллуулдаг тохиолдол нийтлэг. Гэрээнд ажлын цагаа тодорхой заалга.\n</blockquote>\n\n<h2>4-р заалт: Туршилтын хугацаа</h2>\n<p>Хуулиар туршилтын хугацаа <strong>3 сараас хэтрэх</strong> ёсгүй (тусгай мэргэшил шаардсан ажилд 6 сар хүртэл). Туршилтын хугацаанд:</p>\n<ul>\n  <li>Хамгийн бага цалингаас доош цалин өгч <strong>болохгүй</strong></li>\n  <li>Туршилтаар тэнцэхгүй гэж үзвэл <strong>3 хоногийн</strong> мэдэгдэл өгөх ёстой</li>\n  <li>Туршилтын хугацааг давтан тогтоож <strong>болохгүй</strong></li>\n</ul>\n\n<h2>5-р заалт: Гэрээ цуцлах нөхцөл</h2>\n<p>Ажил олгогч гэрээг цуцлахдаа хуулийн заавал журмыг дагах ёстой:</p>\n<ul>\n  <li><strong>Мэдэгдлийн хугацаа:</strong> Ихэвчлэн 30 хоног урьдчилж мэдэгдэх</li>\n  <li><strong>Тэтгэмж:</strong> Ажилд орсон жилийн тооноос хамаарч нэг сараас дээш цалинтай тэнцэх тэтгэмж</li>\n  <li><strong>Хууль бус халалт:</strong> Шүүхэд гомдол гаргах, ажилдаа эргэж орох эрхтэй</li>\n</ul>\n\n<h2>6-р заалт: Өрсөлдөхгүй байх нөхцөл (Non-compete)</h2>\n<p>Монголын хуулиар өрсөлдөхгүй байх нөхцөл хүчинтэй байхын тулд:</p>\n<ul>\n  <li>Хугацаа: Ажлаас гарснаас хойш <strong>1 жилээс хэтрэхгүй</strong></li>\n  <li>Ажил олгогч нь хязгаарлалтын хугацаанд сарын цалингийн <strong>доод тал 50%-ийг</strong> төлөх ёстой</li>\n  <li>Хэт өргөн хүрээтэй (жишээ: бүх салбар, бүх улс) нөхцөл шүүхэд хүчингүй болдог</li>\n</ul>\n\n<h2>7-р заалт: Нийгмийн даатгал, эрүүл мэндийн даатгал</h2>\n<p>Ажил олгогч <strong>заавал</strong> дараах даатгалыг хариуцах ёстой:</p>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:10px;">Даатгалын төрөл</th>\n      <th style="padding:10px;text-align:center;">Ажилтан</th>\n      <th style="padding:10px;text-align:center;">Ажил олгогч</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Тэтгэврийн даатгал</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">7%</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">7%</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Эрүүл мэндийн даатгал</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">2%</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">2%</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:10px;border-bottom:1px solid #dee2e6;">Ажилгүйдлийн даатгал</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">0.5%</td>\n      <td style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">0.5%</td>\n    </tr>\n    <tr>\n      <td style="padding:10px;">Үйлдвэрлэлийн осол</td>\n      <td style="padding:10px;text-align:center;">—</td>\n      <td style="padding:10px;text-align:center;">0.4–1%</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Гэрээнд гарын үсэг зурахын өмнөх 5 асуулт</h2>\n<ol>\n  <li>Цалин маань тоогоор бичигдсэн үү?</li>\n  <li>Туршилтын хугацаа хэдэн сар вэ?</li>\n  <li>Илүү цагийн нэмэгдэл яаж тооцох вэ?</li>\n  <li>Гэрээ цуцалвал юу болох вэ?</li>\n  <li>НД, ЭМД маань бүртгэгдэх үү?</li>\n</ol>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/1ae1a1e0-15b2-44c7-bfd7-8dd1e6db32a0.jpg	t	2025-02-24 00:00:00	{"ажлын гэрээ","хөдөлмөрийн хууль","ажилчны эрх",цалин,гэрээ}	DigitalGer	12	2026-05-23 14:27:03.327	2026-05-23 14:53:43.229
cmpifzs5t00067s5cl25g6mda	ChatGPT болон AI-г бизнесдээ хэрхэн ашиглах вэ — Монгол жишиг	chatgpt-ai-biznesed-ashiglah	Дэлхийн Fortune 500 компаниудын 92% ChatGPT ашиглаж байна. Монголын жижиг бизнест AI хэрхэн цаг хугацаа, зардал хэмнэж, ажлын бүтээмжийг нэмэгдүүлэх тухай бодит жишээнүүд.	<h2>AI дэлхийн бизнесийг хэрхэн өөрчилж байна вэ?</h2>\n<p>2025 оны байдлаар ChatGPT долоо хоногт <strong>800 сая идэвхтэй хэрэглэгчтэй</strong> болсон бөгөөд Fortune 500 компаниудын <strong>92%</strong> ChatGPT ашиглаж байна. Дэлхийн аж ахуйн нэгжүүдийн <strong>78%</strong> нь AI-г дор хаяж нэг бизнесийн функцдээ нэвтрүүлсэн.</p>\n\n<p>Монгол жижиг бизнесүүд ч гэсэн AI-г хэрэглэж <strong>40% хүртэл бүтээмжийн өсөлт</strong> авч болно. Хэрхэн эхлэх тухай ярилцья.</p>\n\n<h2>Монгол бизнест хамгийн хэрэгтэй AI хэрэглээнүүд</h2>\n\n<h3>1. Контент бичих, маркетинг</h3>\n<p>Сошиал медиад байнга контент гаргах шаардлагатай байдаг. ChatGPT-ийн тусламжтайгаар:</p>\n<ul>\n  <li>Facebook, Instagram пост бичих — 5 минутын дотор 10 постын санаа гаргах</li>\n  <li>Бүтээгдэхүүний тайлбар (product description) бичих</li>\n  <li>Имэйл кампейн бэлтгэх</li>\n  <li>Блог нийтлэл боловсруулах (энэ нийтлэл шиг!)</li>\n</ul>\n\n<p><strong>Хэмнэлт:</strong> Мэргэжлийн маркетерт сард 1–2 сая ₮ цалин өгөх биш, ChatGPT Plus-т <strong>сард ~45,000 ₮</strong> (20 USD) төлж ижил ажил хийж болно.</p>\n\n<h3>2. Харилцагчийн үйлчилгээ автоматжуулах</h3>\n<p>Monpay, Shopify, нөхцөл байдлаар chatbot суулгаж нийтлэг асуулт хариулах автомат систем байгуулна. Ашиг:</p>\n<ul>\n  <li>24/7 хариулт — ажлын цагнаас гадна ч хэрэглэгч хариулт авна</li>\n  <li>Нэг мессежийг 200 хүнд нэгэн зэрэг хариулах</li>\n  <li>Нийтлэг асуултад 80% хариулт автоматаар — ажилтан цөөлж болно</li>\n</ul>\n\n<h3>3. Тайлан, шинжилгээ</h3>\n<p>Excel дата хийгдсэн байвал ChatGPT-д тайлбарлуулж болно. "Сүүлийн 3 сарын борлуулалтын чиг хандлагыг тайлбарла" гэхэд хэдхэн секундэд шинжилгээ гарна.</p>\n\n<h3>4. Орчуулга, олон хэл</h3>\n<p>Монгол-Англи-Хятад орчуулга нэн тэргүүний хэрэгтэй. Мэргэжлийн орчуулагчид нэг хуудас 10,000–20,000 ₮ авдаг бол ChatGPT хэдэн секундэд үнэгүй орчуулна.</p>\n\n<h2>Монгол бизнест тохирсон AI хэрэгслүүд</h2>\n<table style="width:100%;border-collapse:collapse;margin:20px 0;">\n  <thead>\n    <tr style="background:#1a3c8f;color:white;">\n      <th style="padding:12px;">Хэрэгсэл</th>\n      <th style="padding:12px;">Хэрэглэгдэх чиглэл</th>\n      <th style="padding:12px;text-align:center;">Үнэ</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>ChatGPT</strong></td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Бичих, шинжилгээ, зөвлөгөө</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Үнэгүй / $20</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Canva AI</strong></td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Дизайн, зураг үүсгэх</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Үнэгүй / $15</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Notion AI</strong></td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Баримт, тэмдэглэл, төлөвлөгөө</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">$10/сар</td>\n    </tr>\n    <tr>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;"><strong>Google Gemini</strong></td>\n      <td style="padding:12px;border-bottom:1px solid #dee2e6;">Зураг, тайлан, орчуулга</td>\n      <td style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Үнэгүй</td>\n    </tr>\n    <tr style="background:#f8f9fa;">\n      <td style="padding:12px;"><strong>Otter.ai</strong></td>\n      <td style="padding:12px;">Уулзалтын тэмдэглэл автомат</td>\n      <td style="padding:12px;text-align:center;">Үнэгүй / $10</td>\n    </tr>\n  </tbody>\n</table>\n\n<h2>Бодит жишээ: Монгол жижиг дэлгүүр ChatGPT ашиглах нь</h2>\n<p><strong>Нөхцөл байдал:</strong> Улаанбаатарт хувцасны дэлгүүртэй, Facebook хуудастай жижиг бизнес эрхлэгч.</p>\n\n<h3>Өмнөх байдал (AI-гүй):</h3>\n<ul>\n  <li>Долоо хоногт 2–3 пост — маркетерт 300,000 ₮/сар</li>\n  <li>Хэрэглэгчийн асуултад хариулах — өдөрт 2 цаг</li>\n  <li>Нийтлэг: 7 хоногт ~15 цаг маркетингийн ажилд зарцуулдаг</li>\n</ul>\n\n<h3>ChatGPT-тэй болсны дараа:</h3>\n<ul>\n  <li>7 хоногт 10+ пост — ChatGPT санаа өгч, Canva дизайн хийнэ — 2 цаг</li>\n  <li>Chatbot нийтлэг асуултад хариулна — 0.5 цаг хяналт</li>\n  <li>Нийтлэг: 7 хоногт ~3 цаг — <strong>12 цаг хэмнэсэн</strong></li>\n</ul>\n\n<h2>ChatGPT-г хэрхэн үр дүнтэй ашиглах вэ?</h2>\n<ol>\n  <li><strong>Prompt (заалт) зөв бич</strong> — "Монгол Facebook-ийн уншигчдад зориулж, манай хувцасны дэлгүүрийн шинэ коллекцийн тухай 150 үгтэй пост бич" гэж тодорхой хэлэх</li>\n  <li><strong>Бизнесийн контекст хий</strong> — ChatGPT-д өөрийн бизнесийн тухай, зорилтот үзэгчдийн тухай урьдчилж тайлбарла</li>\n  <li><strong>Дахин засаж тохируул</strong> — AI-гийн гаргасан контентийг өөрийн хэв маягт тохируул</li>\n  <li><strong>Нэг ажилд суурилуулж дагшин хий</strong> — Эхлэж нэг зүйл (жишээ: пост бичих) л автоматжуулаад, дараа нь нэмж явга</li>\n</ol>\n\n<blockquote style="border-left:4px solid #27ae60;padding:15px 20px;background:#f0fff4;margin:20px 0;">\n  <strong>Дүгнэлт:</strong> AI бол ажилтнаа солидог биш, ажилтны бүтээмжийг нэмэгдүүлдэг хэрэгсэл юм. Монголын жижиг бизнест маркетинг, үйлчилгээ, бичиг цаасны ажилд AI нэвтрүүлснээр сарын 500,000–2,000,000 ₮-ийн зардал хэмнэх боломжтой.\n</blockquote>	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/bbe75ba3-e6af-4564-a5fc-c4707a1c9ba7.jpg	t	2025-03-03 00:00:00	{ChatGPT,AI,бизнес,бүтээмж,технологи}	DigitalGer	13	2026-05-23 14:27:03.377	2026-05-23 14:54:39.924
\.


--
-- Data for Name: BundleItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BundleItem" (id, "bundleId", name, description, "fileId", "sortOrder", "fileIds", label) FROM stdin;
cmpgpyun400u17s2soopp05w3	cmpgpyun100tz7s2syplxt1c8	100 сүүний үнээний эрчимжсэн аж ахуйн төсөл 21х	\N	\N	0	{cmpgwiv5a00017shk5fygoy5s}	\N
cmpij249e00067s04cu8ks3cd	cmpij246300047s04g10lzani	Хөдөлмөрийн дотоод журам.docx	~8,000 үгтэй бүрэн журам — ажилтны эрх, үүрэг, цаг, амралт, шагнал, сахилга бат	\N	1	{}	\N
cmpij24c600087s04xewm0bng	cmpij246300047s04g10lzani	Албан бичгийн загвар.docx	Компанийн лого, хаяг, утастай хэвлэхэд бэлэн албан бичгийн template	\N	2	{}	\N
cmpij24cl000a7s04mdurrl2k	cmpij246300047s04g10lzani	Гэрээний нэгдсэн бүртгэл.xlsx	Бүх гэрээний хяналтын tracker — хугацаа, статус, хариуцагч	\N	3	{}	\N
cmpij24d3000c7s04aey6q8o5	cmpij246300047s04g10lzani	Илгээсэн албан бичгийн бүртгэл.xlsx	Явуулсан бичгүүдийн бүртгэл — огноо, дугаар, агуулга	\N	4	{}	\N
cmpij24dk000e7s04z8rukq9d	cmpij246300047s04g10lzani	Тушаалын нэгдсэн бүртгэл.xlsx	А ба Б тушаалын хоёр sheet-тэй бүртгэл	\N	5	{}	\N
cmpij24dp000g7s04xt42d5kl	cmpij246300047s04g10lzani	Хөдөлмөрийн гэрээ бүртгэл.xlsx	Ажилтан бүрийн гэрээний статус, хугацааны хяналт	\N	6	{}	\N
cmpij24dz000i7s04m1pzginz	cmpij246300047s04g10lzani	Уулзалтын тэмдэглэл.docx	Хурлын протоколын стандарт загвар	\N	7	{}	\N
cmpij24e3000k7s0442woueh0	cmpij246300047s04g10lzani	Ёс зүйн дүрэм журам.docx	Мэргэжлийн зан үйлийн стандарт, дотоод ёс зүйн дүрэм	\N	8	{}	\N
cmpij24e9000m7s04duv3vg6r	cmpij246300047s04g10lzani	Байгууллагын дүрэм.docx	ХХК-ийн үндсэн дүрмийн загвар — нэр, зорилго, бүтэц	\N	9	{}	\N
cmpij24f0000o7s04z6unuu87	cmpij246300047s04g10lzani	Компанийн стратегийн төлөвлөгөө.xlsx	2026–2029 стратеги + SWOT sheet	\N	10	{}	\N
cmpij24ft000q7s04jupmg0r9	cmpij246300047s04g10lzani	Удирдлагын бүтцийн схем.xlsx	Захирал → Хэлтэс → Ажилтны бүтцийн схем	\N	11	{}	\N
cmpij24gp000u7s04q5xs1bz3	cmpij24g5000s7s04m08jcnhp	Ашиг, алдагдлын тооцоолол.xlsx	Орлого, зардал, цэвэр ашгийн тооцооны ажиллагаатай маягт	\N	1	{}	\N
cmpij24gu000w7s04t668egns	cmpij24g5000s7s04m08jcnhp	Мөнгөн урсгалын тайлан.xlsx	12 сарын cash flow — борлуулалт, зардал, тэнцэл	\N	2	{}	\N
cmpij24gy000y7s04eklp8tkq	cmpij24g5000s7s04m08jcnhp	Жижиг бизнесийн төсвийн төлөвлөгөө.xlsx	Орлогын таамаглал vs бодит — автоматаар зөрүү тооцно	\N	3	{}	\N
cmpij24hb00107s04nxxwa66u	cmpij24g5000s7s04m08jcnhp	Цалин тооцоолуур.xlsx	Ажилтан бүрийн цалин, НДШХ, ХХОАТ автоматаар тооцно	\N	4	{}	\N
cmpij24hh00127s049nrkam0z	cmpij24g5000s7s04m08jcnhp	Зардлын тайлан.xlsx	Хэлтэс, ажилтнаар ангилсан зардлын тайлангийн маягт	\N	5	{}	\N
cmpij24ie00147s04l9txenxk	cmpij24g5000s7s04m08jcnhp	Аудитын тайлангийн загвар.docx	Санхүүгийн аудитын тайлангийн стандарт загвар	\N	6	{}	\N
cmpij24ik00167s04pt6uyo4b	cmpij24g5000s7s04m08jcnhp	Баланс тайлан.xlsx	Хөрөнгө, өр төлбөр, эзэмшигчийн өмч + тайлбар sheet	\N	7	{}	\N
cmpij24kd00187s0416q5qs6v	cmpij24g5000s7s04m08jcnhp	Зээл/Хөрөнгө оруулалтын хүсэлт.docx	Банк, ЖДҮ-д гаргах зээлийн хүсэлтийн загвар	\N	8	{}	\N
cmpij24kq001a7s044wywqtb2	cmpij24g5000s7s04m08jcnhp	Нэхэмжлэхийн загвар.xlsx	НӨАТ-тай ба НӨАТ-гүй хоёр хувилбар + заавар sheet	\N	9	{}	\N
cmpij24kz001e7s047idix7td	cmpij24kv001c7s0458dt4rn9	Төслийн төлөвлөгөө.xlsx	Зорилго, хариуцагч, хугацааны бүрэн төлөвлөлт	\N	1	{}	\N
cmpij24l4001g7s04xb4nhojq	cmpij24kv001c7s0458dt4rn9	Төслийн хийгдэх ажлын төлөвлөгөө.xlsx	Task breakdown — ач холбогдол, статус, дуусах огноо	\N	2	{}	\N
cmpij24la001i7s04wca46hp4	cmpij24kv001c7s0458dt4rn9	Бизнес модель канвас.xlsx	Business Model Canvas — 9 блок бүрэн	\N	3	{}	\N
cmpij24le001k7s04eoy25iwb	cmpij24kv001c7s0458dt4rn9	Ажлын төлөвлөгөө.xlsx	To-do list — ажил, хариуцагч, гүйцэтгэл %	\N	4	{}	\N
cmpij24li001m7s04s46gjpxk	cmpij24kv001c7s0458dt4rn9	Ажлын тайлан цагаар.xlsx	Time-blocking — ажилтан, огноо, ажлын тэмдэглэл	\N	5	{}	\N
cmpij24lm001o7s04vlol82yt	cmpij24kv001c7s0458dt4rn9	Төслийн ерөнхий төлөвлөлт.xlsx	Арга хэмжээний ерөнхий цагийн хуваарь	\N	6	{}	\N
cmpij24lu001q7s044lz9fwhc	cmpij24kv001c7s0458dt4rn9	SWOT шинжилгээ.xlsx	Давуу, сул тал, боломж, аюул заналын бүрэн шинжилгээ	\N	7	{}	\N
cmpij24m3001s7s04a8rp8fvv	cmpij24kv001c7s0458dt4rn9	Арга хэмжээний төсвийн загвар.xlsx	Төлөвлөгөө vs бодит зардлын харьцуулалт	\N	8	{}	\N
cmpij24m8001u7s04p53cmh96	cmpij24kv001c7s0458dt4rn9	Gantt chart.xlsx	Долоо хоногоор хуваасан төслийн цагийн диаграм	\N	9	{}	\N
cmpij24mc001w7s048ufihhl4	cmpij24kv001c7s0458dt4rn9	Stakeholder-ийн удирдлага.xlsx	Оролцогч талуудын бүртгэл, нөлөөлөл, стратеги	\N	10	{}	\N
cmpij24mu00207s042wzhlq4u	cmpij24mp001y7s04yia7vt26	Ажилтнуудын бүртгэл.xlsx	РД, нэр, утас, тушаал, цалин — бүрэн HR database	\N	1	{}	\N
cmpij24my00227s04m32m3u04	cmpij24mp001y7s04yia7vt26	Хөдөлмөрийн гэрээ.docx	~2,100 үгтэй хуулийн шаардлагад нийцсэн гэрээ	\N	2	{}	\N
cmpij24n500247s04cfbpg80d	cmpij24mp001y7s04yia7vt26	Ажлын анкет.docx	~3,300 үгтэй дэлгэрэнгүй ажилд орохыг хүсэгчдийн маягт	\N	3	{}	\N
cmpgpyung00u77s2s3un8ioqn	cmpgpyun100tz7s2syplxt1c8	СҮҮ СҮҮН БҮТЭЭГДЭХҮҮНИЙ ҮЙЛДВЭРЛЭЛ ХУДАЛДААНД МӨРДӨХ ТЕХНИКИЙН ЗОХИЦУУЛАЛТ 21х	\N	\N	3	{cmpgwvmi500057sxsifgdztdr}	\N
cmpgpyuo900un7s2sfwysyovh	cmpgpyun100tz7s2syplxt1c8	Хуурай сүүний үйлдвэрлэл төсөл 22x	\N	\N	11	{cmpgwxivd000l7sxsf87nvf2p}	\N
cmpgpyuos00ux7s2sg38zg2p3	cmpgpyun100tz7s2syplxt1c8	Үнээний фермер төсөл 29x	\N	\N	16	{cmpgwyeym000v7sxse5vcb6l6}	\N
cmpij24n900267s04j3aqhd52	cmpij24mp001y7s04yia7vt26	Нууц хадгалах гэрээ (HR).docx	Ажилтанд зориулсан NDA загвар	\N	4	{}	\N
cmpij24ne00287s04ftahy23f	cmpij24mp001y7s04yia7vt26	Цагийн тайлан.xlsx	Ажилтан бүрийн сарын цагийн нэгтгэл	\N	5	{}	\N
cmpij24nq002a7s04coly7z8y	cmpij24mp001y7s04yia7vt26	Ажилтны гарын авлага.docx	Шинэ ажилтанд зориулсан дотоод журам, мэдээлэл	\N	6	{}	\N
cmpij24nu002c7s04ususuiv6	cmpij24mp001y7s04yia7vt26	Ажилтны үнэлгээний маягт.docx	Гүйцэтгэлийн үнэлгээний стандарт маягт	\N	7	{}	\N
cmpij24o1002e7s043e71x2k3	cmpij24mp001y7s04yia7vt26	Ажлын байрны тодорхойлолт.docx	Job description — үүрэг, шаардлага, нөхцөл	\N	8	{}	\N
cmpij24o6002g7s04xrn06eym	cmpij24mp001y7s04yia7vt26	Сургалтын бүртгэл.xlsx	Ажилтан бүрийн сургалтын түүх + дүгнэлт sheet	\N	9	{}	\N
cmpij24ok002k7s04psvesgk6	cmpij24oc002i7s049tfsxsbp	Хөлсөөр ажиллуулах гэрээ.docx	~1,300 үгтэй — гэрээт ажилтны стандарт гэрээ	\N	1	{}	\N
cmpij24oo002m7s04rma1hkgo	cmpij24oc002i7s049tfsxsbp	Худалдах, худалдан авах гэрээ.docx	~900 үгтэй — бараа бүтээгдэхүүний арилжааны гэрээ	\N	2	{}	\N
cmpij24os002o7s04qux2zksn	cmpij24oc002i7s049tfsxsbp	Хамтран ажиллах гэрээ.docx	~1,000 үгтэй — байгууллага хоорондын хамтын ажиллагаа	\N	3	{}	\N
cmpij24p8002q7s04302wjaft	cmpij24oc002i7s049tfsxsbp	Ажил гүйцэтгэх гэрээ.docx	~890 үгтэй — ажил гүйцэтгэлийн гэрээ	\N	4	{}	\N
cmpij24q2002s7s040qa9kcuo	cmpij24oc002i7s049tfsxsbp	Хөдөлмөрийн гэрээ.docx	~2,100 үгтэй — Хөдөлмөрийн хуульд нийцсэн	\N	5	{}	\N
cmpij24qa002u7s0454238njl	cmpij24oc002i7s049tfsxsbp	Нууц хадгалах гэрээ (NDA).docx	~530 үгтэй — NDA стандарт хэлбэр	\N	6	{}	\N
cmpij24qg002w7s04zw8u1oe9	cmpij24oc002i7s049tfsxsbp	Зөвлөх үйлчилгээний гэрээ.docx	Consulting agreement — монгол + англи гарчигтай	\N	7	{}	\N
cmpij24qm002y7s04nfngcj4b	cmpij24oc002i7s049tfsxsbp	Санхүүгийн дэмжлэгийн гэрээ.docx	Санхүүгийн тусламжийн гэрээний загвар	\N	8	{}	\N
cmpij24qw00307s04patkzhwg	cmpij24oc002i7s049tfsxsbp	Түрээсийн гэрээ.docx	Үл хөдлөх хөрөнгийн түрээсийн стандарт гэрээ	\N	9	{}	\N
cmpij24r600347s044b2n3sdh	cmpij24r000327s04h1m6rf7i	Маркетингийн зардлын төлөвлөгөө.xlsx	12 сарын master budget — төлөвлөгөө vs бодит	\N	1	{}	\N
cmpij24re00367s0446a6nfhm	cmpij24r000327s04h1m6rf7i	Маркетингийн стратеги.xlsx	Customer Personas + Channel Implementation canvas	\N	2	{}	\N
cmpij24rj00387s043gmr7d33	cmpij24r000327s04h1m6rf7i	CRM систем.xlsx	Dashboard, Contacts, Opportunities, Interactions — бүрэн CRM систем	\N	3	{}	\N
cmpij24ru003a7s04urin5qgx	cmpij24r000327s04h1m6rf7i	Контент маркетингийн төлөвлөгөө.xlsx	Сарын контент календар — Reels, пост, нийтлэх огноо	\N	4	{}	\N
cmpij24ry003c7s04xceffk5d	cmpij24r000327s04h1m6rf7i	Арга хэмжээний зардлын төлөвлөгөө.xlsx	Тоглолт, арга хэмжээний төсвийн тооцоолол	\N	5	{}	\N
cmpij24s3003e7s0431wr3394	cmpij24r000327s04h1m6rf7i	Борлуулалтын үзүүлэлт.xlsx	Dashboard + Data sheet — борлуулалтын хураангуй	\N	6	{}	\N
cmpij24s8003g7s04fqqps6vv	cmpij24r000327s04h1m6rf7i	Үнийн санал.docx	Үйлчилгээ, бүтээгдэхүүний үнийн саналын загвар	\N	7	{}	\N
cmpij24sd003i7s04a20hktgn	cmpij24r000327s04h1m6rf7i	SMART маркетингийн төлөвлөгөө.xlsx	Зорилго тодорхойлох, тооцоолох, үнэлэх 4 sheet	\N	8	{}	\N
cmpij24sh003k7s04zt8oxz8r	cmpij24r000327s04h1m6rf7i	Дижитал маркетингийн сарын төлөвлөгөө.xlsx	Reach, Leads, Customers, Conversion rates хяналт	\N	9	{}	\N
cmpij24sn003m7s04cr8dp2f9	cmpij24r000327s04h1m6rf7i	Брэндийн удирдамж.docx	Brand guidelines загвар	\N	10	{}	\N
cmpij24sv003o7s04emlvkt4e	cmpij24r000327s04h1m6rf7i	Үйлчлүүлэгчийн судалгааны маягт.docx	Сэтгэл ханамжийн судалгааны маягт	\N	11	{}	\N
cmpij24t1003q7s04xdpmmnnu	cmpij24r000327s04h1m6rf7i	Өрсөлдөгчийн шинжилгээ.xlsx	Харьцуулалтын матриц + оноо үнэлгээний систем	\N	12	{}	\N
cmpij24tn003u7s045fvzn62d	cmpij24ti003s7s0494mv4bsr	Агуулахын удирдлага.xlsx	SKU, өнгө, хэмжээ, байршил, үлдэгдлийн бүртгэл	\N	1	{}	\N
cmpij24tr003w7s041g2b0vca	cmpij24ti003s7s0494mv4bsr	Хэрэглэгчийн гомдол санал.xlsx	Feedback tracker — огноо, нэр, гомдол, шийдвэрлэлт	\N	2	{}	\N
cmpij24tv003y7s04napah256	cmpij24ti003s7s0494mv4bsr	OKR үнэлгээний систем.xlsx	Objective + Key Results — зорилго, хэмжүүр, хэрэгжилт	\N	3	{}	\N
cmpij24u300407s04ovpksfqa	cmpij24ti003s7s0494mv4bsr	Эд хөрөнгийн бүртгэл.xlsx	Нийт хөрөнгийн үнэлгээ + хяналт, хөдөлгөөн, ажилтанд хүлээлгэх	\N	4	{}	\N
cmpij24u900427s04rijwd2yg	cmpij24ti003s7s0494mv4bsr	Байгууллагын үндсэн хяналт.xlsx	Ажлын болон жилийн ашиг/алдагдлын хянах самбар	\N	5	{}	\N
cmpgpyuu900xt7s2sm5658h0z	cmpgpyuu500xr7s2s7fex1uzn	ДӨРВӨН УЛИРЛЫН ХҮЛЭМЖИЙН ТӨСӨЛ 28х	\N	\N	0	{cmpgx0m68000x7sxstda8vc3o}	\N
cmpgpyuuc00xv7s2skypas9yk	cmpgpyuu500xr7s2s7fex1uzn	ДӨРВӨН УЛИРЛЫН ХҮЛЭМЖИЙН АЖ АХУЙ төсөл 201х	\N	\N	1	{cmpgx0q2n000z7sxs3hz1sh2j}	\N
cmpgpyuuu00y57s2szxb84589	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжийн аж ахуй Ногоон шим төсөл 15x	\N	\N	6	{cmpgx1xdx00197sxss5k16nzf}	\N
cmpij24ud00447s041w8vaucg	cmpij24ti003s7s0494mv4bsr	Эрсдэлийн удирдлага.xlsx	Эрсдэлийн тодорхойлолт, түвшин, шийдэл	\N	6	{}	\N
cmpij24uw00467s04n89o05am	cmpij24ti003s7s0494mv4bsr	IT болон техникийн хөрөнгийн бүртгэл.xlsx	Тоног төхөөрөмж + програм хангамжийн бүртгэл	\N	7	{}	\N
cmpij24v200487s04114zxntp	cmpij24ti003s7s0494mv4bsr	Нийлүүлэгчийн бүртгэл.xlsx	Нийлүүлэгч + үнэлгээний системтэй	\N	8	{}	\N
cmpij24v6004a7s04q47bm272	cmpij24ti003s7s0494mv4bsr	Стандарт үйл ажиллагааны журам.docx	SOP загвар — алхам алхмаар процесс тодорхойлох	\N	9	{}	\N
cmpij24vh004e7s04nf1zcoxz	cmpij24va004c7s04lphv8xsn	Presentation загвар.pptx	Компанийн танилцуулгын PowerPoint загвар — мэргэжлийн дизайнтай, бэлэн структуртай	\N	1	{}	\N
cmpgpyuvg00yh7s2sfmexycen	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжийн шинэ төсөл	\N	\N	12	{cmpgx2rn8001l7sxsal87jl99}	\N
cmpgpyuvv00yp7s2s59zkyi5y	cmpgpyuu500xr7s2s7fex1uzn	Өвлийн хүлэмж байгуулах төсөл	\N	\N	16	{cmpgx3dml001t7sxsigumu0i9}	\N
cmpgpyue600pr7s2sribz0p4p	cmpgpyue300pp7s2s7tnslvp4	ЖДҮ-н төслийн жишиг загвар 11х	\N	\N	0	{cmpha128h00017s04n3pundcb}	\N
cmpgpyvm901cn7s2sarz8jjl4	cmpgpyvm501cl7s2symruztuu	ЖДҮ-н төслийн жишиг загвар 11х	\N	\N	0	{cmpha27vy00077s04zs5tsahm}	\N
cmpgpyssa000d7s2svr9mxkk2	cmpgpysrg000b7s2s1wx99t3l	100 сүүний үнээний эрчимжсэн аж ахуйн төсөл 21х	\N	\N	0	{}	\N
cmpgpysti000f7s2soyc47kk2	cmpgpysrg000b7s2s1wx99t3l	50 сүүний үнээний ферм	\N	\N	1	{}	\N
cmpgpystn000h7s2s1uax7mf6	cmpgpysrg000b7s2s1wx99t3l	Сайн чанарын сүүний үйлдвэр байгуулах төсөл 43x	\N	\N	2	{}	\N
cmpgpystr000j7s2srb1r00jm	cmpgpysrg000b7s2s1wx99t3l	СҮҮ СҮҮН БҮТЭЭГДЭХҮҮНИЙ ҮЙЛДВЭРЛЭЛ ХУДАЛДААНД МӨРДӨХ ТЕХНИКИЙН ЗОХИЦУУЛАЛТ 21х	\N	\N	3	{}	\N
cmpgpystv000l7s2sk2r6pfpl	cmpgpysrg000b7s2s1wx99t3l	Сүү боловсруулах үйлдвэрийн төсөл 27x	\N	\N	4	{}	\N
cmpgpysty000n7s2sdskxdc7k	cmpgpysrg000b7s2s1wx99t3l	Сүү сүүн бүтээгдэхүүн төсөл 43х	\N	\N	5	{}	\N
cmpgpysu2000p7s2slxfmbflt	cmpgpysrg000b7s2s1wx99t3l	Сүү, сүүн бүтээгдэхүүн үйлдвэрлэх төсөл 37х	\N	\N	6	{}	\N
cmpgpysu6000r7s2sr5h6doq9	cmpgpysrg000b7s2s1wx99t3l	Сүүний зах зээлийн судалгаа	\N	\N	7	{}	\N
cmpgpysu9000t7s2sejw9630m	cmpgpysrg000b7s2s1wx99t3l	Сүүний үйлдвэр төсөл 36x	\N	\N	8	{}	\N
cmpgpysud000v7s2sbgh74thd	cmpgpysrg000b7s2s1wx99t3l	Сүүний үйлдвэрийн гарын авлага	\N	\N	9	{}	\N
cmpgpysug000x7s2sk76rulp7	cmpgpysrg000b7s2s1wx99t3l	Хуурай сүүний төсөл 37x	\N	\N	10	{}	\N
cmpgpysuk000z7s2s08pxpatb	cmpgpysrg000b7s2s1wx99t3l	Хуурай сүүний үйлдвэрлэл төсөл 22x	\N	\N	11	{}	\N
cmpgpysuo00117s2s6ztkvetp	cmpgpysrg000b7s2s1wx99t3l	Цагаан идээний үйлдвэрийн төсөл 35х	\N	\N	12	{}	\N
cmpgpysur00137s2sdgo6jlny	cmpgpysrg000b7s2s1wx99t3l	Сүүний үхрийн аж ахуйн төсөл 43х	\N	\N	13	{}	\N
cmpgpysuu00157s2scb0ho7x2	cmpgpysrg000b7s2s1wx99t3l	Үнээний ферм төсөл 26x	\N	\N	14	{}	\N
cmpgpysux00177s2ss98h2ydq	cmpgpysrg000b7s2s1wx99t3l	Үнээний ферм төсөл 47х	\N	\N	15	{}	\N
cmpgpysv100197s2sxm2iddfb	cmpgpysrg000b7s2s1wx99t3l	Үнээний фермер төсөл 29x	\N	\N	16	{}	\N
cmpgpysv7001d7s2s5t96gkee	cmpgpysv4001b7s2sx4bkls5s	Мал, махны бэлтгэл, үйлдвэрлэлийн цогцолбор 17х	\N	\N	0	{}	\N
cmpgpysva001f7s2s1w29a3nc	cmpgpysv4001b7s2sx4bkls5s	Махны чиглэлийн үхэр төсөл 10x	\N	\N	1	{}	\N
cmpgpysve001h7s2sc4wmqzxa	cmpgpysv4001b7s2sx4bkls5s	БНХАУ-д адууны мах экспортлох	\N	\N	2	{}	\N
cmpgpysvi001j7s2sdetl84f5	cmpgpysv4001b7s2sx4bkls5s	Бяруу, өсвөр үхэр бордон мах нийлүүлэх төсөл	\N	\N	3	{}	\N
cmpgpysvm001l7s2swqhedidk	cmpgpysv4001b7s2sx4bkls5s	МАХ, МАХАН БҮТЭЭГДЭХҮҮН БОЛОВСРУУЛАХ, ХАДГАЛАХ 25х	\N	\N	4	{}	\N
cmpgpysvp001n7s2sxkd0qw0v	cmpgpysv4001b7s2sx4bkls5s	Мах Импекс ХК маркетингийн судалгаа	\N	\N	5	{}	\N
cmpgpysvs001p7s2swm3l7k9e	cmpgpysv4001b7s2sx4bkls5s	Мах нөөцлөх зоорь төсөл 28х	\N	\N	6	{}	\N
cmpgpysvv001r7s2sltljqvfs	cmpgpysv4001b7s2sx4bkls5s	Мах, махан бүтээгдэхүүнийн зах зээл 22х	\N	\N	7	{}	\N
cmpgpysvz001t7s2spa6d5kv5	cmpgpysv4001b7s2sx4bkls5s	Мах, махан бүтээгдэхүүний төсөл 32х	\N	\N	8	{}	\N
cmpgpysw2001v7s2sicjuq6c9	cmpgpysv4001b7s2sx4bkls5s	Махны зоорь байгуулах, мах ангилан боловсруулах үйлдвэр төсөл 45х	\N	\N	9	{}	\N
cmpgpyswi001x7s2s8v45x9d0	cmpgpysv4001b7s2sx4bkls5s	Махны чиглэлийн үхэр төсөл 66х	\N	\N	10	{}	\N
cmpgpyswm001z7s2skuqx7itw	cmpgpysv4001b7s2sx4bkls5s	Махны чиглэлийн үхэр фермерийн аж ахуйн төсөл 71x	\N	\N	11	{}	\N
cmpgpyswp00217s2ss3ckd0rl	cmpgpysv4001b7s2sx4bkls5s	Монгол мах экспортын судалгаа	\N	\N	12	{}	\N
cmpgpysws00237s2svcqp76ed	cmpgpysv4001b7s2sx4bkls5s	Фермерийн үхэрийн аж ахуйн төсөл 11х	\N	\N	13	{}	\N
cmpgpysww00257s2s6lu83m8x	cmpgpysv4001b7s2sx4bkls5s	Мал махны үйлдвэрийн цогцолбор 17х	\N	\N	14	{}	\N
cmpgpyswz00277s2s1c8ghhf7	cmpgpysv4001b7s2sx4bkls5s	Махны үйлдвэрийн төсөл 51х	\N	\N	15	{}	\N
cmpgpysx300297s2shev9t5dx	cmpgpysv4001b7s2sx4bkls5s	Үхэрийн ферм төсөл 9х	\N	\N	16	{}	\N
cmpgpysxa002d7s2sfcox7o0v	cmpgpysx6002b7s2sjyzvwy08	АМЬТНЫ ТЭЖЭЭЛИЙН ҮЙЛДВЭР төсөл 72х	\N	\N	0	{}	\N
cmpgpysxd002f7s2shzr5qtck	cmpgpysx6002b7s2sjyzvwy08	Малын тэжээлийн зах зээлийн судалгаа	\N	\N	1	{}	\N
cmpgpysxg002h7s2sdydhmx8t	cmpgpysx6002b7s2sjyzvwy08	Малын тэжээлийн үйлдвэрийн төсөл 20х	\N	\N	2	{}	\N
cmpgpysxm002j7s2svp49cm4s	cmpgpysx6002b7s2sjyzvwy08	НОГООН тэжээл төсөл	\N	\N	3	{}	\N
cmpgpysxq002l7s2sexan2fr7	cmpgpysx6002b7s2sjyzvwy08	ТАХИАНЫ ТЭЖЭЭЛ төсөл 23x	\N	\N	4	{}	\N
cmpgpysxu002n7s2symt238wp	cmpgpysx6002b7s2sjyzvwy08	ТАХИАНЫ аж ахуйн өргөтгөлийн хөрөнгө оруулалтын төсөл	\N	\N	5	{}	\N
cmpgpysy0002p7s2swabqc3al	cmpgpysx6002b7s2sjyzvwy08	Тахианы Аж Ахуй Төсөл 20x	\N	\N	6	{}	\N
cmpgpysy3002r7s2skdkofosc	cmpgpysx6002b7s2sjyzvwy08	Тахианы аж ахуй байгуулах төсөл 20х	\N	\N	7	{}	\N
cmpgpysy7002t7s2s0d4ea6sj	cmpgpysx6002b7s2sjyzvwy08	Тахианы төсөл 24x	\N	\N	8	{}	\N
cmpgpysya002v7s2s8zo3hs2z	cmpgpysx6002b7s2sjyzvwy08	Тахько ХКомпанийн маркетингийн судалгаа	\N	\N	9	{}	\N
cmpgpysyd002x7s2s8zzt3k57	cmpgpysx6002b7s2sjyzvwy08	Тахианы аж ахуйн төсөл 14х	\N	\N	10	{}	\N
cmpgpysyg002z7s2s92oqs47e	cmpgpysx6002b7s2sjyzvwy08	Өндөгний төсөл 25х	\N	\N	11	{}	\N
cmpgpysyn00337s2s34bh0k0a	cmpgpysyj00317s2sdzoys9l0	ГАХАЙН АЖ АХУЙД МӨРДӨХ журам 7х	\N	\N	0	{}	\N
cmpgpysyq00357s2sgqmd0rd0	cmpgpysyj00317s2sdzoys9l0	Гахай	\N	\N	1	{}	\N
cmpgpysyu00377s2sh4o2zalf	cmpgpysyj00317s2sdzoys9l0	Гахайн аж ахуйн төсөл 39х	\N	\N	2	{}	\N
cmpgpyszb00397s2s8bccya7c	cmpgpysyj00317s2sdzoys9l0	Гахайн эрчимжүүлсэн аж ахуйн төсөл 36х	\N	\N	3	{}	\N
cmpgpyszf003b7s2smlfqkhk7	cmpgpysyj00317s2sdzoys9l0	Гахайны аж ахуйн төсөл 16х	\N	\N	4	{}	\N
cmpgpyszp003f7s2ss30higg9	cmpgpyszm003d7s2s31i3buih	Алтай кашмер ХХК	\N	\N	0	{}	\N
cmpgpyszt003h7s2sdi6a576j	cmpgpyszm003d7s2s31i3buih	Арьс шир боловсруулах үйлдвэр	\N	\N	1	{}	\N
cmpgpyszw003j7s2s210ch0op	cmpgpyszm003d7s2s31i3buih	Монголын Арьс Ширний үйлдвэрлэлийг сэргээх төсөл 20x	\N	\N	2	{}	\N
cmpgpyszz003l7s2sicuf82yw	cmpgpyszm003d7s2s31i3buih	Ноолуур кашмерийн үйлдвэрийн өргөжилтийн төсөл 86x	\N	\N	3	{}	\N
cmpgpyt03003n7s2s87r2l4w3	cmpgpyszm003d7s2s31i3buih	Ноолууран бүтээгдэхүүн дипломын ажил	\N	\N	4	{}	\N
cmpgpyt06003p7s2s8zkdhrvt	cmpgpyszm003d7s2s31i3buih	Ноос боловсруулах болон арьсан гутал үйлдвэрлэлийн төсөл 43х	\N	\N	5	{}	\N
cmpgpyt0a003r7s2seyh2mm4u	cmpgpyszm003d7s2s31i3buih	Ноосон утасны төсөл 37x	\N	\N	6	{}	\N
cmpgpyt0d003t7s2szxyj843o	cmpgpyszm003d7s2s31i3buih	Ноосон эдлэл	\N	\N	7	{}	\N
cmpgpyt0g003v7s2s0ktnmugc	cmpgpyszm003d7s2s31i3buih	Арьс, ширний үйлдвэрийн төсөл 18х	\N	\N	8	{}	\N
cmpgpyt0j003x7s2s1l0kzd53	cmpgpyszm003d7s2s31i3buih	Арьс шир боловсруулах төсөл 18х	\N	\N	9	{}	\N
cmpgpyt0q00417s2sh8buirbc	cmpgpyt0m003z7s2s2lqzv3ag	Мал аж ахуйн төсөл 30х	\N	\N	0	{}	\N
cmpgpyt0s00437s2s9w90734p	cmpgpyt0m003z7s2s2lqzv3ag	Малын тэжээл үйлдвэрлэх төсөл 75х	\N	\N	1	{}	\N
cmpgpyt0w00457s2splk0f0zx	cmpgpyt0m003z7s2s2lqzv3ag	Малын тэжээл	\N	\N	2	{}	\N
cmpgpyt0z00477s2serkvxvdf	cmpgpyt0m003z7s2s2lqzv3ag	Орхон хонь төсөл	\N	\N	3	{}	\N
cmpgpyt1300497s2scirmaoq8	cmpgpyt0m003z7s2s2lqzv3ag	Тэжээлийн үйлдвэр	\N	\N	4	{}	\N
cmpgpyt16004b7s2s5teos9mm	cmpgpyt0m003z7s2s2lqzv3ag	Тэжээлийн үйлдвэрийн төсөл 38х	\N	\N	5	{}	\N
cmpgpyt1d004f7s2s0dsuybj3	cmpgpyt19004d7s2sa5qa5acb	Бизнес төлөвлөгөө бичих аргачлал	\N	\N	0	{}	\N
cmpgpyt1g004h7s2stijdgp1i	cmpgpyt19004d7s2sa5qa5acb	Гэрээний загварын эмхэтгэл	\N	\N	1	{}	\N
cmpgpyt1k004j7s2srqn94th9	cmpgpyt19004d7s2sa5qa5acb	ЖДҮ төсөл загвар	\N	\N	2	{}	\N
cmpgpyt1n004l7s2sibpg02gg	cmpgpyt19004d7s2sa5qa5acb	Жижиг зээлийн төслийн загвар	\N	\N	3	{}	\N
cmpgpyt1r004n7s2skma0npvw	cmpgpyt19004d7s2sa5qa5acb	ТӨСЛИЙН ҮНЭЛГЭЭ, ТӨСЛИЙН МӨНГӨН УРСГАЛЫН ШИНЖИЛГЭЭ	\N	\N	4	{}	\N
cmpgpyt1v004p7s2sgr3xvivx	cmpgpyt19004d7s2sa5qa5acb	ТӨСӨЛ ХЭРХЭН БИЧИЖ САНХҮҮЖИЛТ АВАХ	\N	\N	5	{}	\N
cmpgpyt1z004r7s2s27y4e2dl	cmpgpyt19004d7s2sa5qa5acb	Төслийн загвар	\N	\N	6	{}	\N
cmpgpyt23004t7s2s9kn91x29	cmpgpyt19004d7s2sa5qa5acb	Төсөл бичих аргачлал	\N	\N	7	{}	\N
cmpgpyt26004v7s2sbb0kjljd	cmpgpyt19004d7s2sa5qa5acb	ХӨРӨНГӨ ОРУУЛАЛТЫН ТӨСЛИЙН гарын авлага 140х	\N	\N	8	{}	\N
cmpgpyt2o004x7s2sphitd4mk	cmpgpyt19004d7s2sa5qa5acb	ЧАНАРЫН УДИРДЛАГЫН ТОГТОЛЦОО	\N	\N	9	{}	\N
cmpgpyt6o00587s2sz23gxufe	cmpgpyt6k00567s2su0uedyqi	ДӨРВӨН УЛИРЛЫН ХҮЛЭМЖИЙН ТӨСӨЛ 28х	\N	\N	0	{}	\N
cmpgpyt6r005a7s2sbwzeivo8	cmpgpyt6k00567s2su0uedyqi	ДӨРВӨН УЛИРЛЫН ХҮЛЭМЖИЙН АЖ АХУЙ төсөл 201х	\N	\N	1	{}	\N
cmpgpyt6u005c7s2solbdry4d	cmpgpyt6k00567s2su0uedyqi	НАРНЫ ЭРЧИМЭЭР АЖИЛЛАДАГ ХҮЛЭМЖ гарын авлага	\N	\N	2	{}	\N
cmpgpyt6y005e7s2sls6o4xt3	cmpgpyt6k00567s2su0uedyqi	Нарийн ногооны хүлэмжийн төсөл 11x	\N	\N	3	{}	\N
cmpgpyt72005g7s2se9weaweu	cmpgpyt6k00567s2su0uedyqi	Хүлэмж төсөл 3x	\N	\N	4	{}	\N
cmpgpyt75005i7s2sctz0ewkr	cmpgpyt6k00567s2su0uedyqi	Хүлэмжийн автоматжуулалтын систем	\N	\N	5	{}	\N
cmpgpyt78005k7s2scq8atrlf	cmpgpyt6k00567s2su0uedyqi	Хүлэмжийн аж ахуй Ногоон шим төсөл 15x	\N	\N	6	{}	\N
cmpgpyt7b005m7s2s1wq5bxkl	cmpgpyt6k00567s2su0uedyqi	Хүлэмжийн аж ахуй эрхлэх "Баян бүрд" төсөл 8х	\N	\N	7	{}	\N
cmpgpyt7f005o7s2sjyool8ql	cmpgpyt6k00567s2su0uedyqi	Хүлэмжийн тариалалт 15х	\N	\N	8	{}	\N
cmpgpyt7j005q7s2sassm2mef	cmpgpyt6k00567s2su0uedyqi	Хүлэмжийн төсөл 11x	\N	\N	9	{}	\N
cmpgpyt7m005s7s2sxio5pr3g	cmpgpyt6k00567s2su0uedyqi	Хүлэмжийн төсөл 16x	\N	\N	10	{}	\N
cmpgpyt7p005u7s2stzj8ph7j	cmpgpyt6k00567s2su0uedyqi	Хүлэмжийн төсөл	\N	\N	11	{}	\N
cmpgpyt7s005w7s2sezg1gyek	cmpgpyt6k00567s2su0uedyqi	Хүлэмжийн шинэ төсөл	\N	\N	12	{}	\N
cmpgpyt7w005y7s2scbl1z19y	cmpgpyt6k00567s2su0uedyqi	Хүлэмжинд хүнсний ногоо тарих төсөл 19x	\N	\N	13	{}	\N
cmpgpyt8000607s2slw86y4x0	cmpgpyt6k00567s2su0uedyqi	Хүлэмжний аж ахуй эрхлэх	\N	\N	14	{}	\N
cmpgpyt8300627s2s9boll76y	cmpgpyt6k00567s2su0uedyqi	Хүлэмжний аж ахуй 14х	\N	\N	15	{}	\N
cmpgpyt8700647s2skqbrezr5	cmpgpyt6k00567s2su0uedyqi	Өвлийн хүлэмж байгуулах төсөл	\N	\N	16	{}	\N
cmpgpyt8a00667s2sap7x1f4q	cmpgpyt6k00567s2su0uedyqi	Өвлийн хүлэмжийн төсөл	\N	\N	17	{}	\N
cmpgpyt8h006a7s2sdrryofec	cmpgpyt8d00687s2sxnvtzcxc	Сибир чацаргана 34х	\N	\N	0	{}	\N
cmpgpyt8n006c7s2se4n4jjo2	cmpgpyt8d00687s2sxnvtzcxc	Цэвэр чацаргана 4х	\N	\N	1	{}	\N
cmpgpyt8r006e7s2smevqj9xs	cmpgpyt8d00687s2sxnvtzcxc	ЧАЦАРГАНЫ АЖ АХУЙ ХӨГЖҮҮЛЭХ ТӨСӨЛ 37х	\N	\N	2	{}	\N
cmpgpyt8y006g7s2s8pingj5s	cmpgpyt8d00687s2sxnvtzcxc	ЧАЦАРГАНЫ АЖ АХУЙ төсөл 48x	\N	\N	3	{}	\N
cmpgpyt91006i7s2suo7eeldf	cmpgpyt8d00687s2sxnvtzcxc	Чацаргана төсөл 26x	\N	\N	4	{}	\N
cmpgpyt95006k7s2spt72dcvu	cmpgpyt8d00687s2sxnvtzcxc	Чацаргана төсөл 32x	\N	\N	5	{}	\N
cmpgpyt98006m7s2swcs24h9j	cmpgpyt8d00687s2sxnvtzcxc	Чацаргана өтгөрүүлсэн шүүсний үйлдвэр төсөл 33х	\N	\N	6	{}	\N
cmpgpyt9c006o7s2snwj1btq8	cmpgpyt8d00687s2sxnvtzcxc	Чацаргана, үхрийн нүд тариалах, боловсруулах үйлдвэр байгуулах төсөл 63x	\N	\N	7	{}	\N
cmpgpyt9g006q7s2skjcqzux2	cmpgpyt8d00687s2sxnvtzcxc	Чацарганы тариалалт ба үйлдвэрлэл байгуулах төсөл 33x	\N	\N	8	{}	\N
cmpgpyt9n006u7s2sjtg9wsjb	cmpgpyt9k006s7s2snys3pvey	Байгаль хамгаалах	\N	\N	0	{}	\N
cmpgpyt9r006w7s2so522s273	cmpgpyt9k006s7s2snys3pvey	Жимсний аж ахуйн төсөл 49х	\N	\N	1	{}	\N
cmpgpyt9u006y7s2s1ij5dwvw	cmpgpyt9k006s7s2snys3pvey	Жимсний мод тариалан	\N	\N	2	{}	\N
cmpgpyt9y00707s2svy54ff5r	cmpgpyt9k006s7s2snys3pvey	МОД ҮРЖҮҮЛГИЙН ГАЗАР БАЙГУУЛАХ ЗУРАГ ТӨСӨЛ 60х	\N	\N	3	{}	\N
cmpgpyta100727s2scv2l5i2p	cmpgpyt9k006s7s2snys3pvey	МОД ҮРЖҮҮЛГИЙН ГАЗАР БАЙГУУЛАХ төсөл 29х	\N	\N	4	{}	\N
cmpgpyta500747s2slxlciog5	cmpgpyt9k006s7s2snys3pvey	МОД ҮРЖҮҮЛГИЙН ГАЗАР БАЙГУУЛАХ төсөл 4х	\N	\N	5	{}	\N
cmpgpyta900767s2sqo69qloz	cmpgpyt9k006s7s2snys3pvey	Мод тарих гарын авлага 48х	\N	\N	6	{}	\N
cmpgpytac00787s2s98rca0wz	cmpgpyt9k006s7s2snys3pvey	Мод төсөл 29x	\N	\N	7	{}	\N
cmpgpytag007a7s2s7an40fcm	cmpgpyt9k006s7s2snys3pvey	Мод үржүүлгийн газар төсөл 4x	\N	\N	8	{}	\N
cmpgpytaj007c7s2sofbwu9yh	cmpgpyt9k006s7s2snys3pvey	Мод үржүүлгийн төсөл 28x	\N	\N	9	{}	\N
cmpgpytam007e7s2st5ohnk6g	cmpgpyt9k006s7s2snys3pvey	Мод үржүүлэг төсөл 35х	\N	\N	10	{}	\N
cmpgpytaq007g7s2spbaoq6m6	cmpgpyt9k006s7s2snys3pvey	Мод үржүүлэг, ойжуулалтын төсөл 31х	\N	\N	11	{}	\N
cmpgpytat007i7s2sndqd5m52	cmpgpyt9k006s7s2snys3pvey	Мод үржүүлэх төсөл 9х	\N	\N	12	{}	\N
cmpgpytaw007k7s2s1r54ytac	cmpgpyt9k006s7s2snys3pvey	Нийтийн хүсэл, нэг мод төсөл 31x	\N	\N	13	{}	\N
cmpgpytaz007m7s2sz1wj72pd	cmpgpyt9k006s7s2snys3pvey	Ногоон төгөл төсөл 9х	\N	\N	14	{}	\N
cmpgpytb3007o7s2scu6lrxv6	cmpgpyt9k006s7s2snys3pvey	Нэхмэл	\N	\N	15	{}	\N
cmpgpytb6007q7s2sslq1svie	cmpgpyt9k006s7s2snys3pvey	Ой модыг хамгаалах төсөл 7х	\N	\N	16	{}	\N
cmpgpytba007s7s2sqr4j8nq3	cmpgpyt9k006s7s2snys3pvey	Самар төсөл 27x	\N	\N	17	{}	\N
cmpgpytbg007w7s2sq0kz4s66	cmpgpytbd007u7s2smu4dzti2	Монгол мөөг төсөл 36x	\N	\N	0	{}	\N
cmpgpytbk007y7s2s2fv6qzvd	cmpgpytbd007u7s2smu4dzti2	Хүнсний мөөг тариалах төсөл 22x	\N	\N	1	{}	\N
cmpgpytbo00807s2sftpbfjea	cmpgpytbd007u7s2smu4dzti2	Хүнсний таримал мөөг тариалах төсөл 37x	\N	\N	2	{}	\N
cmpgpytbv00847s2s49vyfe0l	cmpgpytbs00827s2s5ecu9i3q	Аргохимийн ангийн ажил, бордоо 24х	\N	\N	0	{}	\N
cmpgpytby00867s2sw6nkhobr	cmpgpytbs00827s2s5ecu9i3q	Ботаникийн гарын авлага	\N	\N	1	{}	\N
cmpgpytc200887s2sp4ptv1qd	cmpgpytbs00827s2s5ecu9i3q	ГАР АРГААР ТӨМС ТАРИАЛАХ ТЕХНОЛОГИ 20х	\N	\N	2	{}	\N
cmpgpytc6008a7s2stqdi3kgy	cmpgpytbs00827s2s5ecu9i3q	ГОЛЛАНД СОРТЫН САНТЕ ТӨМС төсөл 23х	\N	\N	3	{}	\N
cmpgpytca008c7s2s5g4j2y6g	cmpgpytbs00827s2s5ecu9i3q	МОНГОЛ ХҮНСНИЙ НОГОО ТӨСӨЛ	\N	\N	4	{}	\N
cmpgpytce008e7s2s1pvt4ba9	cmpgpytbs00827s2s5ecu9i3q	Масло тосны судалгаа	\N	\N	5	{}	\N
cmpgpytci008g7s2svrzwezq5	cmpgpytbs00827s2s5ecu9i3q	Тариалан	\N	\N	6	{}	\N
cmpgpytcm008i7s2sbrcgh8e3	cmpgpytbs00827s2s5ecu9i3q	Төмс хүнсний ногоо тариалах 16х	\N	\N	7	{}	\N
cmpgpytcp008k7s2s4b6haz7y	cmpgpytbs00827s2s5ecu9i3q	Төмс хүнсний ногооны төсөл 25х	\N	\N	8	{}	\N
cmpgpytcs008m7s2ssxwd5u0b	cmpgpytbs00827s2s5ecu9i3q	УСАЛГААТАЙ ТАРИАЛАН ХӨГЖҮҮЛЭХ төсөл 25х	\N	\N	9	{}	\N
cmpgpytcv008o7s2s4wqrb4kk	cmpgpytbs00827s2s5ecu9i3q	Ургамал хамгаалалын гарын авлага	\N	\N	10	{}	\N
cmpgpytcz008q7s2sg5fcli33	cmpgpytbs00827s2s5ecu9i3q	Усалгаатай газар тариалан 32x	\N	\N	11	{}	\N
cmpgpytd2008s7s2s6ukq48bw	cmpgpytbs00827s2s5ecu9i3q	Царгас тариалах төсөл 11x	\N	\N	12	{}	\N
cmpgpytd6008u7s2stj0tjnbj	cmpgpytbs00827s2s5ecu9i3q	Үр тариалангийн ур тавилтын технологи	\N	\N	13	{}	\N
cmpgpytdd008y7s2snc11chma	cmpgpytda008w7s2skqhwsmj1	Бизнес төлөвлөгөө бичих аргачлал	\N	\N	0	{}	\N
cmpgpytdh00907s2sk44w041i	cmpgpytda008w7s2skqhwsmj1	Гэрээний загварын эмхэтгэл	\N	\N	1	{}	\N
cmpgpytdk00927s2ss1fgpt6p	cmpgpytda008w7s2skqhwsmj1	ЖДҮ төсөл загвар	\N	\N	2	{}	\N
cmpgpytdn00947s2srg6330jt	cmpgpytda008w7s2skqhwsmj1	Жижиг зээлийн төслийн загвар	\N	\N	3	{}	\N
cmpgpytdr00967s2sdf777hk5	cmpgpytda008w7s2skqhwsmj1	ТӨСЛИЙН ҮНЭЛГЭЭ, ТӨСЛИЙН МӨНГӨН УРСГАЛЫН ШИНЖИЛГЭЭ	\N	\N	4	{}	\N
cmpgpytdu00987s2slui9qubk	cmpgpytda008w7s2skqhwsmj1	ТӨСӨЛ ХЭРХЭН БИЧИЖ САНХҮҮЖИЛТ АВАХ	\N	\N	5	{}	\N
cmpgpytdx009a7s2sj7fzq388	cmpgpytda008w7s2skqhwsmj1	Төслийн загвар	\N	\N	6	{}	\N
cmpgpyte0009c7s2st7ig52ei	cmpgpytda008w7s2skqhwsmj1	Төсөл бичих аргачлал	\N	\N	7	{}	\N
cmpgpyte3009e7s2sfxlvkxoi	cmpgpytda008w7s2skqhwsmj1	ХӨРӨНГӨ ОРУУЛАЛТЫН ТӨСЛИЙН гарын авлага 140х	\N	\N	8	{}	\N
cmpgpyte7009g7s2swv65sq04	cmpgpytda008w7s2skqhwsmj1	ЧАНАРЫН УДИРДЛАГЫН ТОГТОЛЦОО	\N	\N	9	{}	\N
cmpgpytg3009q7s2s3nqivxcb	cmpgpytfz009o7s2smjv1v7qj	Ресторан төсөл 42x	\N	\N	0	{}	\N
cmpgpytg7009s7s2sjm0i6i64	cmpgpytfz009o7s2smjv1v7qj	Байхов цайны кофе хийцийн төсөл	\N	\N	1	{}	\N
cmpgpyv6q014l7s2svil2lxtn	cmpgpyv3z01317s2suoz82xch	Шилний төсөл 23x	\N	\N	27	{}	\N
cmpgpytgb009u7s2s8dy27vt2	cmpgpytfz009o7s2smjv1v7qj	Зоогийн газар ажиллуулах төсөл	\N	\N	2	{}	\N
cmpgpytgx009w7s2sl2kododu	cmpgpytfz009o7s2smjv1v7qj	Зоогийн газар байгуулах төсөл 34х	\N	\N	3	{}	\N
cmpgpyth1009y7s2sp85t6yky	cmpgpytfz009o7s2smjv1v7qj	Итали ресторан байгуулах төсөл 12х	\N	\N	4	{}	\N
cmpgpyth500a07s2sl0ufbrcv	cmpgpytfz009o7s2smjv1v7qj	Кафений бизнес төлөвлөгөө	\N	\N	5	{}	\N
cmpgpyth900a27s2szk3a7yzo	cmpgpytfz009o7s2smjv1v7qj	Ресторан, лаунж төсөл 13x	\N	\N	6	{}	\N
cmpgpythc00a47s2scsrmbfbg	cmpgpytfz009o7s2smjv1v7qj	Ресторан, лаунж төсөл 42х	\N	\N	7	{}	\N
cmpgpythg00a67s2sxf9ommyc	cmpgpytfz009o7s2smjv1v7qj	Хоолны газрын төсөл	\N	\N	8	{}	\N
cmpgpythk00a87s2sjfak7vx7	cmpgpytfz009o7s2smjv1v7qj	Цагаан хоолны зоогийн газар	\N	\N	9	{}	\N
cmpgpytho00aa7s2s2ag9opj8	cmpgpytfz009o7s2smjv1v7qj	Цагаан хоолны кафе төсөл 25x	\N	\N	10	{}	\N
cmpgpythu00ae7s2s4bxncety	cmpgpythr00ac7s2ss6596gkr	Coffee House 30х	\N	\N	0	{}	\N
cmpgpythy00ag7s2s4l6hi1hr	cmpgpythr00ac7s2ss6596gkr	Coffee Shop 23х	\N	\N	1	{}	\N
cmpgpyti500ak7s2sj23hu7xz	cmpgpyti100ai7s2seh5c1y4t	Айрагны үйлдвэрлэл 21х	\N	\N	0	{}	\N
cmpgpyti800am7s2s5yq9e42h	cmpgpyti100ai7s2seh5c1y4t	Дарс үйлдвэрлэх төсөл 46х	\N	\N	1	{}	\N
cmpgpytib00ao7s2sp1tzhsg5	cmpgpyti100ai7s2seh5c1y4t	Дарсны үйлдвэрлэл төсөл 46х	\N	\N	2	{}	\N
cmpgpytie00aq7s2scxg0kxvh	cmpgpyti100ai7s2seh5c1y4t	Шар айрагны төсөл 275x	\N	\N	3	{}	\N
cmpgpytik00au7s2s9g1r99hf	cmpgpytih00as7s2snefqpo34	Цайны төсөл 54x	\N	\N	0	{}	\N
cmpgpytio00aw7s2s81nxpcb1	cmpgpytih00as7s2snefqpo34	Байхов цай үйлдвэрлэх төсөл 54х	\N	\N	1	{}	\N
cmpgpytiv00b07s2skur0g8ga	cmpgpytir00ay7s2ssti16ita	Бууз, баншны үйлдвэрийн төсөл 24х	\N	\N	0	{}	\N
cmpgpytiz00b27s2skpw8nqnl	cmpgpytir00ay7s2ssti16ita	Монгол бэлэн гоймонгийн төсөл 68x	\N	\N	1	{}	\N
cmpgpytj200b47s2s67045ubd	cmpgpytir00ay7s2ssti16ita	Монгол бэлэн гоймонгийн төсөл 71x	\N	\N	2	{}	\N
cmpgpytj600b67s2s1hodm0hj	cmpgpytir00ay7s2ssti16ita	Нарийн боовны үйлдвэрийн төсөл 11х	\N	\N	3	{}	\N
cmpgpytja00b87s2snznz244n	cmpgpytir00ay7s2ssti16ita	Талх нарийн боов 37х	\N	\N	4	{}	\N
cmpgpytjd00ba7s2sg0ixdomr	cmpgpytir00ay7s2ssti16ita	Талх нарийн боовны төсөл 17x	\N	\N	5	{}	\N
cmpgpytjh00bc7s2sr9hoxrfb	cmpgpytir00ay7s2ssti16ita	Талх нарийн боовны төсөл 28х	\N	\N	6	{}	\N
cmpgpytjk00be7s2smi4cixry	cmpgpytir00ay7s2ssti16ita	Талх чихэр маркетингийн төлөвлөгөө	\N	\N	7	{}	\N
cmpgpytjo00bg7s2sd5zifsw1	cmpgpytir00ay7s2ssti16ita	Талх, нарийн боов үйлдвэрлэл төсөл 22х	\N	\N	8	{}	\N
cmpgpytjr00bi7s2sikdht9cs	cmpgpytir00ay7s2ssti16ita	Түргэн хоол үйлдвэрлэлийн төсөл 20х	\N	\N	9	{}	\N
cmpgpytju00bk7s2si4yr914u	cmpgpytir00ay7s2ssti16ita	Хэрчсэн гурилын үйлдвэрлэлийн төсөл 104x	\N	\N	10	{}	\N
cmpgpytjy00bm7s2stfsm5qt1	cmpgpytir00ay7s2ssti16ita	Чанамал хиам төсөл 9x	\N	\N	11	{}	\N
cmpgpytk500bq7s2syfl7n197	cmpgpytk200bo7s2s3bvwnwv7	Бизнес төлөвлөгөө бичих аргачлал	\N	\N	0	{}	\N
cmpgpytk800bs7s2syjpqmx6t	cmpgpytk200bo7s2s3bvwnwv7	Гэрээний загварын эмхэтгэл	\N	\N	1	{}	\N
cmpgpytkb00bu7s2sidj443ir	cmpgpytk200bo7s2s3bvwnwv7	ЖДҮ төсөл загвар	\N	\N	2	{}	\N
cmpgpytkf00bw7s2s4bvwkbkp	cmpgpytk200bo7s2s3bvwnwv7	Жижиг зээлийн төслийн загвар	\N	\N	3	{}	\N
cmpgpytkj00by7s2szmbbt0r3	cmpgpytk200bo7s2s3bvwnwv7	ТӨСЛИЙН ҮНЭЛГЭЭ, ТӨСЛИЙН МӨНГӨН УРСГАЛЫН ШИНЖИЛГЭЭ	\N	\N	4	{}	\N
cmpgpytkm00c07s2s4gfrs77r	cmpgpytk200bo7s2s3bvwnwv7	ТӨСӨЛ ХЭРХЭН БИЧИЖ САНХҮҮЖИЛТ АВАХ	\N	\N	5	{}	\N
cmpgpytkq00c27s2smxsdlp91	cmpgpytk200bo7s2s3bvwnwv7	Төслийн загвар	\N	\N	6	{}	\N
cmpgpytkt00c47s2swuz5m2ag	cmpgpytk200bo7s2s3bvwnwv7	Төсөл бичих аргачлал	\N	\N	7	{}	\N
cmpgpytl000c67s2s9ev7isc2	cmpgpytk200bo7s2s3bvwnwv7	ХӨРӨНГӨ ОРУУЛАЛТЫН ТӨСЛИЙН гарын авлага 140х	\N	\N	8	{}	\N
cmpgpytl300c87s2st4u28lvn	cmpgpytk200bo7s2s3bvwnwv7	ЧАНАРЫН УДИРДЛАГЫН ТОГТОЛЦОО	\N	\N	9	{}	\N
cmpgpytm500ci7s2svoqzh2i0	cmpgpytm200cg7s2s2fhk6lpx	6 кВ-ын цахилгаан дамжуулах агаарын болон кабель шугамын төсөл	\N	\N	0	{}	\N
cmpgpytm800ck7s2sc3fx35qa	cmpgpytm200cg7s2s2fhk6lpx	620 айлын орон сууц төсөл 58х	\N	\N	1	{}	\N
cmpgpytmc00cm7s2sah3af2tr	cmpgpytm200cg7s2s2fhk6lpx	900 хүний суудалтай кино театрын барилгын төсөл 219х	\N	\N	2	{}	\N
cmpgpytmf00co7s2sn45swq6r	cmpgpytm200cg7s2s2fhk6lpx	99 Ханын материал үйлдвэрлэлийн төсөл 46х	\N	\N	3	{}	\N
cmpgpytmi00cq7s2sk4zkd05n	cmpgpytm200cg7s2s2fhk6lpx	Айлын орон сууц төсөл 58х	\N	\N	4	{}	\N
cmpgpytmm00cs7s2sh0smvsuq	cmpgpytm200cg7s2s2fhk6lpx	Асфальтан зам байгуулах цехийн төсөл 78х	\N	\N	5	{}	\N
cmpgpytmp00cu7s2ss1qlc1i8	cmpgpytm200cg7s2s2fhk6lpx	Барилга төсөл 147х	\N	\N	6	{}	\N
cmpgpytmt00cw7s2shkkjuze6	cmpgpytm200cg7s2s2fhk6lpx	Дуусаагүй барилгын хуулийн асуудлууд	\N	\N	7	{}	\N
cmpgpytmw00cy7s2so1xeab0u	cmpgpytm200cg7s2s2fhk6lpx	Миний байшин төсөл 42x	\N	\N	8	{}	\N
cmpgpytmz00d07s2sqf8fu15b	cmpgpytm200cg7s2s2fhk6lpx	Орон сууцны төсөл 52x	\N	\N	9	{}	\N
cmpgpytn200d27s2s5p1n6nfg	cmpgpytm200cg7s2s2fhk6lpx	САЙЖРУУЛСАН ШАХМАЛ ТҮЛШНИЙ 25КГ	\N	\N	10	{}	\N
cmpgpytn600d47s2s32xei49v	cmpgpytm200cg7s2s2fhk6lpx	Улаанбаатар барилга ХХК гамшгаас хамгаалах төсөл	\N	\N	11	{}	\N
cmpgpytnc00d67s2surbucj2u	cmpgpytm200cg7s2s2fhk6lpx	Утаагүй шахмал түлшний үйлдвэрийн төсөл 23x	\N	\N	12	{}	\N
cmpgpytng00d87s2s7xmpzhz0	cmpgpytm200cg7s2s2fhk6lpx	Хотхоны цогц үйлчилгээ байгуулах төсөл 34х	\N	\N	13	{}	\N
cmpgpytnk00da7s2srdhrp5vx	cmpgpytm200cg7s2s2fhk6lpx	Хувийн орон сууцны угсралт гарын авлага	\N	\N	14	{}	\N
cmpgpytno00dc7s2s24bme4tx	cmpgpytm200cg7s2s2fhk6lpx	Хуурай зайны үйлдвэр төсөл 29x	\N	\N	15	{}	\N
cmpgpytnr00de7s2systppt4r	cmpgpytm200cg7s2s2fhk6lpx	Хүний суудалтай кино театрын барилгын төсөл 219х	\N	\N	16	{}	\N
cmpgpytnv00dg7s2shrw9xdrf	cmpgpytm200cg7s2s2fhk6lpx	"Хот суурины гудамж, зам төлөвлөлт" ЗЗБНбД-ийн төсөл	\N	\N	17	{}	\N
cmpgpytoe00dk7s2s3am7ll20	cmpgpytob00di7s2sikiyz55j	Блок тоосгоны үйлдвэрлэлийн төсөл 33х	\N	\N	0	{}	\N
cmpgpytoi00dm7s2sppp1l55a	cmpgpytob00di7s2sikiyz55j	Блокны үйлдвэр байгуулах төсөл 9х	\N	\N	1	{}	\N
cmpgpytom00do7s2sd5o83p22	cmpgpytob00di7s2sikiyz55j	ПЕНО БЕТОНОН БЛОК ҮЙЛДВЭРЛЭХ ТӨСӨЛ 3x	\N	\N	2	{}	\N
cmpgpytoq00dq7s2sj1seozyi	cmpgpytob00di7s2sikiyz55j	Сибет блокны үйлдвэр төсөл 52x	\N	\N	3	{}	\N
cmpgpytot00ds7s2s239l5n34	cmpgpytob00di7s2sikiyz55j	Төмөр бетон тулгуурын үйлдвэрийн төсөл 35х	\N	\N	4	{}	\N
cmpgpytox00du7s2srzwzzybv	cmpgpytob00di7s2sikiyz55j	Төмөр бетон хашаа үйлдвэрийн төсөл 40х	\N	\N	5	{}	\N
cmpgpytp100dw7s2st20k166h	cmpgpytob00di7s2sikiyz55j	Төмөр блок хашаа	\N	\N	6	{}	\N
cmpgpytp400dy7s2skm7thwdu	cmpgpytob00di7s2sikiyz55j	Хийт хөнгөн бетон гулдмайн үйлдвэр 17x	\N	\N	7	{}	\N
cmpgpytp700e07s2sdvfvmw2k	cmpgpytob00di7s2sikiyz55j	ХӨНГӨН БЛОКНЫ ҮЙЛДВЭР төсөл 21x	\N	\N	8	{}	\N
cmpgpytpn00e27s2s4zp07qhc	cmpgpytob00di7s2sikiyz55j	Шилний төсөл 23x	\N	\N	9	{}	\N
cmpgpytpr00e47s2slbr4ngd2	cmpgpytob00di7s2sikiyz55j	Полистиролбетон хөнгөн блокны үйлдвэр 24х	\N	\N	10	{}	\N
cmpgpytpy00e87s2su9inptdp	cmpgpytpu00e67s2sfnvwl0pj	Галд тэсвэртэй модон хавтан	\N	\N	0	{}	\N
cmpgpytq200ea7s2ss1lcr25a	cmpgpytpu00e67s2sfnvwl0pj	Галд тэсвэртэй, мод орлох хавтангийн төсөл 35х	\N	\N	1	{}	\N
cmpgpytq600ec7s2s4wh7xqd7	cmpgpytpu00e67s2sfnvwl0pj	Гэр ахуйн модон эдлэл үйлдвэрлэх төсөл 17х	\N	\N	2	{}	\N
cmpgpytq900ee7s2sror9lldz	cmpgpytpu00e67s2sfnvwl0pj	Мужааны цех төсөл 5x	\N	\N	3	{}	\N
cmpgpytqc00eg7s2shnokstjt	cmpgpytpu00e67s2sfnvwl0pj	Тавилгын үйлдвэр төсөл 52x	\N	\N	4	{}	\N
cmpgpytqg00ei7s2s9dn52c0j	cmpgpytpu00e67s2sfnvwl0pj	Төмөр хийц болон тавилгын цех төсөл 122x	\N	\N	5	{}	\N
cmpgpytqj00ek7s2s7cwn394b	cmpgpytpu00e67s2sfnvwl0pj	Уран дарханы үйл ажиллагаа эрхлэх төсөл	\N	\N	6	{}	\N
cmpgpytqn00em7s2ssos50wvi	cmpgpytpu00e67s2sfnvwl0pj	Ухаалаг тавилга үйлдвэрлэлийн төсөл 29х	\N	\N	7	{}	\N
cmpgpytqq00eo7s2syex7770k	cmpgpytpu00e67s2sfnvwl0pj	Хөөсөнцөрийн үйлдвэрийн төсөл 21х	\N	\N	8	{}	\N
cmpgpytqt00eq7s2sfwa8sqno	cmpgpytpu00e67s2sfnvwl0pj	Хөөсөнцөрийн үйлдвэрийн цахилгаан хангамж дипломын төсөл	\N	\N	9	{}	\N
cmpgpytqx00es7s2sx8f7nsqc	cmpgpytpu00e67s2sfnvwl0pj	Модон эдлэл үйлдвэрлэх төсөл	\N	\N	10	{}	\N
cmpgpytr100eu7s2skfzivzis	cmpgpytpu00e67s2sfnvwl0pj	Тавилга үйлдвэрлэлийн төсөл 29х	\N	\N	11	{}	\N
cmpgpytr700ey7s2so3csduve	cmpgpytr400ew7s2smbwoxya0	АВТО УГААЛГА БОЛОН АВТО СЕРВИС төсөл 26х	\N	\N	0	{}	\N
cmpgpytra00f07s2s1wc9jsor	cmpgpytr400ew7s2smbwoxya0	Авто дугуй засвар 4х	\N	\N	1	{}	\N
cmpgpytrd00f27s2shsghqpbz	cmpgpytr400ew7s2smbwoxya0	Авто засвар	\N	\N	2	{}	\N
cmpgpytrh00f47s2scmahfwdq	cmpgpytr400ew7s2smbwoxya0	Гагнуурын төв байгуулах төсөл 12х	\N	\N	3	{}	\N
cmpgpytrl00f67s2slfiirbb5	cmpgpytr400ew7s2smbwoxya0	Гэр ахуйн цахилгаан барааны засвар төсөл 18х	\N	\N	4	{}	\N
cmpgpytro00f87s2svk06sqqk	cmpgpytr400ew7s2smbwoxya0	Дугуй, автомашины цахилгаан гагнуурын 15х	\N	\N	5	{}	\N
cmpgpytrt00fa7s2s5qg9tim0	cmpgpytr400ew7s2smbwoxya0	Дугуй засварын төв байгуулах төсөл 15x	\N	\N	6	{}	\N
cmpgpytrw00fc7s2s5y4et89g	cmpgpytr400ew7s2smbwoxya0	Уртын электрон хэмжүүр төсөл 21x	\N	\N	7	{}	\N
cmpgpyts300fg7s2s44flc6z2	cmpgpytrz00fe7s2sofbrvshd	Гоёлын хашаа үйлдвэрлэх үйлдвэр төсөл	\N	\N	0	{}	\N
cmpgpyts600fi7s2sy80orv9g	cmpgpytrz00fe7s2sofbrvshd	ДЭЭВРИЙН ВААРАН ЧЕРЕПИЦ ҮЙЛДВЭРЛЭХ төсөл	\N	\N	1	{}	\N
cmpgpyts900fk7s2spblwcbsf	cmpgpytrz00fe7s2sofbrvshd	Угсармал хашаа	\N	\N	2	{}	\N
cmpgpytsg00fo7s2s53rgvbcu	cmpgpytsd00fm7s2sc0i5uc8x	Бизнес төлөвлөгөө бичих аргачлал	\N	\N	0	{}	\N
cmpgpytsj00fq7s2s0vc20szj	cmpgpytsd00fm7s2sc0i5uc8x	Гэрээний загварын эмхэтгэл	\N	\N	1	{}	\N
cmpgpytsm00fs7s2shoafuc9g	cmpgpytsd00fm7s2sc0i5uc8x	ЖДҮ төсөл загвар	\N	\N	2	{}	\N
cmpgpytsq00fu7s2st1sf27j6	cmpgpytsd00fm7s2sc0i5uc8x	Жижиг зээлийн төслийн загвар	\N	\N	3	{}	\N
cmpgpytsu00fw7s2si3vzgyx9	cmpgpytsd00fm7s2sc0i5uc8x	ТӨСЛИЙН ҮНЭЛГЭЭ, ТӨСЛИЙН МӨНГӨН УРСГАЛЫН ШИНЖИЛГЭЭ	\N	\N	4	{}	\N
cmpgpytsy00fy7s2sei0xfzso	cmpgpytsd00fm7s2sc0i5uc8x	ТӨСӨЛ ХЭРХЭН БИЧИЖ САНХҮҮЖИЛТ АВАХ	\N	\N	5	{}	\N
cmpgpytt100g07s2snax3voju	cmpgpytsd00fm7s2sc0i5uc8x	Төслийн загвар	\N	\N	6	{}	\N
cmpgpytt400g27s2svgquvv4o	cmpgpytsd00fm7s2sc0i5uc8x	Төсөл бичих аргачлал	\N	\N	7	{}	\N
cmpgpytt800g47s2s1czcygyt	cmpgpytsd00fm7s2sc0i5uc8x	ХӨРӨНГӨ ОРУУЛАЛТЫН ТӨСЛИЙН гарын авлага 140х	\N	\N	8	{}	\N
cmpgpyttb00g67s2s12uxw6sr	cmpgpytsd00fm7s2sc0i5uc8x	ЧАНАРЫН УДИРДЛАГЫН ТОГТОЛЦОО	\N	\N	9	{}	\N
cmpgpytv300gg7s2s4zitq7zt	cmpgpytuz00ge7s2she0k7tmy	Монгол дээл хувцас үйлдвэрлэл төсөл 16x	\N	\N	0	{}	\N
cmpgpytv700gi7s2s1o6t12q6	cmpgpytuz00ge7s2she0k7tmy	Оёдлын Цехийн Төсөл 120x	\N	\N	1	{}	\N
cmpgpytvb00gk7s2s6adcx1j1	cmpgpytuz00ge7s2she0k7tmy	Оёдлын жижиг үйлдвэрийг өргөжүүлэх төсөл	\N	\N	2	{}	\N
cmpgpytvg00gm7s2smajbm0u3	cmpgpytuz00ge7s2she0k7tmy	Оёдлын төсөл 32х	\N	\N	3	{}	\N
cmpgpytvk00go7s2seup67zfc	cmpgpytuz00ge7s2she0k7tmy	Оёдлын цехийн төсөл 14x	\N	\N	4	{}	\N
cmpgpytvn00gq7s2sk5fr8cfw	cmpgpytuz00ge7s2she0k7tmy	Оёдлын цехийн төсөл 15x	\N	\N	5	{}	\N
cmpgpytvr00gs7s2se6u88fhq	cmpgpytuz00ge7s2she0k7tmy	Оёдлын үйлдвэр байгуулах төсөл 20х	\N	\N	6	{}	\N
cmpgpytvv00gu7s2s9ktn8ma0	cmpgpytuz00ge7s2she0k7tmy	Оёдолын цехийн төсөл 14х	\N	\N	7	{}	\N
cmpgpytvz00gw7s2shg4c9k4o	cmpgpytuz00ge7s2she0k7tmy	Оёдолын үйлдвэрлэлийн МОНГОЛ ГОЁЛ төсөл 18x	\N	\N	8	{}	\N
cmpgpytw300gy7s2sxxz68x18	cmpgpytuz00ge7s2she0k7tmy	ХУВЦАС ЗАХИАЛГА, ЗАСВАРЫГ ӨРГӨЖҮҮЛЭХ ТӨСӨЛ 5х	\N	\N	9	{}	\N
cmpgpytwa00h27s2sb9uc8301	cmpgpytw600h07s2sk8a0pm04	Ажлын бээлий төсөл 20х	\N	\N	0	{}	\N
cmpgpytwd00h47s2sxbvf0yto	cmpgpytw600h07s2sk8a0pm04	Даавуун ном бизнес төлөвлөгөө	\N	\N	1	{}	\N
cmpgpytwh00h67s2s26creszn	cmpgpytw600h07s2sk8a0pm04	Ихэр хувцасны үйлдвэр 13х	\N	\N	2	{}	\N
cmpgpytwo00h87s2sdbvj9gm4	cmpgpytw600h07s2sk8a0pm04	ОЙМСНЫ ҮЙЛДВЭР БАЙГУУЛАХ ТУХАЙ төсөл 67х	\N	\N	3	{}	\N
cmpgpytwr00ha7s2sc4bnte0m	cmpgpytw600h07s2sk8a0pm04	САЙЖРУУЛСАН НООСООР ПҮҮЗ ХИЙХ ТӨСӨЛ 14х	\N	\N	4	{}	\N
cmpgpytwv00hc7s2sm8u23mlj	cmpgpytw600h07s2sk8a0pm04	СҮЛЖМЭЛ ЭДЛЭЛИЙН ҮЙЛДВЭР төсөл 7x	\N	\N	5	{}	\N
cmpgpytwz00he7s2s8sssrnnq	cmpgpytw600h07s2sk8a0pm04	Хатгамал эдлэл төсөл	\N	\N	6	{}	\N
cmpgpytx300hg7s2s7y3ejjkq	cmpgpytw600h07s2sk8a0pm04	Хулдаасан хэвлэл	\N	\N	7	{}	\N
cmpgpytx900hi7s2sknowz3s0	cmpgpytw600h07s2sk8a0pm04	Хулдаасны үйлдвэр төсөл 18x	\N	\N	8	{}	\N
cmpgpytxd00hk7s2sxcubw2rl	cmpgpytw600h07s2sk8a0pm04	Ээрмэлийн үйлдвэр төсөл 37x	\N	\N	9	{}	\N
cmpgpytxh00hm7s2s10ryd6bs	cmpgpytw600h07s2sk8a0pm04	Эмэгтэй бүс 18х	\N	\N	10	{}	\N
cmpgpytxk00ho7s2sdx0q20b2	cmpgpytw600h07s2sk8a0pm04	Эсгий урлалийн төсөл 9х	\N	\N	11	{}	\N
cmpgpytxr00hs7s2s39tjiaif	cmpgpytxn00hq7s2sisvavgey	Бизнес төлөвлөгөө бичих аргачлал	\N	\N	0	{}	\N
cmpgpytxv00hu7s2sfom2wdij	cmpgpytxn00hq7s2sisvavgey	Гэрээний загварын эмхэтгэл	\N	\N	1	{}	\N
cmpgpytxz00hw7s2swauxgo00	cmpgpytxn00hq7s2sisvavgey	ЖДҮ төсөл загвар	\N	\N	2	{}	\N
cmpgpyty200hy7s2sa3vbstm0	cmpgpytxn00hq7s2sisvavgey	Жижиг зээлийн төслийн загвар	\N	\N	3	{}	\N
cmpgpyty500i07s2sudt7llbu	cmpgpytxn00hq7s2sisvavgey	ТӨСЛИЙН ҮНЭЛГЭЭ, ТӨСЛИЙН МӨНГӨН УРСГАЛЫН ШИНЖИЛГЭЭ	\N	\N	4	{}	\N
cmpgpyty900i27s2sa8h2pnnx	cmpgpytxn00hq7s2sisvavgey	ТӨСӨЛ ХЭРХЭН БИЧИЖ САНХҮҮЖИЛТ АВАХ	\N	\N	5	{}	\N
cmpgpytyd00i47s2sxwmfpr4t	cmpgpytxn00hq7s2sisvavgey	Төслийн загвар	\N	\N	6	{}	\N
cmpgpytyh00i67s2svtb2h8se	cmpgpytxn00hq7s2sisvavgey	Төсөл бичих аргачлал	\N	\N	7	{}	\N
cmpgpytyk00i87s2sk1psdis9	cmpgpytxn00hq7s2sisvavgey	ХӨРӨНГӨ ОРУУЛАЛТЫН ТӨСЛИЙН гарын авлага 140х	\N	\N	8	{}	\N
cmpgpytyo00ia7s2sw9g3zru6	cmpgpytxn00hq7s2sisvavgey	ЧАНАРЫН УДИРДЛАГЫН ТОГТОЛЦОО	\N	\N	9	{}	\N
cmpgpytzj00ij7s2srgcq2t0m	cmpgpytzf00ih7s2s3yhuc84e	Гурилын үйлдвэрийн төсөл 15х	\N	\N	0	{}	\N
cmpgpytzm00il7s2swa85ccu8	cmpgpytzf00ih7s2s3yhuc84e	Хэрчсэн Гурил Боловсруулах Үйлдвэрийн Төсөл 15x	\N	\N	1	{}	\N
cmpgpytzq00in7s2sin3832xv	cmpgpytzf00ih7s2s3yhuc84e	Хэрчсэн гурилны үйлдвэр төсөл 19x	\N	\N	2	{}	\N
cmpgpytzx00ir7s2sxb7fvttu	cmpgpytzu00ip7s2s824jd7v7	100 сүүний үнээний эрчимжсэн аж ахуйн төсөл 21х	\N	\N	0	{}	\N
cmpgpyu0100it7s2srdsqgr33	cmpgpytzu00ip7s2s824jd7v7	50 сүүний үнээний ферм	\N	\N	1	{}	\N
cmpgpyu0400iv7s2spgw469vm	cmpgpytzu00ip7s2s824jd7v7	Сайн чанарын сүүний үйлдвэр байгуулах төсөл 43x	\N	\N	2	{}	\N
cmpgpyu0f00ix7s2ss8xps634	cmpgpytzu00ip7s2s824jd7v7	СҮҮ СҮҮН БҮТЭЭГДЭХҮҮНИЙ ҮЙЛДВЭРЛЭЛ ХУДАЛДААНД МӨРДӨХ ТЕХНИКИЙН ЗОХИЦУУЛАЛТ 21х	\N	\N	3	{}	\N
cmpgpyu0j00iz7s2sz5qambcb	cmpgpytzu00ip7s2s824jd7v7	Сүү боловсруулах үйлдвэрийн төсөл 27x	\N	\N	4	{}	\N
cmpgpyu0n00j17s2szovdlf9x	cmpgpytzu00ip7s2s824jd7v7	Сүү сүүн бүтээгдэхүүн төсөл 43х	\N	\N	5	{}	\N
cmpgpyu0q00j37s2s7wehaiik	cmpgpytzu00ip7s2s824jd7v7	Сүү цагаан идээ боловсруулах төсөл 27х	\N	\N	6	{}	\N
cmpgpyu0u00j57s2sotm96km9	cmpgpytzu00ip7s2s824jd7v7	Сүү цагаан идээний төсөл 14х	\N	\N	7	{}	\N
cmpgpyu0x00j77s2ssr5wy0sm	cmpgpytzu00ip7s2s824jd7v7	Сүү, сүүн бүтээгдэхүүн үйлдвэрлэх төсөл 37х	\N	\N	8	{}	\N
cmpgpyu1100j97s2spunmrhdm	cmpgpytzu00ip7s2s824jd7v7	Сүүний зах зээлийн судалгаа	\N	\N	9	{}	\N
cmpgpyu1500jb7s2sy97k49cc	cmpgpytzu00ip7s2s824jd7v7	Сүүний үйлдвэр төсөл 36x	\N	\N	10	{}	\N
cmpgpyu1900jd7s2sgfuon0jr	cmpgpytzu00ip7s2s824jd7v7	Сүүний үйлдвэрийн гарын авлага	\N	\N	11	{}	\N
cmpgpyu1c00jf7s2stk2s7xzf	cmpgpytzu00ip7s2s824jd7v7	Хуурай сүүний төсөл 28x	\N	\N	12	{}	\N
cmpgpyu1g00jh7s2s8xhrpxj0	cmpgpytzu00ip7s2s824jd7v7	Хуурай сүүний төсөл 37x	\N	\N	13	{}	\N
cmpgpyu1k00jj7s2swj0kqiou	cmpgpytzu00ip7s2s824jd7v7	Хуурай сүүний үйлдвэрлэл төсөл 22x	\N	\N	14	{}	\N
cmpgpyu1n00jl7s2srhlr25gr	cmpgpytzu00ip7s2s824jd7v7	Цагаан идээний үйлдвэрийн төсөл 35х	\N	\N	15	{}	\N
cmpgpyu1q00jn7s2synkj4t3g	cmpgpytzu00ip7s2s824jd7v7	Сүүний үхрийн аж ахуйн төсөл 43х	\N	\N	16	{}	\N
cmpgpyu1t00jp7s2s81l1ai7w	cmpgpytzu00ip7s2s824jd7v7	Үнээний ферм төсөл 26x	\N	\N	17	{}	\N
cmpgpyu1x00jr7s2smq0q4sh8	cmpgpytzu00ip7s2s824jd7v7	Үнээний ферм төсөл 47х	\N	\N	18	{}	\N
cmpgpyu2400jv7s2sklrpskbw	cmpgpyu2100jt7s2sa8jlrxeg	Баяжуулах үйлдвэрийн тез	\N	\N	0	{}	\N
cmpgpyu2700jx7s2s42nl6ce7	cmpgpyu2100jt7s2sa8jlrxeg	Маслоны үйлдвэрлэлийн төсөл 19х	\N	\N	1	{}	\N
cmpgpyu2a00jz7s2sx3eneca4	cmpgpyu2100jt7s2sa8jlrxeg	Тослог ургамлын үр боловсруулах үйлдвэр төсөл 79x	\N	\N	2	{}	\N
cmpgpyu2d00k17s2sx48h207b	cmpgpyu2100jt7s2sa8jlrxeg	Ургамалын тосны үйлдвэрийн төсөл 32x	\N	\N	3	{}	\N
cmpgpyu2k00k57s2skuwlihuh	cmpgpyu2h00k37s2s4yva8bs6	Амны алчуур салфетка бизнес төлөвлөгөө	\N	\N	0	{}	\N
cmpgpyu2o00k77s2s7hk31hez	cmpgpyu2h00k37s2s4yva8bs6	Давсны үйлдвэр төсөл	\N	\N	1	{}	\N
cmpgpyu2r00k97s2suzy6vust	cmpgpyu2h00k37s2s4yva8bs6	Давсны үйлдвэрийн төсөл 30х	\N	\N	2	{}	\N
cmpgpyu2u00kb7s2so3atpbwv	cmpgpyu2h00k37s2s4yva8bs6	Сав баглаа үйлдвэрлэлийн төсөл 33х	\N	\N	3	{}	\N
cmpgpyu2y00kd7s2swjh3en2q	cmpgpyu2h00k37s2s4yva8bs6	Самар боловсруулах үйлдвэр төсөл 22x	\N	\N	4	{}	\N
cmpgpyu3100kf7s2s3mjorq6y	cmpgpyu2h00k37s2s4yva8bs6	Сүрлийн үйлдвэр төсөл 18x	\N	\N	5	{}	\N
cmpgpyu3500kh7s2svol5ul8t	cmpgpyu2h00k37s2s4yva8bs6	Утаагүй түлш төсөл 21x	\N	\N	6	{}	\N
cmpgpyu3800kj7s2si9vv390b	cmpgpyu2h00k37s2s4yva8bs6	ХОГ ХАЯГДАЛ ДАХИН БОЛОВСРУУЛАХ төсөл 19х	\N	\N	7	{}	\N
cmpgpyu3b00kl7s2sgrrz07ck	cmpgpyu2h00k37s2s4yva8bs6	ХОГИЙН САВ ТӨСӨЛ 20х	\N	\N	8	{}	\N
cmpgpyu3f00kn7s2s4xee9n39	cmpgpyu2h00k37s2s4yva8bs6	Ханын цаасны үйлдвэр төсөл 90x	\N	\N	9	{}	\N
cmpgpyu3i00kp7s2s5w5n7igp	cmpgpyu2h00k37s2s4yva8bs6	Хаягдал цаас дахин болвсруулж, цаасан уут хийх төсөл 18х	\N	\N	10	{}	\N
cmpgpyu3l00kr7s2so451wavp	cmpgpyu2h00k37s2s4yva8bs6	Хог боловсруулах төсөл 69x	\N	\N	11	{}	\N
cmpgpyu3p00kt7s2suski3lv7	cmpgpyu2h00k37s2s4yva8bs6	Хог боловсруулах төсөл 93x	\N	\N	12	{}	\N
cmpgpyu3s00kv7s2sgi1j4snf	cmpgpyu2h00k37s2s4yva8bs6	Хог хаягдалын тухай 15х	\N	\N	13	{}	\N
cmpgpyu3w00kx7s2sippcjbiy	cmpgpyu2h00k37s2s4yva8bs6	Хуурай болон нойтон салфетка төсөл 42х	\N	\N	14	{}	\N
cmpgpyu4000kz7s2sy7lv8zgk	cmpgpyu2h00k37s2s4yva8bs6	ХҮНСНИЙ 8 НЭРИЙН ДЭЛГҮҮР БАЙГУУЛАХ төсөл 20х	\N	\N	15	{}	\N
cmpgpyu4400l17s2swc3ilgk4	cmpgpyu2h00k37s2s4yva8bs6	Цаасан уут үйлдвэрлэх төсөл 71х	\N	\N	16	{}	\N
cmpgpyu4700l37s2sj7bhu098	cmpgpyu2h00k37s2s4yva8bs6	Цаасан уутны үйлдвэрлэл төсөл 75х	\N	\N	17	{}	\N
cmpgpyu4a00l57s2s5lj4o9jp	cmpgpyu2h00k37s2s4yva8bs6	Цаасан уутны үйлдвэрлэл төсөл 78х	\N	\N	18	{}	\N
cmpgpyu4e00l77s2si124t0gq	cmpgpyu2h00k37s2s4yva8bs6	Цэвэр Усны Үйлдвэрийн Төсөл	\N	\N	19	{}	\N
cmpgpyu4h00l97s2se3ogbzyd	cmpgpyu2h00k37s2s4yva8bs6	Цэвэр ус төсөл Хөвсгөл	\N	\N	20	{}	\N
cmpgpyu4k00lb7s2s3zzeau7s	cmpgpyu2h00k37s2s4yva8bs6	Цэлцэгнүүрийн үйлдвэр төсөл 27x	\N	\N	21	{}	\N
cmpgpyu4n00ld7s2sxb1qkb5l	cmpgpyu2h00k37s2s4yva8bs6	ЧИХЭРЛЭГ УНДААНЫ ХЭРЭГЛЭЭ 8х	\N	\N	22	{}	\N
cmpgpyu4r00lf7s2smn4ggblq	cmpgpyu2h00k37s2s4yva8bs6	Ил захидлын үйлдвэр 58х	\N	\N	23	{}	\N
cmpgpyu4v00lh7s2shq6qjoqb	cmpgpyu2h00k37s2s4yva8bs6	Цасан уутны төсөл 12х	\N	\N	24	{}	\N
cmpgpyu4y00lj7s2siso0nic8	cmpgpyu2h00k37s2s4yva8bs6	Цэвэр усны үйлдвэрийн бизнес төсөл 43х	\N	\N	25	{}	\N
cmpgpyu5400ln7s2s6198i9fe	cmpgpyu5100ll7s2sasebkq5v	Бизнес төлөвлөгөө бичих аргачлал	\N	\N	0	{}	\N
cmpgpyu5800lp7s2sugaqjki9	cmpgpyu5100ll7s2sasebkq5v	Гэрээний загварын эмхэтгэл	\N	\N	1	{}	\N
cmpgpyu5c00lr7s2sseq37252	cmpgpyu5100ll7s2sasebkq5v	ЖДҮ төсөл загвар	\N	\N	2	{}	\N
cmpgpyu5g00lt7s2se2egu13t	cmpgpyu5100ll7s2sasebkq5v	Жижиг зээлийн төслийн загвар	\N	\N	3	{}	\N
cmpgpyu5j00lv7s2sbnv1nbnm	cmpgpyu5100ll7s2sasebkq5v	ТӨСЛИЙН ҮНЭЛГЭЭ, ТӨСЛИЙН МӨНГӨН УРСГАЛЫН ШИНЖИЛГЭЭ	\N	\N	4	{}	\N
cmpgpyu5n00lx7s2se0r23r9b	cmpgpyu5100ll7s2sasebkq5v	ТӨСӨЛ ХЭРХЭН БИЧИЖ САНХҮҮЖИЛТ АВАХ	\N	\N	5	{}	\N
cmpgpyu5q00lz7s2s747hc2hr	cmpgpyu5100ll7s2sasebkq5v	Төслийн загвар	\N	\N	6	{}	\N
cmpgpyu5v00m17s2sxfv40op2	cmpgpyu5100ll7s2sasebkq5v	Төсөл бичих аргачлал	\N	\N	7	{}	\N
cmpgpyu5z00m37s2slzbnf3oh	cmpgpyu5100ll7s2sasebkq5v	ХӨРӨНГӨ ОРУУЛАЛТЫН ТӨСЛИЙН гарын авлага 140х	\N	\N	8	{}	\N
cmpgpyu6300m57s2sr3zg8b88	cmpgpyu5100ll7s2sasebkq5v	ЧАНАРЫН УДИРДЛАГЫН ТОГТОЛЦОО	\N	\N	9	{}	\N
cmpgpyu7d00me7s2slbjv7v9z	cmpgpyu7a00mc7s2sne3c2dyb	Lion зочид буудал 21х	\N	\N	0	{}	\N
cmpgpyu7h00mg7s2smhv1830i	cmpgpyu7a00mc7s2sne3c2dyb	Рашаан хамгаалах, моджуулах төсөл 42х	\N	\N	1	{}	\N
cmpgpyu7l00mi7s2sp211cywo	cmpgpyu7a00mc7s2sne3c2dyb	АМРАЛТ, СУВИЛЛЫН ЦОГЦОЛБОР ОНОН төсөл 42х	\N	\N	2	{}	\N
cmpgpyu7p00mk7s2sw97ghekj	cmpgpyu7a00mc7s2sne3c2dyb	Ахмадын амралтын газар төсөл 22х	\N	\N	3	{}	\N
cmpgpyu7s00mm7s2sjmz1tsnv	cmpgpyu7a00mc7s2sne3c2dyb	Зочид буудал байгуулах төсөл 28х	\N	\N	4	{}	\N
cmpgpyw0601g17s2s3p5ds8bh	cmpgpyvzu01fv7s2siuvpo6ht	ЖДҮ төсөл загвар	\N	\N	2	{}	\N
cmpgpyu7v00mo7s2sjvcf7q43	cmpgpyu7a00mc7s2sne3c2dyb	ХҮҮХДИЙН ТОГЛООМЫН ТАЛБАЙН ТӨСӨЛ 8х	\N	\N	5	{}	\N
cmpgpyu7z00mq7s2sysza6voe	cmpgpyu7a00mc7s2sne3c2dyb	Цэцэрлэгт хүрээлэнгийн төсөл 50x	\N	\N	6	{}	\N
cmpgpyu8700mu7s2s19lmug6x	cmpgpyu8300ms7s2sbg7q0ml3	MAK Цагаан Суварга төсөл 59х	\N	\N	0	{}	\N
cmpgpyu8a00mw7s2skc6j7s38	cmpgpyu8300ms7s2sbg7q0ml3	Аялал жуулчлалын цогцолбор төсөл 59х	\N	\N	1	{}	\N
cmpgpyu8e00my7s2s4dx83ne0	cmpgpyu8300ms7s2sbg7q0ml3	Аялал жуулчлалын "ЖОНОН" бааз байгуулах төсөл 5х	\N	\N	2	{}	\N
cmpgpyu8i00n07s2s3vlwvil0	cmpgpyu8300ms7s2sbg7q0ml3	Багц аялалын төсөл 27х	\N	\N	3	{}	\N
cmpgpyu8l00n27s2sfzlrus8h	cmpgpyu8300ms7s2sbg7q0ml3	Монгол гэр аялалын бизнес	\N	\N	4	{}	\N
cmpgpyu8o00n47s2s83ctxi5t	cmpgpyu8300ms7s2sbg7q0ml3	Монголын Аялал Жуулчлалын Төсөл	\N	\N	5	{}	\N
cmpgpyu8r00n67s2srrpnym8g	cmpgpyu8300ms7s2sbg7q0ml3	Монголын аялал жуулчлалын бизнес	\N	\N	6	{}	\N
cmpgpyu8u00n87s2scni9sbwi	cmpgpyu8300ms7s2sbg7q0ml3	Хэнтий аймагт аялал жуулчлалын төсөл 60x	\N	\N	7	{}	\N
cmpgpyu8y00na7s2s9fcaa7zz	cmpgpyu8300ms7s2sbg7q0ml3	Аялал	\N	\N	8	{}	\N
cmpgpyu9500ne7s2sa3o46ycs	cmpgpyu9200nc7s2suv9h46nd	Залуучуудын амралтын цаг зөв боловсон өнгөөрөөх төвийн төсөл 25х	\N	\N	0	{}	\N
cmpgpyu9900ng7s2sieadt9hz	cmpgpyu9200nc7s2suv9h46nd	Иог сургалтын төв төсөл 13х	\N	\N	1	{}	\N
cmpgpyu9c00ni7s2s4la8yz6z	cmpgpyu9200nc7s2suv9h46nd	НОМЫН САН БОЛОН ЦЭЦЭРЛЭГТ ХҮРЭЭЛЭН БАЙГУУЛАХ ТӨСӨЛ 50х	\N	\N	2	{}	\N
cmpgpyu9g00nk7s2s4tlatkwz	cmpgpyu9200nc7s2suv9h46nd	Фитнесс клуб байгуулах төсөл 32x	\N	\N	3	{}	\N
cmpgpyu9l00nm7s2s9ewmsg65	cmpgpyu9200nc7s2suv9h46nd	Халуун усны газар байгуулах төсөл 13х	\N	\N	4	{}	\N
cmpgpyu9p00no7s2siep4na6n	cmpgpyu9200nc7s2suv9h46nd	Халуун усны төсөл 20x	\N	\N	5	{}	\N
cmpgpyu9t00nq7s2srkgitrt5	cmpgpyu9200nc7s2suv9h46nd	Эмэгтэйчүүдийн Фитнесс төв төсөл 21x	\N	\N	6	{}	\N
cmpgpyu9x00ns7s2sfq4y0o4z	cmpgpyu9200nc7s2suv9h46nd	Нийтийн үйлчилгээ халуун ус, үсчин 27х	\N	\N	7	{}	\N
cmpgpyua400nw7s2s1qsnqjpa	cmpgpyua100nu7s2sau118bf7	Арьс гоо засал төсөл 20х	\N	\N	0	{}	\N
cmpgpyua800ny7s2ssrqy5v4b	cmpgpyua100nu7s2sau118bf7	Гоо сайхны 10 саяын төсөл	\N	\N	1	{}	\N
cmpgpyuab00o07s2sawgf9kqk	cmpgpyua100nu7s2sau118bf7	Нийтийн үйлчилгээний төсөл 27x	\N	\N	2	{}	\N
cmpgpyuae00o27s2so5262mw7	cmpgpyua100nu7s2sau118bf7	Маникурын салоны төсөл 19х	\N	\N	3	{}	\N
cmpgpyuai00o47s2sn5548uzl	cmpgpyua100nu7s2sau118bf7	Үсчин гоо сайханы төсөл 13х	\N	\N	4	{}	\N
cmpgpyuaq00o87s2s9uxxgds9	cmpgpyual00o67s2sdroci2xa	АВТОМАТ ТОГЛООМЫН ТӨВ төсөл	\N	\N	0	{}	\N
cmpgpyuat00oa7s2sq1n020xy	cmpgpyual00o67s2sdroci2xa	ДУГУЙ ЗАСВАР 24 ЦАГ 14х	\N	\N	1	{}	\N
cmpgpyuax00oc7s2snvuxygym	cmpgpyual00o67s2sdroci2xa	Кино студи хийх төсөл 10х	\N	\N	2	{}	\N
cmpgpyub100oe7s2s6feuj8pe	cmpgpyual00o67s2sdroci2xa	Минимаркет байгуулах төсөл 20х	\N	\N	3	{}	\N
cmpgpyub500og7s2slvl2vb58	cmpgpyual00o67s2sdroci2xa	Супермаркет байгуулах төсөл 80х	\N	\N	4	{}	\N
cmpgpyub900oi7s2s2jxziud8	cmpgpyual00o67s2sdroci2xa	Сургалтын төв байгуулах бизнес төлөвлөгөө	\N	\N	5	{}	\N
cmpgpyubd00ok7s2s5plcx7dh	cmpgpyual00o67s2sdroci2xa	Харшил төсөл	\N	\N	6	{}	\N
cmpgpyubh00om7s2s0rtdtpyy	cmpgpyual00o67s2sdroci2xa	ШТС төсөл Багахангай 21x	\N	\N	7	{}	\N
cmpgpyubl00oo7s2sv4s1msds	cmpgpyual00o67s2sdroci2xa	ЭРҮҮЛ ШҮД — ЭРҮҮЛ ХҮҮХЭД төсөл 19x	\N	\N	8	{}	\N
cmpgpyubp00oq7s2sujaoqxkb	cmpgpyual00o67s2sdroci2xa	Эрүүл мэндийг дэмжих төсөл 8х	\N	\N	9	{}	\N
cmpgpyubu00os7s2s5st6uqeh	cmpgpyual00o67s2sdroci2xa	Нийтийн тээврийн төсөл хэрэгжүүлэх судалгаа 14х	\N	\N	10	{}	\N
cmpgpyuby00ou7s2sywwyzaj8	cmpgpyual00o67s2sdroci2xa	Хэмжээст кино театр төсөл 67х	\N	\N	11	{}	\N
cmpgpyuc200ow7s2s7sjagkpt	cmpgpyual00o67s2sdroci2xa	ӨРГӨӨ КИНО ТЕАТРЫН МАРКЕТИНГИЙН ТӨЛӨВЛӨГӨӨ	\N	\N	12	{}	\N
cmpgpyucc00p07s2snb3vprfy	cmpgpyuc800oy7s2sfy5g2958	Бизнес төлөвлөгөө бичих аргачлал	\N	\N	0	{}	\N
cmpgpyucg00p27s2s2t09edrs	cmpgpyuc800oy7s2sfy5g2958	Гэрээний загварын эмхэтгэл	\N	\N	1	{}	\N
cmpgpyucm00p47s2s2c2joxvy	cmpgpyuc800oy7s2sfy5g2958	ЖДҮ төсөл загвар	\N	\N	2	{}	\N
cmpgpyucq00p67s2spn96g3jm	cmpgpyuc800oy7s2sfy5g2958	Жижиг зээлийн төслийн загвар	\N	\N	3	{}	\N
cmpgpyucu00p87s2sgz94kxnr	cmpgpyuc800oy7s2sfy5g2958	ТӨСЛИЙН ҮНЭЛГЭЭ, ТӨСЛИЙН МӨНГӨН УРСГАЛЫН ШИНЖИЛГЭЭ	\N	\N	4	{}	\N
cmpgpyucx00pa7s2s2oe5hm70	cmpgpyuc800oy7s2sfy5g2958	ТӨСӨЛ ХЭРХЭН БИЧИЖ САНХҮҮЖИЛТ АВАХ	\N	\N	5	{}	\N
cmpgpyud100pc7s2s8ebpli6g	cmpgpyuc800oy7s2sfy5g2958	Төслийн загвар	\N	\N	6	{}	\N
cmpgpyud500pe7s2sn5xeghyg	cmpgpyuc800oy7s2sfy5g2958	Төсөл бичих аргачлал	\N	\N	7	{}	\N
cmpgpyud800pg7s2sg2zjzufc	cmpgpyuc800oy7s2sfy5g2958	ХӨРӨНГӨ ОРУУЛАЛТЫН ТӨСЛИЙН гарын авлага 140х	\N	\N	8	{}	\N
cmpgpyudc00pi7s2sthvf7sxu	cmpgpyuc800oy7s2sfy5g2958	ЧАНАРЫН УДИРДЛАГЫН ТОГТОЛЦОО	\N	\N	9	{}	\N
cmpgpyue900pt7s2sgv8potb6	cmpgpyue300pp7s2s7tnslvp4	OCB JS систем дипломын ажил	\N	\N	1	{cmpha1aw800037s04lioahakd}	\N
cmpgpyued00pv7s2s286ddaji	cmpgpyue300pp7s2s7tnslvp4	Бизнес төлөвлөгөө бичих	\N	\N	2	{cmpha1fhs00057s04mmxs3k7a}	\N
cmpgpyueg00px7s2sytrf29ol	cmpgpyue300pp7s2s7tnslvp4	Бизнес төлөвлөлт загвар	\N	\N	3	{}	\N
cmpgpyuek00pz7s2sz65uv5d2	cmpgpyue300pp7s2s7tnslvp4	ДААТГАЛЫН ЗУУЧЛАЛ дипломын төсөл	\N	\N	4	{}	\N
cmpgpyueo00q17s2s1rhapghs	cmpgpyue300pp7s2s7tnslvp4	Маркетинг төлөвлөгөө загвар	\N	\N	5	{}	\N
cmpgpyuer00q37s2s39zm8rsm	cmpgpyue300pp7s2s7tnslvp4	Маркетингийн судалгаа загвар 1	\N	\N	6	{}	\N
cmpgpyuf000q57s2ski67fna6	cmpgpyue300pp7s2s7tnslvp4	Маркетингийн судалгаа загвар 2	\N	\N	7	{}	\N
cmpgpyuf300q77s2s6pc3364l	cmpgpyue300pp7s2s7tnslvp4	Маркетингийн төлөвлөгөө загвар	\N	\N	8	{}	\N
cmpgpyuf700q97s2stj8ksqld	cmpgpyue300pp7s2s7tnslvp4	НВЦ ХХК-ийн маркетингийн судалгаа	\N	\N	9	{}	\N
cmpgpyufb00qb7s2sld5nbbmm	cmpgpyue300pp7s2s7tnslvp4	НЭМҮҮ ӨРТГИЙН СҮЛЖЭЭГ ХӨГЖҮҮЛЭХ (НӨСХ)	\N	\N	10	{}	\N
cmpgpyuff00qd7s2sz2xhxcu2	cmpgpyue300pp7s2s7tnslvp4	Свот шинжилгээ	\N	\N	11	{}	\N
cmpgpyufi00qf7s2sidyyw1vj	cmpgpyue300pp7s2s7tnslvp4	Төсөл бичих аргачлал	\N	\N	12	{}	\N
cmpgpyufl00qh7s2sl1jvbak5	cmpgpyue300pp7s2s7tnslvp4	Төсөл бичих	\N	\N	13	{}	\N
cmpgpyufo00qj7s2s14zlap6g	cmpgpyue300pp7s2s7tnslvp4	ШИНЭ БҮТЭЭГДЭХҮҮНИЙ МАРКЕТИНГИЙН УДИРДЛАГА	\N	\N	14	{}	\N
cmpgpyuft00ql7s2smx0zyg71	cmpgpyue300pp7s2s7tnslvp4	Шинэ суудлын машины маркетингийн судалгаа	\N	\N	15	{}	\N
cmpgpyufx00qn7s2sodyxaiqa	cmpgpyue300pp7s2s7tnslvp4	Үйлчилгээний маркетинг загвар	\N	\N	16	{}	\N
cmpgpyug100qp7s2saq6t127g	cmpgpyue300pp7s2s7tnslvp4	Үндэстэн дамнасан корпораци бие даалт	\N	\N	17	{}	\N
cmpgpyug700qt7s2ssebz1buw	cmpgpyug400qr7s2sk5kr87z0	Арилжааны банк	\N	\N	0	{}	\N
cmpgpyugb00qv7s2ssm0m2lhj	cmpgpyug400qr7s2sk5kr87z0	Арилжааны банкны жижиг зээлийн судалгаа 11х	\N	\N	1	{}	\N
cmpgpyugf00qx7s2sqt7nrwkd	cmpgpyug400qr7s2sk5kr87z0	Баланс шинжилгээний загвар	\N	\N	2	{}	\N
cmpgpyugj00qz7s2sys5704es	cmpgpyug400qr7s2sk5kr87z0	Банкны зээлийн эрсдэл бууруулах судалгаа	\N	\N	3	{}	\N
cmpgpyugm00r17s2so0ugnk5g	cmpgpyug400qr7s2sk5kr87z0	Барьсан багц дипломын ажил	\N	\N	4	{}	\N
cmpgpyugr00r37s2s7jde5yuk	cmpgpyug400qr7s2sk5kr87z0	Зээлийн эрсдэлийн шинжилгээ	\N	\N	5	{}	\N
cmpgpyugu00r57s2s88hyc70c	cmpgpyug400qr7s2sk5kr87z0	Санхүүгийн шинжилгээ	\N	\N	6	{}	\N
cmpgpyugy00r77s2sllye27x0	cmpgpyug400qr7s2sk5kr87z0	Санхүүгийн шинжилгээний гарын авлага	\N	\N	7	{}	\N
cmpgpyuh100r97s2s6yxczv1b	cmpgpyug400qr7s2sk5kr87z0	Хараа плаза хөрөнгө оруулалтын зээлийн төсөл 38x	\N	\N	8	{}	\N
cmpgpyuh400rb7s2siuofpsi8	cmpgpyug400qr7s2sk5kr87z0	Хэвлэлийн менежмент	\N	\N	9	{}	\N
cmpgpyuhb00rf7s2s2mven84j	cmpgpyuh800rd7s2srwtujxpd	ДОЛОО ХЭМЖИЖ НЭГ ОГТОЛ төсөл 10х	\N	\N	0	{}	\N
cmpgpyuhf00rh7s2sjdbg1ind	cmpgpyuh800rd7s2srwtujxpd	ЖДҮ төсөл 12х	\N	\N	1	{}	\N
cmpgpyuhi00rj7s2s48smoybt	cmpgpyuh800rd7s2srwtujxpd	ЖДҮ-н төслийн жишиг загвар 11х	\N	\N	2	{}	\N
cmpgpyuhl00rl7s2shzw2c8br	cmpgpyuh800rd7s2srwtujxpd	Жижиг зээлийн төслийн загвар 23х	\N	\N	3	{}	\N
cmpgpyuhp00rn7s2sosugs1yu	cmpgpyuh800rd7s2srwtujxpd	Төслийн менежмент 43х	\N	\N	4	{}	\N
cmpgpyuht00rp7s2sw08nugb1	cmpgpyuh800rd7s2srwtujxpd	Төслийн хуваарь ба төсөвлөлт, загвар 52х	\N	\N	5	{}	\N
cmpgpyuhx00rr7s2s5cmf67g1	cmpgpyuh800rd7s2srwtujxpd	Төсөл загвар 32х	\N	\N	6	{}	\N
cmpgpyui400rv7s2sk3e4bthq	cmpgpyui000rt7s2s1xci0yt6	Боловсон 00 төсөл 36х	\N	\N	0	{}	\N
cmpgpyui800rx7s2svwlyi1ks	cmpgpyui000rt7s2s1xci0yt6	Гамшгийн менежмент бие даалт	\N	\N	1	{}	\N
cmpgpyuib00rz7s2se5hxfsh3	cmpgpyui000rt7s2s1xci0yt6	Клоуд орчинд өгөгдлийг аюулгүйгээр устгах судалгаа	\N	\N	2	{}	\N
cmpgpyuif00s17s2s40rvar12	cmpgpyui000rt7s2s1xci0yt6	Олон Улсын Эдийн Засгийн Харилцаа	\N	\N	3	{}	\N
cmpgpyuii00s37s2sh8vllkkw	cmpgpyui000rt7s2s1xci0yt6	Сургууль байгуулах төсөл	\N	\N	4	{}	\N
cmpgpyuim00s57s2snww2stel	cmpgpyui000rt7s2s1xci0yt6	ХҮҮХДИЙН ЦЭЦЭРЛЭГ БАЙГУУЛАХ төсөл 22x	\N	\N	5	{}	\N
cmpgpyuiq00s77s2sx0whg7vj	cmpgpyui000rt7s2s1xci0yt6	Хөдөлмөрийн аюулгүй ажиллагаа курсын ажил	\N	\N	6	{}	\N
cmpgpyuiu00s97s2szos4qwcy	cmpgpyui000rt7s2s1xci0yt6	Шинжлэх ухаан технологийн төсөл 53x	\N	\N	7	{}	\N
cmpgpyuj100sd7s2saoat12a6	cmpgpyuix00sb7s2s8ce8pijw	Ichimoku Kinko Hyo арилжааны систем	\N	\N	0	{}	\N
cmpgpyuj500sf7s2s0k2qy2z8	cmpgpyuix00sb7s2s8ce8pijw	PC тоглоом хийцийн төсөл	\N	\N	1	{}	\N
cmpgpyuj900sh7s2sct4wyq9z	cmpgpyuix00sb7s2s8ce8pijw	PC game 4х	\N	\N	2	{}	\N
cmpgpyujc00sj7s2s6zj0rzjo	cmpgpyuix00sb7s2s8ce8pijw	Бүртгэл тооцооны систем бие даалт	\N	\N	3	{}	\N
cmpgpyujf00sl7s2slsgtffmw	cmpgpyuix00sb7s2s8ce8pijw	Гар утас дагалдах хэрэгслийн төсөл 22х	\N	\N	4	{}	\N
cmpgpyujj00sn7s2s99xxd86s	cmpgpyuix00sb7s2s8ce8pijw	Гар утас, ИНТЕРНЭТ ХЭРЭГЛЭГЧийн судалгаа	\N	\N	5	{}	\N
cmpgpyujn00sp7s2sfjnkxvuc	cmpgpyuix00sb7s2s8ce8pijw	Кабелийн утасны төсөл 23х	\N	\N	6	{}	\N
cmpgpyujr00sr7s2sw0pfvswj	cmpgpyuix00sb7s2s8ce8pijw	Компьютер болон түүний дагалдах хэрэгслийн засвар, төсөл 21х	\N	\N	7	{}	\N
cmpgpyujv00st7s2s2x1z3cj8	cmpgpyuix00sb7s2s8ce8pijw	Компьютерийн үйлчилгээний төв байгуулах төсөл 20х	\N	\N	8	{}	\N
cmpgpyujz00sv7s2s43fkkx5a	cmpgpyuix00sb7s2s8ce8pijw	Нийтлэг зүйл нэр томъёо стандартчилал	\N	\N	9	{}	\N
cmpgpyuk300sx7s2sewbl0kz0	cmpgpyuix00sb7s2s8ce8pijw	Онлайн худалдааны системийн тест хийх гарын авлага 12х	\N	\N	10	{}	\N
cmpgpyuk600sz7s2sk3nk6yog	cmpgpyuix00sb7s2s8ce8pijw	Покерын тоглоом дипломын ажил	\N	\N	11	{}	\N
cmpgpyuka00t17s2scz5jtmff	cmpgpyuix00sb7s2s8ce8pijw	УХААЛАГ ЭЛЕКТРОН ХЭРЭГСЭЛ гарын авлага	\N	\N	12	{}	\N
cmpgpyukd00t37s2szyyi2fzr	cmpgpyuix00sb7s2s8ce8pijw	Хадгаламж бүртгэлийн систем дипломын ажил	\N	\N	13	{}	\N
cmpgpyukg00t57s2s9dg51gw8	cmpgpyuix00sb7s2s8ce8pijw	Хиб техникийн шаардлага	\N	\N	14	{}	\N
cmpgpyukn00t97s2sy83tk5ng	cmpgpyukk00t77s2stns4cai1	Бизнес төлөвлөгөө бичих аргачлал	\N	\N	0	{}	\N
cmpgpyul100tb7s2szmbnr0ts	cmpgpyukk00t77s2stns4cai1	Гэрээний загварын эмхэтгэл	\N	\N	1	{}	\N
cmpgpyul500td7s2sp0ypc9b8	cmpgpyukk00t77s2stns4cai1	ЖДҮ төсөл загвар	\N	\N	2	{}	\N
cmpgpyul800tf7s2s18hxioe4	cmpgpyukk00t77s2stns4cai1	Жижиг зээлийн төслийн загвар	\N	\N	3	{}	\N
cmpgpyulf00th7s2s3vwxih1v	cmpgpyukk00t77s2stns4cai1	ТӨСЛИЙН ҮНЭЛГЭЭ, ТӨСЛИЙН МӨНГӨН УРСГАЛЫН ШИНЖИЛГЭЭ	\N	\N	4	{}	\N
cmpgpyulj00tj7s2smaa79qdm	cmpgpyukk00t77s2stns4cai1	ТӨСӨЛ ХЭРХЭН БИЧИЖ САНХҮҮЖИЛТ АВАХ	\N	\N	5	{}	\N
cmpgpyuln00tl7s2s1ndkbvzc	cmpgpyukk00t77s2stns4cai1	Төслийн загвар	\N	\N	6	{}	\N
cmpgpyulr00tn7s2soql27x8z	cmpgpyukk00t77s2stns4cai1	Төсөл бичих аргачлал	\N	\N	7	{}	\N
cmpgpyulu00tp7s2s5zvwkvmm	cmpgpyukk00t77s2stns4cai1	ХӨРӨНГӨ ОРУУЛАЛТЫН ТӨСЛИЙН гарын авлага 140х	\N	\N	8	{}	\N
cmpgpyuly00tr7s2syx5xvzfe	cmpgpyukk00t77s2stns4cai1	ЧАНАРЫН УДИРДЛАГЫН ТОГТОЛЦОО	\N	\N	9	{}	\N
cmpgpyuow00uz7s2s3muv2tyi	cmpgpyun100tz7s2syplxt1c8	Мал, махны бэлтгэл, үйлдвэрлэлийн цогцолбор 17х	\N	\N	17	{}	\N
cmpgpyup000v17s2spiuclnlj	cmpgpyun100tz7s2syplxt1c8	Махны чиглэлийн үхэр төсөл 10x	\N	\N	18	{}	\N
cmpgpyup500v37s2sttmuo5kn	cmpgpyun100tz7s2syplxt1c8	БНХАУ-д адууны мах экспортлох	\N	\N	19	{}	\N
cmpgpyup900v57s2s1wlub7dj	cmpgpyun100tz7s2syplxt1c8	Бяруу, өсвөр үхэр бордон мах нийлүүлэх төсөл	\N	\N	20	{}	\N
cmpgpyupc00v77s2smm27yd66	cmpgpyun100tz7s2syplxt1c8	МАХ, МАХАН БҮТЭЭГДЭХҮҮН БОЛОВСРУУЛАХ, ХАДГАЛАХ 25х	\N	\N	21	{}	\N
cmpgpyupg00v97s2sgoy8dzxl	cmpgpyun100tz7s2syplxt1c8	Мах Импекс ХК маркетингийн судалгаа	\N	\N	22	{}	\N
cmpgpyupj00vb7s2sjbrdb6aj	cmpgpyun100tz7s2syplxt1c8	Мах нөөцлөх зоорь төсөл 28х	\N	\N	23	{}	\N
cmpgpyupn00vd7s2s52ypas45	cmpgpyun100tz7s2syplxt1c8	Мах, махан бүтээгдэхүүнийн зах зээл 22х	\N	\N	24	{}	\N
cmpgpyupr00vf7s2smigitjk5	cmpgpyun100tz7s2syplxt1c8	Мах, махан бүтээгдэхүүний төсөл 32х	\N	\N	25	{}	\N
cmpgpyupv00vh7s2sw4wh9ycj	cmpgpyun100tz7s2syplxt1c8	Махны зоорь байгуулах, мах ангилан боловсруулах үйлдвэр төсөл 45х	\N	\N	26	{}	\N
cmpgpyupy00vj7s2sa1c48ntz	cmpgpyun100tz7s2syplxt1c8	Махны чиглэлийн үхэр төсөл 66х	\N	\N	27	{}	\N
cmpgpyuq200vl7s2s3o40wj3d	cmpgpyun100tz7s2syplxt1c8	Махны чиглэлийн үхэр фермерийн аж ахуйн төсөл 71x	\N	\N	28	{}	\N
cmpgpyuq700vn7s2sospa2emb	cmpgpyun100tz7s2syplxt1c8	Монгол мах экспортын судалгаа	\N	\N	29	{}	\N
cmpgpyuqb00vp7s2s6xpgxhgp	cmpgpyun100tz7s2syplxt1c8	Фермерийн үхэрийн аж ахуйн төсөл 11х	\N	\N	30	{}	\N
cmpgpyuqe00vr7s2szp145hcl	cmpgpyun100tz7s2syplxt1c8	Мал махны үйлдвэрийн цогцолбор 17х	\N	\N	31	{}	\N
cmpgpyuqi00vt7s2sco4v0v1y	cmpgpyun100tz7s2syplxt1c8	Махны үйлдвэрийн төсөл 51х	\N	\N	32	{}	\N
cmpgpyun800u37s2stm0upjif	cmpgpyun100tz7s2syplxt1c8	50 сүүний үнээний ферм	\N	\N	1	{cmpgwtiix00017sxs22kzwhyy}	\N
cmpgpyunc00u57s2seekzd4yk	cmpgpyun100tz7s2syplxt1c8	Сайн чанарын сүүний үйлдвэр байгуулах төсөл 43x	\N	\N	2	{cmpgwvel600037sxsr9wwmw6g}	\N
cmpgpyunj00u97s2slrrvhhzd	cmpgpyun100tz7s2syplxt1c8	Сүү боловсруулах үйлдвэрийн төсөл 27x	\N	\N	4	{cmpgww2h800077sxs69kpzesp}	\N
cmpgpyunn00ub7s2s5nqm4e45	cmpgpyun100tz7s2syplxt1c8	Сүү сүүн бүтээгдэхүүн төсөл 43х	\N	\N	5	{cmpgww6su00097sxsaeaf7bp9}	\N
cmpgpyunr00ud7s2scvaxuu88	cmpgpyun100tz7s2syplxt1c8	Сүү, сүүн бүтээгдэхүүн үйлдвэрлэх төсөл 37х	\N	\N	6	{cmpgwwoji000b7sxsm0kbaj5o}	\N
cmpgpyunu00uf7s2sqphgkj7h	cmpgpyun100tz7s2syplxt1c8	Сүүний зах зээлийн судалгаа	\N	\N	7	{cmpgwwttt000d7sxs4dswhoxe}	\N
cmpgpyuny00uh7s2suwnceyl3	cmpgpyun100tz7s2syplxt1c8	Сүүний үйлдвэр төсөл 36x	\N	\N	8	{cmpgwwzbr000f7sxs3u94kupz}	\N
cmpgpyuo100uj7s2s33xdyfsh	cmpgpyun100tz7s2syplxt1c8	Сүүний үйлдвэрийн гарын авлага	\N	\N	9	{cmpgwx8jw000h7sxsmhedp853}	\N
cmpgpyuo500ul7s2sd827jvhk	cmpgpyun100tz7s2syplxt1c8	Хуурай сүүний төсөл 37x	\N	\N	10	{cmpgwxet3000j7sxstbnrj5wh}	\N
cmpgpyuod00up7s2sr4et6guv	cmpgpyun100tz7s2syplxt1c8	Цагаан идээний үйлдвэрийн төсөл 35х	\N	\N	12	{cmpgwxnkr000n7sxsn2wvupsi}	\N
cmpgpyuog00ur7s2s65rmd2dc	cmpgpyun100tz7s2syplxt1c8	Сүүний үхрийн аж ахуйн төсөл 43х	\N	\N	13	{cmpgwxumn000p7sxsraxt24v5}	\N
cmpgpyuok00ut7s2spsvxflnl	cmpgpyun100tz7s2syplxt1c8	Үнээний ферм төсөл 26x	\N	\N	14	{cmpgwy57f000r7sxsbfphd8ai}	\N
cmpgpyuoo00uv7s2s85xqds54	cmpgpyun100tz7s2syplxt1c8	Үнээний ферм төсөл 47х	\N	\N	15	{cmpgwy9q8000t7sxsn1f6ivio}	\N
cmpgpyuqm00vv7s2szxfgsg2v	cmpgpyun100tz7s2syplxt1c8	Үхэрийн ферм төсөл 9х	\N	\N	33	{}	\N
cmpgpyuqp00vx7s2shoo8oxws	cmpgpyun100tz7s2syplxt1c8	АМЬТНЫ ТЭЖЭЭЛИЙН ҮЙЛДВЭР төсөл 72х	\N	\N	34	{}	\N
cmpgpyuqs00vz7s2so6aqqazg	cmpgpyun100tz7s2syplxt1c8	Малын тэжээлийн зах зээлийн судалгаа	\N	\N	35	{}	\N
cmpgpyuqw00w17s2sihzszzgb	cmpgpyun100tz7s2syplxt1c8	Малын тэжээлийн үйлдвэрийн төсөл 20х	\N	\N	36	{}	\N
cmpgpyur100w37s2svt9361rx	cmpgpyun100tz7s2syplxt1c8	НОГООН тэжээл төсөл	\N	\N	37	{}	\N
cmpgpyur400w57s2svt12l0ou	cmpgpyun100tz7s2syplxt1c8	ТАХИАНЫ ТЭЖЭЭЛ төсөл 23x	\N	\N	38	{}	\N
cmpgpyur800w77s2s6v9k397t	cmpgpyun100tz7s2syplxt1c8	ТАХИАНЫ аж ахуйн өргөтгөлийн хөрөнгө оруулалтын төсөл	\N	\N	39	{}	\N
cmpgpyurb00w97s2sqco0fpzu	cmpgpyun100tz7s2syplxt1c8	Тахианы Аж Ахуй Төсөл 20x	\N	\N	40	{}	\N
cmpgpyurf00wb7s2s6x34049y	cmpgpyun100tz7s2syplxt1c8	Тахианы аж ахуй байгуулах төсөл 20х	\N	\N	41	{}	\N
cmpgpyurj00wd7s2sr1afj2k4	cmpgpyun100tz7s2syplxt1c8	Тахианы төсөл 24x	\N	\N	42	{}	\N
cmpgpyurm00wf7s2sf3gnqyi5	cmpgpyun100tz7s2syplxt1c8	Тахько ХКомпанийн маркетингийн судалгаа	\N	\N	43	{}	\N
cmpgpyurp00wh7s2si0byvlvx	cmpgpyun100tz7s2syplxt1c8	Тахианы аж ахуйн төсөл 14х	\N	\N	44	{}	\N
cmpgpyurs00wj7s2sl4s9zq42	cmpgpyun100tz7s2syplxt1c8	Өндөгний төсөл 25х	\N	\N	45	{}	\N
cmpgpyurw00wl7s2ssgvzj7xj	cmpgpyun100tz7s2syplxt1c8	ГАХАЙН АЖ АХУЙД МӨРДӨХ журам 7х	\N	\N	46	{}	\N
cmpgpyus000wn7s2sbdcfnx7r	cmpgpyun100tz7s2syplxt1c8	Гахай	\N	\N	47	{}	\N
cmpgpyus300wp7s2se8bdyo08	cmpgpyun100tz7s2syplxt1c8	Гахайн аж ахуйн төсөл 39х	\N	\N	48	{}	\N
cmpgpyus600wr7s2si7l3iwcm	cmpgpyun100tz7s2syplxt1c8	Гахайн эрчимжүүлсэн аж ахуйн төсөл 36х	\N	\N	49	{}	\N
cmpgpyus900wt7s2siw8q0uoa	cmpgpyun100tz7s2syplxt1c8	Гахайны аж ахуйн төсөл 16х	\N	\N	50	{}	\N
cmpgpyusd00wv7s2s0surltjq	cmpgpyun100tz7s2syplxt1c8	Алтай кашмер ХХК	\N	\N	51	{}	\N
cmpgpyush00wx7s2s1xj7f5yi	cmpgpyun100tz7s2syplxt1c8	Арьс шир боловсруулах үйлдвэр	\N	\N	52	{}	\N
cmpgpyusn00wz7s2sjmhcyihj	cmpgpyun100tz7s2syplxt1c8	Монголын Арьс Ширний үйлдвэрлэлийг сэргээх төсөл 20x	\N	\N	53	{}	\N
cmpgpyusq00x17s2sph1tpfcq	cmpgpyun100tz7s2syplxt1c8	Ноолуур кашмерийн үйлдвэрийн өргөжилтийн төсөл 86x	\N	\N	54	{}	\N
cmpgpyusv00x37s2stfvl4tmp	cmpgpyun100tz7s2syplxt1c8	Ноолууран бүтээгдэхүүн дипломын ажил	\N	\N	55	{}	\N
cmpgpyut100x57s2s5w09to8w	cmpgpyun100tz7s2syplxt1c8	Ноос боловсруулах болон арьсан гутал үйлдвэрлэлийн төсөл 43х	\N	\N	56	{}	\N
cmpgpyut500x77s2s79ns3a79	cmpgpyun100tz7s2syplxt1c8	Ноосон утасны төсөл 37x	\N	\N	57	{}	\N
cmpgpyut900x97s2sde2nnfa5	cmpgpyun100tz7s2syplxt1c8	Ноосон эдлэл	\N	\N	58	{}	\N
cmpgpyutd00xb7s2sfzzy184r	cmpgpyun100tz7s2syplxt1c8	Арьс, ширний үйлдвэрийн төсөл 18х	\N	\N	59	{}	\N
cmpgpyutg00xd7s2s6vry58il	cmpgpyun100tz7s2syplxt1c8	Арьс шир боловсруулах төсөл 18х	\N	\N	60	{}	\N
cmpgpyutk00xf7s2sgzjx5uh2	cmpgpyun100tz7s2syplxt1c8	Мал аж ахуйн төсөл 30х	\N	\N	61	{}	\N
cmpgpyutn00xh7s2sbq2cbczd	cmpgpyun100tz7s2syplxt1c8	Малын тэжээл үйлдвэрлэх төсөл 75х	\N	\N	62	{}	\N
cmpgpyutr00xj7s2sbri9ap37	cmpgpyun100tz7s2syplxt1c8	Малын тэжээл	\N	\N	63	{}	\N
cmpgpyutv00xl7s2sz4hyee4g	cmpgpyun100tz7s2syplxt1c8	Орхон хонь төсөл	\N	\N	64	{}	\N
cmpgpyutz00xn7s2s2loxiynp	cmpgpyun100tz7s2syplxt1c8	Тэжээлийн үйлдвэр	\N	\N	65	{}	\N
cmpgpyuu200xp7s2slny6e67f	cmpgpyun100tz7s2syplxt1c8	Тэжээлийн үйлдвэрийн төсөл 38х	\N	\N	66	{}	\N
cmpgpyuug00xx7s2sgvlyb6gs	cmpgpyuu500xr7s2s7fex1uzn	НАРНЫ ЭРЧИМЭЭР АЖИЛЛАДАГ ХҮЛЭМЖ гарын авлага	\N	\N	2	{cmpgx0wow00117sxsgvb13f0k}	\N
cmpgpyuuj00xz7s2seg50ucha	cmpgpyuu500xr7s2s7fex1uzn	Нарийн ногооны хүлэмжийн төсөл 11x	\N	\N	3	{cmpgx12n000137sxsp3qhx8q6}	\N
cmpgpyuun00y17s2sa81rj14x	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмж төсөл 3x	\N	\N	4	{cmpgx183e00157sxsyiu3b21p}	\N
cmpgpyuur00y37s2s2wa8w41h	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжийн автоматжуулалтын систем	\N	\N	5	{cmpgx1jbu00177sxsozdhfzsm}	\N
cmpgpyuuy00y77s2sqqqmyf1c	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжийн аж ахуй эрхлэх "Баян бүрд" төсөл 8х	\N	\N	7	{cmpgx22pb001b7sxs1dl3u8cu}	\N
cmpgpyuv100y97s2soby21n24	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжийн тариалалт 15х	\N	\N	8	{cmpgx295w001d7sxs7w3qg4a7}	\N
cmpgpyuv500yb7s2ssmgtc49j	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжийн төсөл 11x	\N	\N	9	{cmpgx2enp001f7sxs6yq9chp1}	\N
cmpgpyuv900yd7s2s7mbljhru	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжийн төсөл 16x	\N	\N	10	{cmpgx2ipy001h7sxs6umlxccp}	\N
cmpgpyuvc00yf7s2sn1rizrqm	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжийн төсөл	\N	\N	11	{cmpgx2nn4001j7sxsupztxwf1}	\N
cmpgpyuvj00yj7s2se6h8c1rm	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжинд хүнсний ногоо тарих төсөл 19x	\N	\N	13	{cmpgx2xa1001n7sxsink89jrx}	\N
cmpgpyuvo00yl7s2s603v0nln	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжний аж ахуй эрхлэх	\N	\N	14	{cmpgx34pz001p7sxszeq5sigu}	\N
cmpgpyuvr00yn7s2scs3z1f5m	cmpgpyuu500xr7s2s7fex1uzn	Хүлэмжний аж ахуй 14х	\N	\N	15	{cmpgx383q001r7sxsfemzt9j6}	\N
cmpgpyuvy00yr7s2ss9di7frv	cmpgpyuu500xr7s2s7fex1uzn	Өвлийн хүлэмжийн төсөл	\N	\N	17	{cmpgx3id9001v7sxswo1ibgpa}	\N
cmpgpyuw200yt7s2s2trk9c03	cmpgpyuu500xr7s2s7fex1uzn	Сибир чацаргана 34х	\N	\N	18	{}	\N
cmpgpyuw600yv7s2s539x84nh	cmpgpyuu500xr7s2s7fex1uzn	Цэвэр чацаргана 4х	\N	\N	19	{}	\N
cmpgpyuwa00yx7s2svtwfc1z5	cmpgpyuu500xr7s2s7fex1uzn	ЧАЦАРГАНЫ АЖ АХУЙ ХӨГЖҮҮЛЭХ ТӨСӨЛ 37х	\N	\N	20	{}	\N
cmpgpyuwd00yz7s2s7as7u0mj	cmpgpyuu500xr7s2s7fex1uzn	ЧАЦАРГАНЫ АЖ АХУЙ төсөл 48x	\N	\N	21	{}	\N
cmpgpyuwg00z17s2sp71dweyi	cmpgpyuu500xr7s2s7fex1uzn	Чацаргана төсөл 26x	\N	\N	22	{}	\N
cmpgpyuwl00z37s2s30f2bbny	cmpgpyuu500xr7s2s7fex1uzn	Чацаргана төсөл 32x	\N	\N	23	{}	\N
cmpgpyuwo00z57s2sy44fy0rf	cmpgpyuu500xr7s2s7fex1uzn	Чацаргана өтгөрүүлсэн шүүсний үйлдвэр төсөл 33х	\N	\N	24	{}	\N
cmpgpyuws00z77s2sm2hg2ib8	cmpgpyuu500xr7s2s7fex1uzn	Чацаргана, үхрийн нүд тариалах, боловсруулах үйлдвэр байгуулах төсөл 63x	\N	\N	25	{}	\N
cmpgpyuww00z97s2s9co8hrp5	cmpgpyuu500xr7s2s7fex1uzn	Чацарганы тариалалт ба үйлдвэрлэл байгуулах төсөл 33x	\N	\N	26	{}	\N
cmpgpyuwz00zb7s2sl1hooa7i	cmpgpyuu500xr7s2s7fex1uzn	Байгаль хамгаалах	\N	\N	27	{}	\N
cmpgpyux400zd7s2sx3ub7fbf	cmpgpyuu500xr7s2s7fex1uzn	Жимсний аж ахуйн төсөл 49х	\N	\N	28	{}	\N
cmpgpyux700zf7s2smh70nvmi	cmpgpyuu500xr7s2s7fex1uzn	Жимсний мод тариалан	\N	\N	29	{}	\N
cmpgpyuxb00zh7s2sfz6az0t4	cmpgpyuu500xr7s2s7fex1uzn	МОД ҮРЖҮҮЛГИЙН ГАЗАР БАЙГУУЛАХ ЗУРАГ ТӨСӨЛ 60х	\N	\N	30	{}	\N
cmpgpyuxe00zj7s2sc46402ip	cmpgpyuu500xr7s2s7fex1uzn	МОД ҮРЖҮҮЛГИЙН ГАЗАР БАЙГУУЛАХ төсөл 29х	\N	\N	31	{}	\N
cmpgpyuxi00zl7s2sb4zpzwk0	cmpgpyuu500xr7s2s7fex1uzn	МОД ҮРЖҮҮЛГИЙН ГАЗАР БАЙГУУЛАХ төсөл 4х	\N	\N	32	{}	\N
cmpgpyuxm00zn7s2s81bzerzx	cmpgpyuu500xr7s2s7fex1uzn	Мод тарих гарын авлага 48х	\N	\N	33	{}	\N
cmpgpyuxp00zp7s2s620vq469	cmpgpyuu500xr7s2s7fex1uzn	Мод төсөл 29x	\N	\N	34	{}	\N
cmpgpyuxs00zr7s2sjre4a39d	cmpgpyuu500xr7s2s7fex1uzn	Мод үржүүлгийн газар төсөл 4x	\N	\N	35	{}	\N
cmpgpyuxw00zt7s2sampdgyfw	cmpgpyuu500xr7s2s7fex1uzn	Мод үржүүлгийн төсөл 28x	\N	\N	36	{}	\N
cmpgpyuy000zv7s2sv5rsvpqh	cmpgpyuu500xr7s2s7fex1uzn	Мод үржүүлэг төсөл 35х	\N	\N	37	{}	\N
cmpgpyuy400zx7s2s8iq6adey	cmpgpyuu500xr7s2s7fex1uzn	Мод үржүүлэг, ойжуулалтын төсөл 31х	\N	\N	38	{}	\N
cmpgpyuy700zz7s2srotfz024	cmpgpyuu500xr7s2s7fex1uzn	Мод үржүүлэх төсөл 9х	\N	\N	39	{}	\N
cmpgpyuyb01017s2s9makrd0v	cmpgpyuu500xr7s2s7fex1uzn	Нийтийн хүсэл, нэг мод төсөл 31x	\N	\N	40	{}	\N
cmpgpyuyf01037s2sl6c7cdbj	cmpgpyuu500xr7s2s7fex1uzn	Ногоон төгөл төсөл 9х	\N	\N	41	{}	\N
cmpgpyuyi01057s2svll2etsh	cmpgpyuu500xr7s2s7fex1uzn	Нэхмэл	\N	\N	42	{}	\N
cmpgpyuyl01077s2s2hjie9ch	cmpgpyuu500xr7s2s7fex1uzn	Ой модыг хамгаалах төсөл 7х	\N	\N	43	{}	\N
cmpgpyuyp01097s2sdmxj2m3h	cmpgpyuu500xr7s2s7fex1uzn	Самар төсөл 27x	\N	\N	44	{}	\N
cmpgpyuys010b7s2s43dq80ao	cmpgpyuu500xr7s2s7fex1uzn	Монгол мөөг төсөл 36x	\N	\N	45	{}	\N
cmpgpyuyw010d7s2szh9vlfv4	cmpgpyuu500xr7s2s7fex1uzn	Хүнсний мөөг тариалах төсөл 22x	\N	\N	46	{}	\N
cmpgpyuz0010f7s2szuzms7dz	cmpgpyuu500xr7s2s7fex1uzn	Хүнсний таримал мөөг тариалах төсөл 37x	\N	\N	47	{}	\N
cmpgpyuz4010h7s2slm4aupbx	cmpgpyuu500xr7s2s7fex1uzn	Аргохимийн ангийн ажил, бордоо 24х	\N	\N	48	{}	\N
cmpgpyuz7010j7s2sk8n5nzcc	cmpgpyuu500xr7s2s7fex1uzn	Ботаникийн гарын авлага	\N	\N	49	{}	\N
cmpgpyuzc010l7s2sgfb3o66q	cmpgpyuu500xr7s2s7fex1uzn	ГАР АРГААР ТӨМС ТАРИАЛАХ ТЕХНОЛОГИ 20х	\N	\N	50	{}	\N
cmpgpyuzg010n7s2szweh885v	cmpgpyuu500xr7s2s7fex1uzn	ГОЛЛАНД СОРТЫН САНТЕ ТӨМС төсөл 23х	\N	\N	51	{}	\N
cmpgpyuzj010p7s2scz09iq5i	cmpgpyuu500xr7s2s7fex1uzn	МОНГОЛ ХҮНСНИЙ НОГОО ТӨСӨЛ	\N	\N	52	{}	\N
cmpgpyuzm010r7s2s13mopi8o	cmpgpyuu500xr7s2s7fex1uzn	Масло тосны судалгаа	\N	\N	53	{}	\N
cmpgpyuzq010t7s2sbsu4fj2l	cmpgpyuu500xr7s2s7fex1uzn	Тариалан	\N	\N	54	{}	\N
cmpgpyuzt010v7s2sedzr2967	cmpgpyuu500xr7s2s7fex1uzn	Төмс хүнсний ногоо тариалах 16х	\N	\N	55	{}	\N
cmpgpyuzx010x7s2szbutn7ic	cmpgpyuu500xr7s2s7fex1uzn	Төмс хүнсний ногооны төсөл 25х	\N	\N	56	{}	\N
cmpgpyv00010z7s2s6c3tm07t	cmpgpyuu500xr7s2s7fex1uzn	УСАЛГААТАЙ ТАРИАЛАН ХӨГЖҮҮЛЭХ төсөл 25х	\N	\N	57	{}	\N
cmpgpyv0401117s2sxzcntuc4	cmpgpyuu500xr7s2s7fex1uzn	Ургамал хамгаалалын гарын авлага	\N	\N	58	{}	\N
cmpgpyv0701137s2sbymciomm	cmpgpyuu500xr7s2s7fex1uzn	Усалгаатай газар тариалан 32x	\N	\N	59	{}	\N
cmpgpyv0c01157s2sj7quqb8g	cmpgpyuu500xr7s2s7fex1uzn	Царгас тариалах төсөл 11x	\N	\N	60	{}	\N
cmpgpyv0f01177s2syhhdwqup	cmpgpyuu500xr7s2s7fex1uzn	Үр тариалангийн ур тавилтын технологи	\N	\N	61	{}	\N
cmpgpyv0q011b7s2sbh0z3uv5	cmpgpyv0m01197s2s502gt2tc	Ресторан төсөл 42x	\N	\N	0	{}	\N
cmpgpyv0u011d7s2s6h09eiyg	cmpgpyv0m01197s2s502gt2tc	Байхов цайны кофе хийцийн төсөл	\N	\N	1	{}	\N
cmpgpyv0y011f7s2ss6cuvl67	cmpgpyv0m01197s2s502gt2tc	Зоогийн газар ажиллуулах төсөл	\N	\N	2	{}	\N
cmpgpyv15011h7s2s2xg4rtwu	cmpgpyv0m01197s2s502gt2tc	Зоогийн газар байгуулах төсөл 34х	\N	\N	3	{}	\N
cmpgpyv19011j7s2sadlyhkxs	cmpgpyv0m01197s2s502gt2tc	Итали ресторан байгуулах төсөл 12х	\N	\N	4	{}	\N
cmpgpyv1c011l7s2s0p33trgl	cmpgpyv0m01197s2s502gt2tc	Кафений бизнес төлөвлөгөө	\N	\N	5	{}	\N
cmpgpyv1g011n7s2s1clt74ps	cmpgpyv0m01197s2s502gt2tc	Ресторан, лаунж төсөл 13x	\N	\N	6	{}	\N
cmpgpyv1k011p7s2sbhbg10lc	cmpgpyv0m01197s2s502gt2tc	Ресторан, лаунж төсөл 42х	\N	\N	7	{}	\N
cmpgpyv1o011r7s2skn6w1wcf	cmpgpyv0m01197s2s502gt2tc	Хоолны газрын төсөл	\N	\N	8	{}	\N
cmpgpyv1r011t7s2sxoyitpow	cmpgpyv0m01197s2s502gt2tc	Цагаан хоолны зоогийн газар	\N	\N	9	{}	\N
cmpgpyv1v011v7s2s48jart2s	cmpgpyv0m01197s2s502gt2tc	Цагаан хоолны кафе төсөл 25x	\N	\N	10	{}	\N
cmpgpyv1y011x7s2srdfs5fkk	cmpgpyv0m01197s2s502gt2tc	Coffee House 30х	\N	\N	11	{}	\N
cmpgpyv22011z7s2sozumrs1h	cmpgpyv0m01197s2s502gt2tc	Coffee Shop 23х	\N	\N	12	{}	\N
cmpgpyv2601217s2so5mzalyt	cmpgpyv0m01197s2s502gt2tc	Айрагны үйлдвэрлэл 21х	\N	\N	13	{}	\N
cmpgpyv2a01237s2sthx7yrww	cmpgpyv0m01197s2s502gt2tc	Дарс үйлдвэрлэх төсөл 46х	\N	\N	14	{}	\N
cmpgpyv2d01257s2sffibdyo1	cmpgpyv0m01197s2s502gt2tc	Дарсны үйлдвэрлэл төсөл 46х	\N	\N	15	{}	\N
cmpgpyv2g01277s2sc9vd02iv	cmpgpyv0m01197s2s502gt2tc	Шар айрагны төсөл 275x	\N	\N	16	{}	\N
cmpgpyv2k01297s2soza6nilu	cmpgpyv0m01197s2s502gt2tc	Цайны төсөл 54x	\N	\N	17	{}	\N
cmpgpyv2n012b7s2s6dx1pfh8	cmpgpyv0m01197s2s502gt2tc	Байхов цай үйлдвэрлэх төсөл 54х	\N	\N	18	{}	\N
cmpgpyv2r012d7s2saq0w4ls5	cmpgpyv0m01197s2s502gt2tc	Бууз, баншны үйлдвэрийн төсөл 24х	\N	\N	19	{}	\N
cmpgpyv2u012f7s2s2p9aqy00	cmpgpyv0m01197s2s502gt2tc	Монгол бэлэн гоймонгийн төсөл 68x	\N	\N	20	{}	\N
cmpgpyv2x012h7s2syrudqohc	cmpgpyv0m01197s2s502gt2tc	Монгол бэлэн гоймонгийн төсөл 71x	\N	\N	21	{}	\N
cmpgpyv31012j7s2s5e4a5gza	cmpgpyv0m01197s2s502gt2tc	Нарийн боовны үйлдвэрийн төсөл 11х	\N	\N	22	{}	\N
cmpgpyv36012l7s2sjk5wvecb	cmpgpyv0m01197s2s502gt2tc	Талх нарийн боов 37х	\N	\N	23	{}	\N
cmpgpyv39012n7s2s3mzx7owm	cmpgpyv0m01197s2s502gt2tc	Талх нарийн боовны төсөл 17x	\N	\N	24	{}	\N
cmpgpyv3d012p7s2soanp9old	cmpgpyv0m01197s2s502gt2tc	Талх нарийн боовны төсөл 28х	\N	\N	25	{}	\N
cmpgpyv3g012r7s2s5md9lyya	cmpgpyv0m01197s2s502gt2tc	Талх чихэр маркетингийн төлөвлөгөө	\N	\N	26	{}	\N
cmpgpyv3k012t7s2smn2v5aad	cmpgpyv0m01197s2s502gt2tc	Талх, нарийн боов үйлдвэрлэл төсөл 22х	\N	\N	27	{}	\N
cmpgpyv3n012v7s2sexdmmh5s	cmpgpyv0m01197s2s502gt2tc	Түргэн хоол үйлдвэрлэлийн төсөл 20х	\N	\N	28	{}	\N
cmpgpyv3r012x7s2sufy4apv7	cmpgpyv0m01197s2s502gt2tc	Хэрчсэн гурилын үйлдвэрлэлийн төсөл 104x	\N	\N	29	{}	\N
cmpgpyv3v012z7s2sj7uypcl3	cmpgpyv0m01197s2s502gt2tc	Чанамал хиам төсөл 9x	\N	\N	30	{}	\N
cmpgpyv4301337s2sd72zhl8d	cmpgpyv3z01317s2suoz82xch	6 кВ-ын цахилгаан дамжуулах агаарын болон кабель шугамын төсөл	\N	\N	0	{}	\N
cmpgpyv4701357s2s26otasbu	cmpgpyv3z01317s2suoz82xch	620 айлын орон сууц төсөл 58х	\N	\N	1	{}	\N
cmpgpyv4b01377s2s4rf4pyuf	cmpgpyv3z01317s2suoz82xch	900 хүний суудалтай кино театрын барилгын төсөл 219х	\N	\N	2	{}	\N
cmpgpyv4f01397s2smmzlh2bg	cmpgpyv3z01317s2suoz82xch	99 Ханын материал үйлдвэрлэлийн төсөл 46х	\N	\N	3	{}	\N
cmpgpyv4j013b7s2s77l6jptt	cmpgpyv3z01317s2suoz82xch	Айлын орон сууц төсөл 58х	\N	\N	4	{}	\N
cmpgpyv4m013d7s2sgmpeu8xz	cmpgpyv3z01317s2suoz82xch	Асфальтан зам байгуулах цехийн төсөл 78х	\N	\N	5	{}	\N
cmpgpyv4q013f7s2sk2t8hbh6	cmpgpyv3z01317s2suoz82xch	Барилга төсөл 147х	\N	\N	6	{}	\N
cmpgpyv4t013h7s2suhc65fld	cmpgpyv3z01317s2suoz82xch	Дуусаагүй барилгын хуулийн асуудлууд	\N	\N	7	{}	\N
cmpgpyv4x013j7s2sycxze7pw	cmpgpyv3z01317s2suoz82xch	Миний байшин төсөл 42x	\N	\N	8	{}	\N
cmpgpyv51013l7s2sd3d6xakx	cmpgpyv3z01317s2suoz82xch	Орон сууцны төсөл 52x	\N	\N	9	{}	\N
cmpgpyv54013n7s2s9nqmgo10	cmpgpyv3z01317s2suoz82xch	САЙЖРУУЛСАН ШАХМАЛ ТҮЛШНИЙ 25КГ	\N	\N	10	{}	\N
cmpgpyv57013p7s2sadp7trw1	cmpgpyv3z01317s2suoz82xch	Улаанбаатар барилга ХХК гамшгаас хамгаалах төсөл	\N	\N	11	{}	\N
cmpgpyv5a013r7s2sdrxt2d5w	cmpgpyv3z01317s2suoz82xch	Утаагүй шахмал түлшний үйлдвэрийн төсөл 23x	\N	\N	12	{}	\N
cmpgpyv5e013t7s2sq5v892ea	cmpgpyv3z01317s2suoz82xch	Хотхоны цогц үйлчилгээ байгуулах төсөл 34х	\N	\N	13	{}	\N
cmpgpyv5h013v7s2swx4p150i	cmpgpyv3z01317s2suoz82xch	Хувийн орон сууцны угсралт гарын авлага	\N	\N	14	{}	\N
cmpgpyv5k013x7s2sp50ymho7	cmpgpyv3z01317s2suoz82xch	Хуурай зайны үйлдвэр төсөл 29x	\N	\N	15	{}	\N
cmpgpyv5o013z7s2shw1kkoxp	cmpgpyv3z01317s2suoz82xch	Хүний суудалтай кино театрын барилгын төсөл 219х	\N	\N	16	{}	\N
cmpgpyv5r01417s2s7ofyz8h1	cmpgpyv3z01317s2suoz82xch	"Хот суурины гудамж, зам төлөвлөлт" ЗЗБНбД-ийн төсөл	\N	\N	17	{}	\N
cmpgpyv5v01437s2srx92hk3l	cmpgpyv3z01317s2suoz82xch	Блок тоосгоны үйлдвэрлэлийн төсөл 33х	\N	\N	18	{}	\N
cmpgpyv5y01457s2soki3h8dy	cmpgpyv3z01317s2suoz82xch	Блокны үйлдвэр байгуулах төсөл 9х	\N	\N	19	{}	\N
cmpgpyv6101477s2sz1ah108i	cmpgpyv3z01317s2suoz82xch	ПЕНО БЕТОНОН БЛОК ҮЙЛДВЭРЛЭХ ТӨСӨЛ 3x	\N	\N	20	{}	\N
cmpgpyv6501497s2scqhp0gfx	cmpgpyv3z01317s2suoz82xch	Сибет блокны үйлдвэр төсөл 52x	\N	\N	21	{}	\N
cmpgpyv69014b7s2sif6co54o	cmpgpyv3z01317s2suoz82xch	Төмөр бетон тулгуурын үйлдвэрийн төсөл 35х	\N	\N	22	{}	\N
cmpgpyv6c014d7s2s0zqn6r3z	cmpgpyv3z01317s2suoz82xch	Төмөр бетон хашаа үйлдвэрийн төсөл 40х	\N	\N	23	{}	\N
cmpgpyv6f014f7s2s02g4nuts	cmpgpyv3z01317s2suoz82xch	Төмөр блок хашаа	\N	\N	24	{}	\N
cmpgpyv6j014h7s2suzdpdis1	cmpgpyv3z01317s2suoz82xch	Хийт хөнгөн бетон гулдмайн үйлдвэр 17x	\N	\N	25	{}	\N
cmpgpyv6m014j7s2sx66g168z	cmpgpyv3z01317s2suoz82xch	ХӨНГӨН БЛОКНЫ ҮЙЛДВЭР төсөл 21x	\N	\N	26	{}	\N
cmpgpyv6u014n7s2sc2qcv3in	cmpgpyv3z01317s2suoz82xch	Полистиролбетон хөнгөн блокны үйлдвэр 24х	\N	\N	28	{}	\N
cmpgpyv7y014p7s2sz8c9p1b5	cmpgpyv3z01317s2suoz82xch	Галд тэсвэртэй модон хавтан	\N	\N	29	{}	\N
cmpgpyv82014r7s2safk5di6a	cmpgpyv3z01317s2suoz82xch	Галд тэсвэртэй, мод орлох хавтангийн төсөл 35х	\N	\N	30	{}	\N
cmpgpyv86014t7s2s0wielojl	cmpgpyv3z01317s2suoz82xch	Гэр ахуйн модон эдлэл үйлдвэрлэх төсөл 17х	\N	\N	31	{}	\N
cmpgpyv8a014v7s2sgwhunu6k	cmpgpyv3z01317s2suoz82xch	Мужааны цех төсөл 5x	\N	\N	32	{}	\N
cmpgpyv8e014x7s2seml06p47	cmpgpyv3z01317s2suoz82xch	Тавилгын үйлдвэр төсөл 52x	\N	\N	33	{}	\N
cmpgpyv8h014z7s2sfwd2dpue	cmpgpyv3z01317s2suoz82xch	Төмөр хийц болон тавилгын цех төсөл 122x	\N	\N	34	{}	\N
cmpgpyv8l01517s2sdevflh8x	cmpgpyv3z01317s2suoz82xch	Уран дарханы үйл ажиллагаа эрхлэх төсөл	\N	\N	35	{}	\N
cmpgpyv8o01537s2syxq8swiu	cmpgpyv3z01317s2suoz82xch	Ухаалаг тавилга үйлдвэрлэлийн төсөл 29х	\N	\N	36	{}	\N
cmpgpyv8s01557s2sqtfwoyvo	cmpgpyv3z01317s2suoz82xch	Хөөсөнцөрийн үйлдвэрийн төсөл 21х	\N	\N	37	{}	\N
cmpgpyv8v01577s2s1llujgke	cmpgpyv3z01317s2suoz82xch	Хөөсөнцөрийн үйлдвэрийн цахилгаан хангамж дипломын төсөл	\N	\N	38	{}	\N
cmpgpyv8z01597s2s1ty7j4kg	cmpgpyv3z01317s2suoz82xch	Модон эдлэл үйлдвэрлэх төсөл	\N	\N	39	{}	\N
cmpgpyv93015b7s2sn9scjcw6	cmpgpyv3z01317s2suoz82xch	Тавилга үйлдвэрлэлийн төсөл 29х	\N	\N	40	{}	\N
cmpgpyv97015d7s2szda50bvp	cmpgpyv3z01317s2suoz82xch	АВТО УГААЛГА БОЛОН АВТО СЕРВИС төсөл 26х	\N	\N	41	{}	\N
cmpgpyv9a015f7s2sv3elnvrf	cmpgpyv3z01317s2suoz82xch	Авто дугуй засвар 4х	\N	\N	42	{}	\N
cmpgpyv9d015h7s2s4re02dq8	cmpgpyv3z01317s2suoz82xch	Авто засвар	\N	\N	43	{}	\N
cmpgpyv9g015j7s2s4wk9mll8	cmpgpyv3z01317s2suoz82xch	Гагнуурын төв байгуулах төсөл 12х	\N	\N	44	{}	\N
cmpgpyv9k015l7s2ssfsdikgs	cmpgpyv3z01317s2suoz82xch	Гэр ахуйн цахилгаан барааны засвар төсөл 18х	\N	\N	45	{}	\N
cmpgpyv9o015n7s2swsr6rlhl	cmpgpyv3z01317s2suoz82xch	Дугуй, автомашины цахилгаан гагнуурын 15х	\N	\N	46	{}	\N
cmpgpyv9r015p7s2saqhtaar1	cmpgpyv3z01317s2suoz82xch	Дугуй засварын төв байгуулах төсөл 15x	\N	\N	47	{}	\N
cmpgpyv9u015r7s2sh45jwd8m	cmpgpyv3z01317s2suoz82xch	Уртын электрон хэмжүүр төсөл 21x	\N	\N	48	{}	\N
cmpgpyv9y015t7s2skdtbfuqi	cmpgpyv3z01317s2suoz82xch	Гоёлын хашаа үйлдвэрлэх үйлдвэр төсөл	\N	\N	49	{}	\N
cmpgpyva1015v7s2snoy0rhao	cmpgpyv3z01317s2suoz82xch	ДЭЭВРИЙН ВААРАН ЧЕРЕПИЦ ҮЙЛДВЭРЛЭХ төсөл	\N	\N	50	{}	\N
cmpgpyva5015x7s2s241rdm8t	cmpgpyv3z01317s2suoz82xch	Угсармал хашаа	\N	\N	51	{}	\N
cmpgpyvab01617s2slmvn1rr3	cmpgpyva8015z7s2supp4f5vu	Монгол дээл хувцас үйлдвэрлэл төсөл 16x	\N	\N	0	{}	\N
cmpgpyvaf01637s2s416cu5xw	cmpgpyva8015z7s2supp4f5vu	Оёдлын Цехийн Төсөл 120x	\N	\N	1	{}	\N
cmpgpyvaj01657s2sxee9mz7f	cmpgpyva8015z7s2supp4f5vu	Оёдлын жижиг үйлдвэрийг өргөжүүлэх төсөл	\N	\N	2	{}	\N
cmpgpyvan01677s2sc6xvhz93	cmpgpyva8015z7s2supp4f5vu	Оёдлын төсөл 32х	\N	\N	3	{}	\N
cmpgpyvaq01697s2svwfz3dts	cmpgpyva8015z7s2supp4f5vu	Оёдлын цехийн төсөл 14x	\N	\N	4	{}	\N
cmpgpyvat016b7s2sxof4bdcl	cmpgpyva8015z7s2supp4f5vu	Оёдлын цехийн төсөл 15x	\N	\N	5	{}	\N
cmpgpyvax016d7s2s6k22umb8	cmpgpyva8015z7s2supp4f5vu	Оёдлын үйлдвэр байгуулах төсөл 20х	\N	\N	6	{}	\N
cmpgpyvb1016f7s2sczf8m2b5	cmpgpyva8015z7s2supp4f5vu	Оёдолын цехийн төсөл 14х	\N	\N	7	{}	\N
cmpgpyvb4016h7s2s7gh0fure	cmpgpyva8015z7s2supp4f5vu	Оёдолын үйлдвэрлэлийн МОНГОЛ ГОЁЛ төсөл 18x	\N	\N	8	{}	\N
cmpgpyvb7016j7s2scjc0q9fk	cmpgpyva8015z7s2supp4f5vu	ХУВЦАС ЗАХИАЛГА, ЗАСВАРЫГ ӨРГӨЖҮҮЛЭХ ТӨСӨЛ 5х	\N	\N	9	{}	\N
cmpgpyvbb016l7s2sjwbgnj6x	cmpgpyva8015z7s2supp4f5vu	Ажлын бээлий төсөл 20х	\N	\N	10	{}	\N
cmpgpyvbf016n7s2s0ateg0l7	cmpgpyva8015z7s2supp4f5vu	Даавуун ном бизнес төлөвлөгөө	\N	\N	11	{}	\N
cmpgpyvbi016p7s2s3n4zoqfa	cmpgpyva8015z7s2supp4f5vu	Ихэр хувцасны үйлдвэр 13х	\N	\N	12	{}	\N
cmpgpyvbl016r7s2snhluy38x	cmpgpyva8015z7s2supp4f5vu	ОЙМСНЫ ҮЙЛДВЭР БАЙГУУЛАХ ТУХАЙ төсөл 67х	\N	\N	13	{}	\N
cmpgpyvbo016t7s2snw38tchk	cmpgpyva8015z7s2supp4f5vu	САЙЖРУУЛСАН НООСООР ПҮҮЗ ХИЙХ ТӨСӨЛ 14х	\N	\N	14	{}	\N
cmpgpyvbs016v7s2sgffson5j	cmpgpyva8015z7s2supp4f5vu	СҮЛЖМЭЛ ЭДЛЭЛИЙН ҮЙЛДВЭР төсөл 7x	\N	\N	15	{}	\N
cmpgpyvbw016x7s2svp97pry2	cmpgpyva8015z7s2supp4f5vu	Хатгамал эдлэл төсөл	\N	\N	16	{}	\N
cmpgpyvbz016z7s2stlhqyliv	cmpgpyva8015z7s2supp4f5vu	Хулдаасан хэвлэл	\N	\N	17	{}	\N
cmpgpyvc301717s2s5l4sx0ee	cmpgpyva8015z7s2supp4f5vu	Хулдаасны үйлдвэр төсөл 18x	\N	\N	18	{}	\N
cmpgpyvc601737s2saapreimn	cmpgpyva8015z7s2supp4f5vu	Ээрмэлийн үйлдвэр төсөл 37x	\N	\N	19	{}	\N
cmpgpyvca01757s2si42lw8g5	cmpgpyva8015z7s2supp4f5vu	Эмэгтэй бүс 18х	\N	\N	20	{}	\N
cmpgpyvce01777s2steh392sj	cmpgpyva8015z7s2supp4f5vu	Эсгий урлалийн төсөл 9х	\N	\N	21	{}	\N
cmpgpyvcl017b7s2si8fzzrsl	cmpgpyvci01797s2stnbh93yt	Гурилын үйлдвэрийн төсөл 15х	\N	\N	0	{}	\N
cmpgpyvcq017d7s2st28mw5un	cmpgpyvci01797s2stnbh93yt	Хэрчсэн Гурил Боловсруулах Үйлдвэрийн Төсөл 15x	\N	\N	1	{}	\N
cmpgpyvcu017f7s2sv6gsrwt0	cmpgpyvci01797s2stnbh93yt	Хэрчсэн гурилны үйлдвэр төсөл 19x	\N	\N	2	{}	\N
cmpgpyvcx017h7s2svfchg4m4	cmpgpyvci01797s2stnbh93yt	100 сүүний үнээний эрчимжсэн аж ахуйн төсөл 21х	\N	\N	3	{}	\N
cmpgpyvd1017j7s2s459uzx55	cmpgpyvci01797s2stnbh93yt	50 сүүний үнээний ферм	\N	\N	4	{}	\N
cmpgpyvd4017l7s2stkhsr2od	cmpgpyvci01797s2stnbh93yt	Сайн чанарын сүүний үйлдвэр байгуулах төсөл 43x	\N	\N	5	{}	\N
cmpgpyvd8017n7s2slm8myds5	cmpgpyvci01797s2stnbh93yt	СҮҮ СҮҮН БҮТЭЭГДЭХҮҮНИЙ ҮЙЛДВЭРЛЭЛ ХУДАЛДААНД МӨРДӨХ ТЕХНИКИЙН ЗОХИЦУУЛАЛТ 21х	\N	\N	6	{}	\N
cmpgpyvdc017p7s2s12jaanls	cmpgpyvci01797s2stnbh93yt	Сүү боловсруулах үйлдвэрийн төсөл 27x	\N	\N	7	{}	\N
cmpgpyvdf017r7s2sn050p6et	cmpgpyvci01797s2stnbh93yt	Сүү сүүн бүтээгдэхүүн төсөл 43х	\N	\N	8	{}	\N
cmpgpyvdj017t7s2s8g8ab8l5	cmpgpyvci01797s2stnbh93yt	Сүү цагаан идээ боловсруулах төсөл 27х	\N	\N	9	{}	\N
cmpgpyvdn017v7s2s1fga6dnp	cmpgpyvci01797s2stnbh93yt	Сүү цагаан идээний төсөл 14х	\N	\N	10	{}	\N
cmpgpyvdr017x7s2skw6xdu9q	cmpgpyvci01797s2stnbh93yt	Сүү, сүүн бүтээгдэхүүн үйлдвэрлэх төсөл 37х	\N	\N	11	{}	\N
cmpgpyvdu017z7s2scoe4qfom	cmpgpyvci01797s2stnbh93yt	Сүүний зах зээлийн судалгаа	\N	\N	12	{}	\N
cmpgpyvdx01817s2sfbjifvka	cmpgpyvci01797s2stnbh93yt	Сүүний үйлдвэр төсөл 36x	\N	\N	13	{}	\N
cmpgpyve101837s2sxh07i6pz	cmpgpyvci01797s2stnbh93yt	Сүүний үйлдвэрийн гарын авлага	\N	\N	14	{}	\N
cmpgpyve501857s2s51vnnt5u	cmpgpyvci01797s2stnbh93yt	Хуурай сүүний төсөл 28x	\N	\N	15	{}	\N
cmpgpyve901877s2sg7egiaiv	cmpgpyvci01797s2stnbh93yt	Хуурай сүүний төсөл 37x	\N	\N	16	{}	\N
cmpgpyvec01897s2s3jfh6s1n	cmpgpyvci01797s2stnbh93yt	Хуурай сүүний үйлдвэрлэл төсөл 22x	\N	\N	17	{}	\N
cmpgpyvef018b7s2sijyl6c4s	cmpgpyvci01797s2stnbh93yt	Цагаан идээний үйлдвэрийн төсөл 35х	\N	\N	18	{}	\N
cmpgpyvej018d7s2s44rnu6q2	cmpgpyvci01797s2stnbh93yt	Сүүний үхрийн аж ахуйн төсөл 43х	\N	\N	19	{}	\N
cmpgpyven018f7s2seri8a2ug	cmpgpyvci01797s2stnbh93yt	Үнээний ферм төсөл 26x	\N	\N	20	{}	\N
cmpgpyveq018h7s2s3ezbkq0o	cmpgpyvci01797s2stnbh93yt	Үнээний ферм төсөл 47х	\N	\N	21	{}	\N
cmpgpyvet018j7s2soa8jqhl2	cmpgpyvci01797s2stnbh93yt	Баяжуулах үйлдвэрийн тез	\N	\N	22	{}	\N
cmpgpyvf0018l7s2sq1fw73zv	cmpgpyvci01797s2stnbh93yt	Маслоны үйлдвэрлэлийн төсөл 19х	\N	\N	23	{}	\N
cmpgpyvf4018n7s2s0ak5m3uz	cmpgpyvci01797s2stnbh93yt	Тослог ургамлын үр боловсруулах үйлдвэр төсөл 79x	\N	\N	24	{}	\N
cmpgpyvf8018p7s2ssteii4k8	cmpgpyvci01797s2stnbh93yt	Ургамалын тосны үйлдвэрийн төсөл 32x	\N	\N	25	{}	\N
cmpgpyvfc018r7s2snnti2oq0	cmpgpyvci01797s2stnbh93yt	Амны алчуур салфетка бизнес төлөвлөгөө	\N	\N	26	{}	\N
cmpgpyvff018t7s2siqjx887u	cmpgpyvci01797s2stnbh93yt	Давсны үйлдвэр төсөл	\N	\N	27	{}	\N
cmpgpyvfj018v7s2stuh045zq	cmpgpyvci01797s2stnbh93yt	Давсны үйлдвэрийн төсөл 30х	\N	\N	28	{}	\N
cmpgpyvfn018x7s2sncy9rsko	cmpgpyvci01797s2stnbh93yt	Сав баглаа үйлдвэрлэлийн төсөл 33х	\N	\N	29	{}	\N
cmpgpyvfq018z7s2stw2w9vkx	cmpgpyvci01797s2stnbh93yt	Самар боловсруулах үйлдвэр төсөл 22x	\N	\N	30	{}	\N
cmpgpyvft01917s2s81s20jsl	cmpgpyvci01797s2stnbh93yt	Сүрлийн үйлдвэр төсөл 18x	\N	\N	31	{}	\N
cmpgpyvfx01937s2s0f5f2a4t	cmpgpyvci01797s2stnbh93yt	Утаагүй түлш төсөл 21x	\N	\N	32	{}	\N
cmpgpyvg101957s2s97muv557	cmpgpyvci01797s2stnbh93yt	ХОГ ХАЯГДАЛ ДАХИН БОЛОВСРУУЛАХ төсөл 19х	\N	\N	33	{}	\N
cmpgpyvg501977s2s41i1uqaj	cmpgpyvci01797s2stnbh93yt	ХОГИЙН САВ ТӨСӨЛ 20х	\N	\N	34	{}	\N
cmpgpyvg801997s2sdvfeeofp	cmpgpyvci01797s2stnbh93yt	Ханын цаасны үйлдвэр төсөл 90x	\N	\N	35	{}	\N
cmpgpyvgb019b7s2s1v23fso3	cmpgpyvci01797s2stnbh93yt	Хаягдал цаас дахин болвсруулж, цаасан уут хийх төсөл 18х	\N	\N	36	{}	\N
cmpgpyvge019d7s2swtdhn1ig	cmpgpyvci01797s2stnbh93yt	Хог боловсруулах төсөл 69x	\N	\N	37	{}	\N
cmpgpyvgi019f7s2sqxjncyxy	cmpgpyvci01797s2stnbh93yt	Хог боловсруулах төсөл 93x	\N	\N	38	{}	\N
cmpgpyvgm019h7s2sxca8dhio	cmpgpyvci01797s2stnbh93yt	Хог хаягдалын тухай 15х	\N	\N	39	{}	\N
cmpgpyvgq019j7s2sackugx40	cmpgpyvci01797s2stnbh93yt	Хуурай болон нойтон салфетка төсөл 42х	\N	\N	40	{}	\N
cmpgpyvgu019l7s2s2dh0ftbf	cmpgpyvci01797s2stnbh93yt	ХҮНСНИЙ 8 НЭРИЙН ДЭЛГҮҮР БАЙГУУЛАХ төсөл 20х	\N	\N	41	{}	\N
cmpgpyvgx019n7s2scdihlr73	cmpgpyvci01797s2stnbh93yt	Цаасан уут үйлдвэрлэх төсөл 71х	\N	\N	42	{}	\N
cmpgpyvh1019p7s2s86p6uxtf	cmpgpyvci01797s2stnbh93yt	Цаасан уутны үйлдвэрлэл төсөл 75х	\N	\N	43	{}	\N
cmpgpyvh4019r7s2s2em3xk7d	cmpgpyvci01797s2stnbh93yt	Цаасан уутны үйлдвэрлэл төсөл 78х	\N	\N	44	{}	\N
cmpgpyvh8019t7s2sxn97qig5	cmpgpyvci01797s2stnbh93yt	Цэвэр Усны Үйлдвэрийн Төсөл	\N	\N	45	{}	\N
cmpgpyvhb019v7s2s5d0pwi5x	cmpgpyvci01797s2stnbh93yt	Цэвэр ус төсөл Хөвсгөл	\N	\N	46	{}	\N
cmpgpyvhf019x7s2sfxxwwzxl	cmpgpyvci01797s2stnbh93yt	Цэлцэгнүүрийн үйлдвэр төсөл 27x	\N	\N	47	{}	\N
cmpgpyvhj019z7s2soo641w8m	cmpgpyvci01797s2stnbh93yt	ЧИХЭРЛЭГ УНДААНЫ ХЭРЭГЛЭЭ 8х	\N	\N	48	{}	\N
cmpgpyvhn01a17s2sw7g15ppm	cmpgpyvci01797s2stnbh93yt	Ил захидлын үйлдвэр 58х	\N	\N	49	{}	\N
cmpgpyvhq01a37s2sohiu05f9	cmpgpyvci01797s2stnbh93yt	Цасан уутны төсөл 12х	\N	\N	50	{}	\N
cmpgpyvht01a57s2s4haywwqu	cmpgpyvci01797s2stnbh93yt	Цэвэр усны үйлдвэрийн бизнес төсөл 43х	\N	\N	51	{}	\N
cmpgpyvi101a97s2sw4e0mhuj	cmpgpyvhx01a77s2sedb6rghl	Lion зочид буудал 21х	\N	\N	0	{}	\N
cmpgpyvi401ab7s2sk9w7lb55	cmpgpyvhx01a77s2sedb6rghl	Рашаан хамгаалах, моджуулах төсөл 42х	\N	\N	1	{}	\N
cmpgpyvi701ad7s2s7ap829v2	cmpgpyvhx01a77s2sedb6rghl	АМРАЛТ, СУВИЛЛЫН ЦОГЦОЛБОР ОНОН төсөл 42х	\N	\N	2	{}	\N
cmpgpyvic01af7s2svnj6wcvb	cmpgpyvhx01a77s2sedb6rghl	Ахмадын амралтын газар төсөл 22х	\N	\N	3	{}	\N
cmpgpyvif01ah7s2svq57bjpw	cmpgpyvhx01a77s2sedb6rghl	Зочид буудал байгуулах төсөл 28х	\N	\N	4	{}	\N
cmpgpyvij01aj7s2sn37w9g15	cmpgpyvhx01a77s2sedb6rghl	ХҮҮХДИЙН ТОГЛООМЫН ТАЛБАЙН ТӨСӨЛ 8х	\N	\N	5	{}	\N
cmpgpyvin01al7s2sqw34fr5t	cmpgpyvhx01a77s2sedb6rghl	Цэцэрлэгт хүрээлэнгийн төсөл 50x	\N	\N	6	{}	\N
cmpgpyviq01an7s2soas6lue0	cmpgpyvhx01a77s2sedb6rghl	MAK Цагаан Суварга төсөл 59х	\N	\N	7	{}	\N
cmpgpyviu01ap7s2so7woz2uf	cmpgpyvhx01a77s2sedb6rghl	Аялал жуулчлалын цогцолбор төсөл 59х	\N	\N	8	{}	\N
cmpgpyvix01ar7s2spg34eftr	cmpgpyvhx01a77s2sedb6rghl	Аялал жуулчлалын "ЖОНОН" бааз байгуулах төсөл 5х	\N	\N	9	{}	\N
cmpgpyvj001at7s2skd6ll5ce	cmpgpyvhx01a77s2sedb6rghl	Багц аялалын төсөл 27х	\N	\N	10	{}	\N
cmpgpyvj401av7s2sixs7algl	cmpgpyvhx01a77s2sedb6rghl	Монгол гэр аялалын бизнес	\N	\N	11	{}	\N
cmpgpyvj701ax7s2sc64q9rn5	cmpgpyvhx01a77s2sedb6rghl	Монголын Аялал Жуулчлалын Төсөл	\N	\N	12	{}	\N
cmpgpyvjb01az7s2s1ocmv756	cmpgpyvhx01a77s2sedb6rghl	Монголын аялал жуулчлалын бизнес	\N	\N	13	{}	\N
cmpgpyvjf01b17s2soq6j15x2	cmpgpyvhx01a77s2sedb6rghl	Хэнтий аймагт аялал жуулчлалын төсөл 60x	\N	\N	14	{}	\N
cmpgpyvjj01b37s2s4bxbj89r	cmpgpyvhx01a77s2sedb6rghl	Аялал	\N	\N	15	{}	\N
cmpgpyvjm01b57s2sih76w19r	cmpgpyvhx01a77s2sedb6rghl	Залуучуудын амралтын цаг зөв боловсон өнгөөрөөх төвийн төсөл 25х	\N	\N	16	{}	\N
cmpgpyvjp01b77s2sbf111li8	cmpgpyvhx01a77s2sedb6rghl	Иог сургалтын төв төсөл 13х	\N	\N	17	{}	\N
cmpgpyvjt01b97s2sahuzqozj	cmpgpyvhx01a77s2sedb6rghl	НОМЫН САН БОЛОН ЦЭЦЭРЛЭГТ ХҮРЭЭЛЭН БАЙГУУЛАХ ТӨСӨЛ 50х	\N	\N	18	{}	\N
cmpgpyvjx01bb7s2s3f7ychco	cmpgpyvhx01a77s2sedb6rghl	Фитнесс клуб байгуулах төсөл 32x	\N	\N	19	{}	\N
cmpgpyvk001bd7s2sdiopkqjj	cmpgpyvhx01a77s2sedb6rghl	Халуун усны газар байгуулах төсөл 13х	\N	\N	20	{}	\N
cmpgpyvk401bf7s2sdyio0w8h	cmpgpyvhx01a77s2sedb6rghl	Халуун усны төсөл 20x	\N	\N	21	{}	\N
cmpgpyvk801bh7s2snbbygs1q	cmpgpyvhx01a77s2sedb6rghl	Эмэгтэйчүүдийн Фитнесс төв төсөл 21x	\N	\N	22	{}	\N
cmpgpyvkc01bj7s2sp985gb0x	cmpgpyvhx01a77s2sedb6rghl	Нийтийн үйлчилгээ халуун ус, үсчин 27х	\N	\N	23	{}	\N
cmpgpyvkf01bl7s2sw1h84h68	cmpgpyvhx01a77s2sedb6rghl	Арьс гоо засал төсөл 20х	\N	\N	24	{}	\N
cmpgpyvki01bn7s2smukf56nj	cmpgpyvhx01a77s2sedb6rghl	Гоо сайхны 10 саяын төсөл	\N	\N	25	{}	\N
cmpgpyvkm01bp7s2sdkwmtawa	cmpgpyvhx01a77s2sedb6rghl	Нийтийн үйлчилгээний төсөл 27x	\N	\N	26	{}	\N
cmpgpyvkp01br7s2say36pwmy	cmpgpyvhx01a77s2sedb6rghl	Маникурын салоны төсөл 19х	\N	\N	27	{}	\N
cmpgpyvkt01bt7s2s49g7eajc	cmpgpyvhx01a77s2sedb6rghl	Үсчин гоо сайханы төсөл 13х	\N	\N	28	{}	\N
cmpgpyvkw01bv7s2sepk60vqq	cmpgpyvhx01a77s2sedb6rghl	АВТОМАТ ТОГЛООМЫН ТӨВ төсөл	\N	\N	29	{}	\N
cmpgpyvl001bx7s2s9tssni6z	cmpgpyvhx01a77s2sedb6rghl	ДУГУЙ ЗАСВАР 24 ЦАГ 14х	\N	\N	30	{}	\N
cmpgpyvl301bz7s2sgo6x1e3r	cmpgpyvhx01a77s2sedb6rghl	Кино студи хийх төсөл 10х	\N	\N	31	{}	\N
cmpgpyvl601c17s2s29l46mpn	cmpgpyvhx01a77s2sedb6rghl	Минимаркет байгуулах төсөл 20х	\N	\N	32	{}	\N
cmpgpyvla01c37s2s5h1alsi4	cmpgpyvhx01a77s2sedb6rghl	Супермаркет байгуулах төсөл 80х	\N	\N	33	{}	\N
cmpgpyvle01c57s2s2dtd6bqq	cmpgpyvhx01a77s2sedb6rghl	Сургалтын төв байгуулах бизнес төлөвлөгөө	\N	\N	34	{}	\N
cmpgpyvlh01c77s2sljqxq8ij	cmpgpyvhx01a77s2sedb6rghl	Харшил төсөл	\N	\N	35	{}	\N
cmpgpyvlk01c97s2s1gsnoiue	cmpgpyvhx01a77s2sedb6rghl	ШТС төсөл Багахангай 21x	\N	\N	36	{}	\N
cmpgpyvln01cb7s2sbond53hi	cmpgpyvhx01a77s2sedb6rghl	ЭРҮҮЛ ШҮД — ЭРҮҮЛ ХҮҮХЭД төсөл 19x	\N	\N	37	{}	\N
cmpgpyvlr01cd7s2sjk1amu6n	cmpgpyvhx01a77s2sedb6rghl	Эрүүл мэндийг дэмжих төсөл 8х	\N	\N	38	{}	\N
cmpgpyvlu01cf7s2s9vf4cbme	cmpgpyvhx01a77s2sedb6rghl	Нийтийн тээврийн төсөл хэрэгжүүлэх судалгаа 14х	\N	\N	39	{}	\N
cmpgpyvly01ch7s2si17sx09v	cmpgpyvhx01a77s2sedb6rghl	Хэмжээст кино театр төсөл 67х	\N	\N	40	{}	\N
cmpgpyvm101cj7s2swf03c3tp	cmpgpyvhx01a77s2sedb6rghl	ӨРГӨӨ КИНО ТЕАТРЫН МАРКЕТИНГИЙН ТӨЛӨВЛӨГӨӨ	\N	\N	41	{}	\N
cmpgpyvmk01ct7s2sf1cwwmn8	cmpgpyvm501cl7s2symruztuu	Бизнес төлөвлөлт загвар	\N	\N	3	{}	\N
cmpgpyvmo01cv7s2sy26r5d72	cmpgpyvm501cl7s2symruztuu	ДААТГАЛЫН ЗУУЧЛАЛ дипломын төсөл	\N	\N	4	{}	\N
cmpgpyvmr01cx7s2sn0154mg2	cmpgpyvm501cl7s2symruztuu	Маркетинг төлөвлөгөө загвар	\N	\N	5	{}	\N
cmpgpyvmv01cz7s2se7lxzab2	cmpgpyvm501cl7s2symruztuu	Маркетингийн судалгаа загвар 1	\N	\N	6	{}	\N
cmpgpyvmz01d17s2s8xmr3dru	cmpgpyvm501cl7s2symruztuu	Маркетингийн судалгаа загвар 2	\N	\N	7	{}	\N
cmpgpyvn201d37s2sr4h3yswg	cmpgpyvm501cl7s2symruztuu	Маркетингийн төлөвлөгөө загвар	\N	\N	8	{}	\N
cmpgpyvn601d57s2s5f6weewd	cmpgpyvm501cl7s2symruztuu	НВЦ ХХК-ийн маркетингийн судалгаа	\N	\N	9	{}	\N
cmpgpyvmc01cp7s2stcbuzay4	cmpgpyvm501cl7s2symruztuu	OCB JS систем дипломын ажил	\N	\N	1	{cmpha2czh00097s04xqvy4sdj}	\N
cmpgpyvmg01cr7s2sibkiz27s	cmpgpyvm501cl7s2symruztuu	Бизнес төлөвлөгөө бичих	\N	\N	2	{cmpha2hm7000b7s048ewlraxc}	\N
cmpgpyvnb01d77s2s0purw453	cmpgpyvm501cl7s2symruztuu	НЭМҮҮ ӨРТГИЙН СҮЛЖЭЭГ ХӨГЖҮҮЛЭХ (НӨСХ)	\N	\N	10	{}	\N
cmpgpyvnf01d97s2swyr91qo5	cmpgpyvm501cl7s2symruztuu	Свот шинжилгээ	\N	\N	11	{}	\N
cmpgpyvni01db7s2s7vm1h49j	cmpgpyvm501cl7s2symruztuu	Төсөл бичих аргачлал	\N	\N	12	{}	\N
cmpgpyvnm01dd7s2smpvn4tns	cmpgpyvm501cl7s2symruztuu	Төсөл бичих	\N	\N	13	{}	\N
cmpgpyvnq01df7s2s196vfwsu	cmpgpyvm501cl7s2symruztuu	ШИНЭ БҮТЭЭГДЭХҮҮНИЙ МАРКЕТИНГИЙН УДИРДЛАГА	\N	\N	14	{}	\N
cmpgpyvnt01dh7s2suv3qjzg8	cmpgpyvm501cl7s2symruztuu	Шинэ суудлын машины маркетингийн судалгаа	\N	\N	15	{}	\N
cmpgpyvnw01dj7s2sdm3fgg6d	cmpgpyvm501cl7s2symruztuu	Үйлчилгээний маркетинг загвар	\N	\N	16	{}	\N
cmpgpyvo001dl7s2sn4f0deoh	cmpgpyvm501cl7s2symruztuu	Үндэстэн дамнасан корпораци бие даалт	\N	\N	17	{}	\N
cmpgpyvo701dn7s2sd7oyvloi	cmpgpyvm501cl7s2symruztuu	Арилжааны банк	\N	\N	18	{}	\N
cmpgpyvob01dp7s2s1asfor9j	cmpgpyvm501cl7s2symruztuu	Арилжааны банкны жижиг зээлийн судалгаа 11х	\N	\N	19	{}	\N
cmpgpyvoh01dr7s2s70fa08tl	cmpgpyvm501cl7s2symruztuu	Баланс шинжилгээний загвар	\N	\N	20	{}	\N
cmpgpyvok01dt7s2sh2ya38mw	cmpgpyvm501cl7s2symruztuu	Банкны зээлийн эрсдэл бууруулах судалгаа	\N	\N	21	{}	\N
cmpgpyvoo01dv7s2s39pfra3b	cmpgpyvm501cl7s2symruztuu	Барьсан багц дипломын ажил	\N	\N	22	{}	\N
cmpgpyvos01dx7s2s1tkhonly	cmpgpyvm501cl7s2symruztuu	Зээлийн эрсдэлийн шинжилгээ	\N	\N	23	{}	\N
cmpgpyvov01dz7s2semfrmwzf	cmpgpyvm501cl7s2symruztuu	Санхүүгийн шинжилгээ	\N	\N	24	{}	\N
cmpgpyvp001e17s2szi0r1sg7	cmpgpyvm501cl7s2symruztuu	Санхүүгийн шинжилгээний гарын авлага	\N	\N	25	{}	\N
cmpgpyvp301e37s2slgee4eao	cmpgpyvm501cl7s2symruztuu	Хараа плаза хөрөнгө оруулалтын зээлийн төсөл 38x	\N	\N	26	{}	\N
cmpgpyvp701e57s2sf7ni1kt1	cmpgpyvm501cl7s2symruztuu	Хэвлэлийн менежмент	\N	\N	27	{}	\N
cmpgpyvpb01e77s2s1xzxbx85	cmpgpyvm501cl7s2symruztuu	ДОЛОО ХЭМЖИЖ НЭГ ОГТОЛ төсөл 10х	\N	\N	28	{}	\N
cmpgpyvpf01e97s2s82smci9c	cmpgpyvm501cl7s2symruztuu	ЖДҮ төсөл 12х	\N	\N	29	{}	\N
cmpgpyvpi01eb7s2scfl18m9j	cmpgpyvm501cl7s2symruztuu	ЖДҮ-н төслийн жишиг загвар 11х	\N	\N	30	{}	\N
cmpgpyvpm01ed7s2silvgtbj7	cmpgpyvm501cl7s2symruztuu	Жижиг зээлийн төслийн загвар 23х	\N	\N	31	{}	\N
cmpgpyvpq01ef7s2s2sfmzhnv	cmpgpyvm501cl7s2symruztuu	Төслийн менежмент 43х	\N	\N	32	{}	\N
cmpgpyvpv01eh7s2s2m5tn1wr	cmpgpyvm501cl7s2symruztuu	Төслийн хуваарь ба төсөвлөлт, загвар 52х	\N	\N	33	{}	\N
cmpgpyvq001ej7s2sj0tapla8	cmpgpyvm501cl7s2symruztuu	Төсөл загвар 32х	\N	\N	34	{}	\N
cmpgpyvq401el7s2sgna7z65e	cmpgpyvm501cl7s2symruztuu	Боловсон 00 төсөл 36х	\N	\N	35	{}	\N
cmpgpyvq901en7s2sywlfugsm	cmpgpyvm501cl7s2symruztuu	Гамшгийн менежмент бие даалт	\N	\N	36	{}	\N
cmpgpyvrw01ep7s2s4x8wsgcn	cmpgpyvm501cl7s2symruztuu	Клоуд орчинд өгөгдлийг аюулгүйгээр устгах судалгаа	\N	\N	37	{}	\N
cmpgpyvvp01er7s2sjhwkir91	cmpgpyvm501cl7s2symruztuu	Олон Улсын Эдийн Засгийн Харилцаа	\N	\N	38	{}	\N
cmpgpyvwx01et7s2s6l1q826i	cmpgpyvm501cl7s2symruztuu	Сургууль байгуулах төсөл	\N	\N	39	{}	\N
cmpgpyvx001ev7s2s0pujx30u	cmpgpyvm501cl7s2symruztuu	ХҮҮХДИЙН ЦЭЦЭРЛЭГ БАЙГУУЛАХ төсөл 22x	\N	\N	40	{}	\N
cmpgpyvx401ex7s2skcjubzq3	cmpgpyvm501cl7s2symruztuu	Хөдөлмөрийн аюулгүй ажиллагаа курсын ажил	\N	\N	41	{}	\N
cmpgpyvx901ez7s2skddc8izj	cmpgpyvm501cl7s2symruztuu	Шинжлэх ухаан технологийн төсөл 53x	\N	\N	42	{}	\N
cmpgpyvxn01f17s2sw7nyqlnn	cmpgpyvm501cl7s2symruztuu	Ichimoku Kinko Hyo арилжааны систем	\N	\N	43	{}	\N
cmpgpyvxr01f37s2s0zpfv5tr	cmpgpyvm501cl7s2symruztuu	PC тоглоом хийцийн төсөл	\N	\N	44	{}	\N
cmpgpyvxv01f57s2s11srxj5b	cmpgpyvm501cl7s2symruztuu	PC game 4х	\N	\N	45	{}	\N
cmpgpyvxz01f77s2sx47cqdwi	cmpgpyvm501cl7s2symruztuu	Бүртгэл тооцооны систем бие даалт	\N	\N	46	{}	\N
cmpgpyvy301f97s2s5bh8eezt	cmpgpyvm501cl7s2symruztuu	Гар утас дагалдах хэрэгслийн төсөл 22х	\N	\N	47	{}	\N
cmpgpyvy801fb7s2sjb155n6r	cmpgpyvm501cl7s2symruztuu	Гар утас, ИНТЕРНЭТ ХЭРЭГЛЭГЧийн судалгаа	\N	\N	48	{}	\N
cmpgpyvye01fd7s2s7xgm22o2	cmpgpyvm501cl7s2symruztuu	Кабелийн утасны төсөл 23х	\N	\N	49	{}	\N
cmpgpyvyl01ff7s2s7g3uuxa1	cmpgpyvm501cl7s2symruztuu	Компьютер болон түүний дагалдах хэрэгслийн засвар, төсөл 21х	\N	\N	50	{}	\N
cmpgpyvyt01fh7s2sbp3pm3rp	cmpgpyvm501cl7s2symruztuu	Компьютерийн үйлчилгээний төв байгуулах төсөл 20х	\N	\N	51	{}	\N
cmpgpyvyy01fj7s2s2ycnj2t2	cmpgpyvm501cl7s2symruztuu	Нийтлэг зүйл нэр томъёо стандартчилал	\N	\N	52	{}	\N
cmpgpyvz201fl7s2suhvs475v	cmpgpyvm501cl7s2symruztuu	Онлайн худалдааны системийн тест хийх гарын авлага 12х	\N	\N	53	{}	\N
cmpgpyvz801fn7s2s2mohxz3i	cmpgpyvm501cl7s2symruztuu	Покерын тоглоом дипломын ажил	\N	\N	54	{}	\N
cmpgpyvzf01fp7s2ssl8rie0k	cmpgpyvm501cl7s2symruztuu	УХААЛАГ ЭЛЕКТРОН ХЭРЭГСЭЛ гарын авлага	\N	\N	55	{}	\N
cmpgpyvzl01fr7s2sdron9i6y	cmpgpyvm501cl7s2symruztuu	Хадгаламж бүртгэлийн систем дипломын ажил	\N	\N	56	{}	\N
cmpgpyvzp01ft7s2siutd7lfl	cmpgpyvm501cl7s2symruztuu	Хиб техникийн шаардлага	\N	\N	57	{}	\N
cmpgpyvzy01fx7s2stk1g5rmr	cmpgpyvzu01fv7s2siuvpo6ht	Бизнес төлөвлөгөө бичих аргачлал	\N	\N	0	{}	\N
cmpgpyw0201fz7s2skwr438iu	cmpgpyvzu01fv7s2siuvpo6ht	Гэрээний загварын эмхэтгэл	\N	\N	1	{}	\N
cmpgpyw0a01g37s2snsufdzom	cmpgpyvzu01fv7s2siuvpo6ht	Жижиг зээлийн төслийн загвар	\N	\N	3	{}	\N
cmpgpyw0k01g57s2sxipm22mi	cmpgpyvzu01fv7s2siuvpo6ht	ТӨСЛИЙН ҮНЭЛГЭЭ, ТӨСЛИЙН МӨНГӨН УРСГАЛЫН ШИНЖИЛГЭЭ	\N	\N	4	{}	\N
cmpgpyw0p01g77s2stt6scftw	cmpgpyvzu01fv7s2siuvpo6ht	ТӨСӨЛ ХЭРХЭН БИЧИЖ САНХҮҮЖИЛТ АВАХ	\N	\N	5	{}	\N
cmpgpyw0t01g97s2sjtqgtfv4	cmpgpyvzu01fv7s2siuvpo6ht	Төслийн загвар	\N	\N	6	{}	\N
cmpgpyw0y01gb7s2sy6pwhax1	cmpgpyvzu01fv7s2siuvpo6ht	Төсөл бичих аргачлал	\N	\N	7	{}	\N
cmpgpyw1201gd7s2s2xypwlpv	cmpgpyvzu01fv7s2siuvpo6ht	ХӨРӨНГӨ ОРУУЛАЛТЫН ТӨСЛИЙН гарын авлага 140х	\N	\N	8	{}	\N
cmpgpyw1601gf7s2sxl3f6e4j	cmpgpyvzu01fv7s2siuvpo6ht	ЧАНАРЫН УДИРДЛАГЫН ТОГТОЛЦОО	\N	\N	9	{}	\N
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Category" (id, name, slug, description, "sortOrder", "createdAt", "updatedAt", icon) FROM stdin;
cmpgpysoy00017s2secgw3nwv	Хүлэмж, тариалан	hulemj-tarialan	Хүлэмж, чацаргана, мод, мөөг, ногоо	2	2026-05-22 09:30:41.218	2026-05-22 09:30:41.218	sprout
cmpgpysp700027s2s6093zhyg	Ресторан, кафе, хоол	restoran-hool	Зоогийн газар, кафе, талх, дарс	3	2026-05-22 09:30:41.227	2026-05-22 09:30:41.227	utensils
cmpgpyspf00037s2sa8e0ta28	Барилга, тавилга, авто	barilga-tavlga	Барилга, блок, тавилга, авто засвар	4	2026-05-22 09:30:41.236	2026-05-22 09:30:41.236	building
cmpgpyspo00047s2sn9t1thk2	Оёдол, нэхмэл, хувцас	oiodol-huvtsas	Оёдлын цех, нэхмэл эдлэл, хувцас	5	2026-05-22 09:30:41.244	2026-05-22 09:30:41.244	scissors
cmpgpyspw00057s2sv6qujibx	Хүнс боловсруулах үйлдвэр	huns-uildver	Гурил, сүүн бүтээгдэхүүн, масло, бусад	6	2026-05-22 09:30:41.253	2026-05-22 09:30:41.253	factory
cmpgpysq300067s2sfnphvq5q	Үйлчилгээ, аялал, амралт	uilchilgee-ayalal	Зочид буудал, аялал, фитнесс, гоо сайхан	7	2026-05-22 09:30:41.259	2026-05-22 09:30:41.259	plane
cmpgpysq900077s2shwn148fo	Маркетинг, боловсрол, технологи	marketing-bolovsrol	Маркетинг, санхүү, менежмент, IT	8	2026-05-22 09:30:41.266	2026-05-22 09:30:41.266	trending-up
cmpij23v200007s049qukl9zj	Байгууллагын баримт	alban-barimtuud	Байгууллага, ХХК, стартапд зориулсан бэлэн бичиг баримтын загварууд	10	2026-05-23 15:52:50.702	2026-05-23 15:52:50.702	📋
cmpgpyso800007s2s80pke02w	Мал аж ахуй	mal-aj-ahui	Сүүний үнээ, мах, тахиа, гахай, ноолуур	1	2026-05-22 09:30:41.192	2026-05-22 09:30:41.192	sheep
\.


--
-- Data for Name: Coupon; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Coupon" (id, code, type, value, "minPrice", "maxUses", "usedCount", active, "expiresAt", "createdAt", "updatedAt") FROM stdin;
cmpcyalze00007s80sgkgc0on	NEXT10	PERCENT	25.00	\N	\N	0	t	2026-05-30 00:00:00	2026-05-19 18:12:44.618	2026-05-19 18:12:44.618
\.


--
-- Data for Name: Course; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Course" (id, "productId") FROM stdin;
\.


--
-- Data for Name: CourseModule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CourseModule" (id, "courseId", title, "sortOrder") FROM stdin;
\.


--
-- Data for Name: Download; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Download" (id, "userId", "fileId", "createdAt") FROM stdin;
cmph7dpy400077sssq5xbkwlv	cmpb6tahi00017sp4hxu4tvlz	cmpgwiv5a00017shk5fygoy5s	2026-05-22 17:38:10.972
\.


--
-- Data for Name: FAQ; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FAQ" (id, question, answer, "sortOrder", "createdAt", active, category, "updatedAt") FROM stdin;
cmpgpyt2r004y7s2si1gsfg5c	Файлуудыг банкинд шуудхан өгч болох уу?	Тийм. Файл бүр банк болон ЖДҮ сангийн стандарт бүтэцтэй тохирсон. Зөвхөн тоо, нэр, огноогоо оруулан засварлаад өгнө.	0	2026-05-22 09:30:41.716	t	Мал аж ахуй	2026-05-22 09:30:41.716
cmpgpyt5n004z7s2setp00r6x	Ямар формат дээр байна вэ?	Word (.docx) болон PDF форматтай. Word файлыг компьютер эсвэл Google Docs дээр засварлаж болно.	1	2026-05-22 09:30:41.819	t	Мал аж ахуй	2026-05-22 09:30:41.819
cmpgpyt5u00507s2spj8fg0oo	Нэг бус чиглэлийн төсөл хэрэгтэй бол?	Энэ багцад мал аж ахуйн бүх чиглэлийн 67 файл багтсан тул олон чиглэлийг нэг дор авна.	2	2026-05-22 09:30:41.826	t	Мал аж ахуй	2026-05-22 09:30:41.826
cmpgpyt6100517s2sgb387ogt	Хөдөөний нутагт зээл авхад тохиромжтой юу?	Тийм. Аймаг, сумын банк болон ХАА зээлийн стандартад нийцүүлэн бэлтгэгдсэн.	3	2026-05-22 09:30:41.833	t	Мал аж ахуй	2026-05-22 09:30:41.833
cmpgpyt6800527s2ske5ve9kd	Худалдан авсны дараа файлуудыг хэрхэн татах вэ?	Төлбөр баталгаажмагц татах холбоос ирнэ. Бүтээгдэхүүний хуудаснаасаа нэг дор татаж авна.	4	2026-05-22 09:30:41.841	t	Мал аж ахуй	2026-05-22 09:30:41.841
cmpgpyte9009h7s2s5y25sz82	Хүлэмж байгуулах зориулалттай зээлд тохирох уу?	Тийм. ХАА банк болон хөдөө аж ахуйн сангийн стандартад нийцүүлсэн. Хүлэмжийн аж ахуйн ихэнх зээлийн нөхцөлд тохирно.	0	2026-05-22 09:30:42.13	t	Хүлэмж тариалан	2026-05-22 09:30:42.13
cmpgpyteh009i7s2sqy6r7z1l	Мод үржүүлгийн загвар байна уу?	Тийм. МОД ҮРЖҮҮЛГИЙН ГАЗАР БАЙГУУЛАХ 3 өөр загвар болон ойжуулалтын төсөл орсон.	1	2026-05-22 09:30:42.137	t	Хүлэмж тариалан	2026-05-22 09:30:42.137
cmpgpyteo009j7s2sdqtj0d9v	Чацарганы тариалалт эхлэхэд ямар файлуудыг ашиглах вэ?	Чацарганы багцад зах зээлийн судалгаа, тариалалтын аргачлал, боловсруулалтын үйлдвэрийн төсөл зэрэг 9 файл орсон.	2	2026-05-22 09:30:42.145	t	Хүлэмж тариалан	2026-05-22 09:30:42.145
cmpgpytew009k7s2sb912tps0	Жижиг газарт хэрэгжүүлэх боломжтой загвар байна уу?	Тийм. 3 соёт жижиг хүлэмжийн загвараас 201 соёт том аж ахуй хүртэлх файлууд багтсан.	3	2026-05-22 09:30:42.153	t	Хүлэмж тариалан	2026-05-22 09:30:42.153
cmpgpytl600c97s2sb6jqhewf	Ресторан нээхэд банкны зээл авч болох уу?	Тийм. Файлуудыг банкны зээлийн шаардлагад тохируулсан. Санхүүгийн урсгал, орлогын тооцоо, зардлын хуваарь бэлэн байна.	0	2026-05-22 09:30:42.379	t	Ресторан хоол	2026-05-22 09:30:42.379
cmpgpytld00ca7s2s3g0ka7yl	Жижиг хоолны газраас том ресторан хүртэл ялгаатай загвар байна уу?	Тийм. 12 суудалтай жижиг кафенаас 42 хуудастай том ресторан хүртэлх өөр хэмжээний загварууд орсон.	1	2026-05-22 09:30:42.386	t	Ресторан хоол	2026-05-22 09:30:42.386
cmpgpytlk00cb7s2swh7xjnoa	Дарсны үйлдвэр байгуулах загвар байна уу?	Тийм. Дарс үйлдвэрлэх 46 хуудасны 2 өөр загвар болон шар айрагны 275 хуудасны файл орсон.	2	2026-05-22 09:30:42.392	t	Ресторан хоол	2026-05-22 09:30:42.392
cmpgpytlq00cc7s2sxxmiwbci	Цагаан хоолны зоогийн газрын загвар байна уу?	Тийм. Цагаан хоолны кафе болон зоогийн газар — 2 тусдаа загвар ресторан бүлэгт орсон.	3	2026-05-22 09:30:42.399	t	Ресторан хоол	2026-05-22 09:30:42.399
cmpgpyttf00g77s2st123j296	Блок тоосгоны үйлдвэр байгуулах загвар бий юу?	Тийм. Пено бетон, сибет блок, хөнгөн блок, полистиролбетон зэрэг 11 өөр загвар орсон.	0	2026-05-22 09:30:42.675	t	Барилга тавилга	2026-05-22 09:30:42.675
cmpgpyttm00g87s2sabnekim1	Авто засварын газар нээхэд ямар файл хэрэгтэй вэ?	АВТО УГААЛГА БОЛОН АВТО СЕРВИС, Авто засвар, Дугуй засварын төв гэх мэт 8 бэлэн файл орсон.	1	2026-05-22 09:30:42.682	t	Барилга тавилга	2026-05-22 09:30:42.682
cmpgpyttt00g97s2s7q4lt5qv	Орон сууцны барилгын загвар байна уу?	Тийм. 52 айлаас 620 айл хүртэлх орон сууцны төсөл болон хотхон байгуулах загвар ч орсон.	2	2026-05-22 09:30:42.69	t	Барилга тавилга	2026-05-22 09:30:42.69
cmpgpytu000ga7s2suht4z8t7	Тавилгын цехийн загвар хэдэн хуудастай байна вэ?	Тавилгын үйлдвэрийн ихэнх загвар 29–122 хуудасны хооронд байна. Санхүүгийн тооцоо, тоног төхөөрөмжийн жагсаалт бүрэн орсон.	3	2026-05-22 09:30:42.696	t	Барилга тавилга	2026-05-22 09:30:42.696
cmpgpytyr00ib7s2s8abbhng3	Оёдлын жижиг цехнээс эхлэх загвар байна уу?	Тийм. 5 хуудасны жижиг цехийн загвараас эхлэн 120 хуудасны томоохон цех хүртэлх файлууд орсон.	0	2026-05-22 09:30:42.868	t	Оёдол нэхмэл	2026-05-22 09:30:42.868
cmpgpytyx00ic7s2s33t9giqm	Монгол дээл хувцасны чиглэлийн загвар байна уу?	Тийм. Монгол дээл болон МОНГОЛ ГОЁЛ гэсэн 2 чиглэлийн загвар тусгайлан орсон.	1	2026-05-22 09:30:42.874	t	Оёдол нэхмэл	2026-05-22 09:30:42.874
cmpgpytz300id7s2sxcsci58b	Нэхмэл, оймсны үйлдвэрийн загвар хичнээн байна?	ОЙМСНЫ ҮЙЛДВЭР 67х, ПҮҮЗ ХИЙХ 14х, СҮЛЖМЭЛ ЭДЛЭЛ, Ээрмэлийн үйлдвэр зэрэг 12 файл нэхмэлийн чиглэлд орсон.	2	2026-05-22 09:30:42.88	t	Оёдол нэхмэл	2026-05-22 09:30:42.88
cmpgpyu6700m67s2scbvdcdfb	Хог боловсруулах чиглэлийн зээл авах боломжтой юу?	Тийм. ХОГ ХАЯГДАЛ ДАХИН БОЛОВСРУУЛАХ болон Хог боловсруулах гэсэн 3 өөр загвар орсон. Ногоон санхүүжилт авах боломжтой.	0	2026-05-22 09:30:43.135	t	Хүнс үйлдвэр	2026-05-22 09:30:43.135
cmpgpyu6d00m77s2sie6h8co4	Сүүн бүтээгдэхүүний файл Мал аж ахуйн багцтай давхардах уу?	Хүнс боловсруулалтын хүний загварт үйлдвэрлэлийн нарийн ширийн зүйл, тоног төхөөрөмж, борлуулалтын сувгийн мэдээлэл нэмэлтээр орсон.	1	2026-05-22 09:30:43.142	t	Хүнс үйлдвэр	2026-05-22 09:30:43.142
cmpgpyu6y00m87s2szyy1p3ab	Цэвэр усны үйлдвэрийн загвар байна уу?	Тийм. Цэвэр Усны Үйлдвэрийн Төсөл болон Хөвсгөлийн цэвэр ус төсөл — 2 файл орсон.	2	2026-05-22 09:30:43.162	t	Хүнс үйлдвэр	2026-05-22 09:30:43.162
cmpgpyudf00pj7s2skds1e5w8	Аялал жуулчлалын тусгай зөвшөөрөл авахад загвар тус болох уу?	Аялал жуулчлалын файлуудад бизнес төлөвлөгөө, санхүүгийн тооцоо бэлэн байна. Стандарт нөхцөлийг хангасан файлуудыг сонгон ашиглана.	0	2026-05-22 09:30:43.395	t	Үйлчилгээ аялал	2026-05-22 09:30:43.395
cmpgpyudm00pk7s2sj8o95ydy	Гоо сайхны салон нээхэд тохирох файл байна уу?	Арьс гоо засал, маникур, үсчин, нийтийн үйлчилгээний 5 өөр загвар орсон.	1	2026-05-22 09:30:43.402	t	Үйлчилгээ аялал	2026-05-22 09:30:43.402
cmpgpyuds00pl7s2ssrighwiz	Кино театр, спорт, тоглоомын газрын загвар байна уу?	Тийм. АВТОМАТ ТОГЛООМЫН ТӨВ, Хэмжээст кино театр, ӨРГӨӨ КИНО ТЕАТРЫН МАРКЕТИНГ гэх мэт загварууд "Сургалтын төв, бусад" бүлэгт орсон.	2	2026-05-22 09:30:43.409	t	Үйлчилгээ аялал	2026-05-22 09:30:43.409
cmpgpyum200ts7s2s3c7w6xtr	Дипломын ажил бичихэд эдгээр файлуудыг ашиглаж болох уу?	Тийм. Маркетингийн судалгаа, санхүүгийн шинжилгээ, IT чиглэлийн олон файл дипломын ажлын загвар болгон ашиглахад тохиромжтой.	0	2026-05-22 09:30:43.707	t	Маркетинг боловсрол	2026-05-22 09:30:43.707
cmpgpyum900tt7s2s132zbfkq	SWOT шинжилгээний загвар байна уу?	Тийм. Свот шинжилгээ гэсэн тусдаа загвар болон маркетингийн судалгааны файлуудад SWOT хэсэг орсон.	1	2026-05-22 09:30:43.713	t	Маркетинг боловсрол	2026-05-22 09:30:43.713
cmpgpyumg00tu7s2su051ccl1	IT болон програм хангамжийн чиглэлийн загвар байна уу?	Тийм. Компьютерийн үйлчилгээний төв, онлайн худалдааны систем, хадгаламж бүртгэлийн систем зэрэг 15 IT загвар орсон.	2	2026-05-22 09:30:43.72	t	Маркетинг боловсрол	2026-05-22 09:30:43.72
cmpgpyumm00tv7s2sidmbyv0t	Цэцэрлэг байгуулах зориулалттай загвар байна уу?	Тийм. ХҮҮХДИЙН ЦЭЦЭРЛЭГ БАЙГУУЛАХ ТӨСӨЛ 22x болон Сургалтын төв байгуулах бизнес төлөвлөгөө — 2 файл боловсролын бүлэгт орсон.	3	2026-05-22 09:30:43.727	t	Маркетинг боловсрол	2026-05-22 09:30:43.727
cmpgpyw1a01gg7s2smfrfmduf	PLATINUM-ийг авбал хэдэн файл нийт байх вэ?	Нийт 300 гаруй файл байна: 8 ангиллын бүх файл + 10 бонус файл. Нэг дор татаж авч ашиглана.	0	2026-05-22 09:30:45.551	t	PLATINUM	2026-05-22 09:30:45.551
cmpgpyw1i01gh7s2s4eridfv7	Тус тусад нь авбал хичнээн үнэтэй байх вэ?	Тус тусад нь авбал нийт 340,000-380,000 төгрөг болно. PLATINUM-ийн үнэ 149,900 — ойролцоогоор 2.5 дахин хямд.	1	2026-05-22 09:30:45.558	t	PLATINUM	2026-05-22 09:30:45.558
cmpgpyw1q01gi7s2sdnmf64l7	Бүх чиглэлийн файл хэрэггүй болбол яах вэ?	Хэрэгтэй чиглэлийнхээ файлуудыг татаж авна. Нэмэлт файлуудыг татах шаардлагагүй.	2	2026-05-22 09:30:45.567	t	PLATINUM	2026-05-22 09:30:45.567
cmpgpyw1z01gj7s2sf9pb7aft	Хоёр өөр чиглэлийн зээл нэгэн зэрэг авах гэж байвал?	PLATINUM хамгийн тохиромжтой. Жишээ нь мал аж ахуй болон хүлэмжийн зээлийг нэгэн зэрэг бэлтгэж банкинд өгч болно.	3	2026-05-22 09:30:45.575	t	PLATINUM	2026-05-22 09:30:45.575
cmpgpyw2501gk7s2sloevdyrc	Хэр олон удаа татаж авч болох вэ?	Хязгааргүй. Нэг удаа худалдан авсан файлуудаа хэдэн ч удаа татаж авч болно.	4	2026-05-22 09:30:45.582	t	PLATINUM	2026-05-22 09:30:45.582
cmpij24vm004f7s047n98fwah	Файлуудыг татаж авснаас хойш хэрхэн ашиглах вэ?	ZIP файлыг задалбал 8 хавтастай бүтэц гарна. Хэрэгтэй ангиллаасаа файлаа нээж, компанийн нэр, хаяг, огноог өөрчилнө. Excel файлуудад тоо оруулахад автоматаар тооцоолно. Word файлуудыг шууд хэвлэж ашиглаж болно.	1	2026-05-23 15:52:52.018	t	general	2026-05-23 15:52:52.018
cmpij24wh004g7s04vzebwb51	Гэрээний загварууд Монгол хуульд нийцдэг үү?	Тийм. Хөдөлмөрийн гэрээ нь Монгол Улсын Хөдөлмөрийн тухай хуулийн шаардлагад нийцсэн. Бусад гэрээнүүд ч Монгол Улсын иргэний хуулийн дагуу боловсруулсан. Гэсэн хэдий ч эрхзүйн үр дагаврыг баталгаажуулахын тулд нотариатаар баталгаажуулахыг зөвлөж байна.	2	2026-05-23 15:52:52.049	t	general	2026-05-23 15:52:52.049
cmpij24wr004h7s04xd6hsch7	Цалин тооцоолуур Excel нь ямар татвар, шимтгэлийг тооцдог вэ?	Цалин тооцоолуур нь НДШХ (Нийгмийн даатгалын шимтгэл) болон ХХОАТ (Хувь хүний орлогын албан татвар)-ыг автоматаар тооцно. Тоо оруулахад цалингийн хуваарилалт, суутгал, цэвэр цалин гарна.	3	2026-05-23 15:52:52.059	t	general	2026-05-23 15:52:52.059
cmpij24x2004i7s042axcb2ar	Нэг удаа худалдан авсны дараа дахин ашиглаж болох уу?	Тийм, хугацаагүй. Нэг удаа татаж авсны дараа өөрийн компанид хэдэн ажилтанд ч, хэдэн гэрээнд ч хэрэглэж болно. Файлуудаа хуулж авсан ч болно.	4	2026-05-23 15:52:52.07	t	general	2026-05-23 15:52:52.07
cmpij252f004j7s04wlinxtj5	CRM систем Excel ямар боломжтой вэ?	CRM.xlsx файл нь Dashboard (хураангуй), Organizations (байгууллагын бүртгэл), Contacts (харилцагчийн бүртгэл), Opportunities (борлуулалтын боломж), Interactions (харилцааны тэмдэглэл) гэсэн 5 sheet-тэй. Хялбар шүүлт, хайлтаар ажиллана.	5	2026-05-23 15:52:52.264	t	general	2026-05-23 15:52:52.264
cmpij2555004k7s04uo85fhxe	Файлуудыг өөрчлөх, нэмэлт хийж болох уу?	Тийм, бүх файл Word болон Excel форматтай тул хэрэгцээнийхээ дагуу өөрчилж, нэмэлт оруулж болно. Загвар нь зөвхөн эхлэл цэг бөгөөд байгууллагынхаа онцлогт тохируулна.	6	2026-05-23 15:52:52.361	t	general	2026-05-23 15:52:52.361
\.


--
-- Data for Name: Lesson; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Lesson" (id, "courseId", title, description, "videoKey", "durationSec", "sortOrder", "isFreePreview", "videoUrl", "moduleId") FROM stdin;
\.


--
-- Data for Name: MenuItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MenuItem" (id, label, url, "pageSlug", "sortOrder", active, target, "openInNew", "createdAt", "updatedAt") FROM stdin;
menu-1	Нүүр	/	\N	0	t	_self	f	2026-05-17 17:21:41.154	2026-05-22 10:42:29.703
cmpb8z00400067suwio31e80x	Нийтлэл	\N	blog	3	t	_self	f	2026-05-18 13:36:06.34	2026-05-22 10:42:29.703
cmpfpj2ln00007sykkqxdyf1t	Бидний тухай	\N	about	4	t	_self	f	2026-05-21 16:30:41.387	2026-05-22 10:42:29.703
menu-5	Загвар файл	/products/platinum-belen-tusluud-buguud	\N	2	t	_self	f	2026-05-22 09:30:31.947	2026-05-22 10:44:28.219
menu-2	Төслүүд	/products?type=TUSUL	\N	1	t	_self	f	2026-05-17 17:21:41.164	2026-05-22 10:49:14.777
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", title, body, read, "createdAt") FROM stdin;
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Order" (id, "userId", total, currency, status, "qpayIdentifier", "createdAt", "updatedAt", "couponCode") FROM stdin;
cmpax6fl100017so4yksl3ede	cmp9nt7j800007s5wr36po3s2	118900.00	MNT	PAID	dev-cmpax6fmu00067so41mhyrxry	2026-05-18 08:05:57.731	2026-05-18 08:05:57.814	\N
cmpb8wllz00017suwxvef4db4	cmpb6tahi00017sp4hxu4tvlz	29900.00	MNT	PAID	dev-cmpb8wlnh00057suw2poz7esk	2026-05-18 13:34:14.372	2026-05-18 13:34:14.438	\N
cmpcclv3f00027susmaa99xs3	cmpb6tahi00017sp4hxu4tvlz	133900.00	MNT	PAID	dev-cmpcclv4w00087susgrufg4p3	2026-05-19 08:05:38.09	2026-05-19 08:05:38.158	\N
cmpccn3la000a7susxyqjl4tk	cmpb6tahi00017sp4hxu4tvlz	118900.00	MNT	PAID	dev-cmpccn3m8000f7suseoubk8hy	2026-05-19 08:06:35.759	2026-05-19 08:06:35.799	\N
cmpceb01x000r7susm1y2a0x3	cmpbb9yl800007seco3fxoylb	118900.00	MNT	PAID	dev-cmpceb02w000w7sus0aj7bko6	2026-05-19 08:53:10.533	2026-05-19 08:53:10.574	\N
cmpce9xtf000k7sus2twlw7um	cmpb6tahi00017sp4hxu4tvlz	118900.00	MNT	REFUNDED	dev-cmpce9xue000p7sus5n954sta	2026-05-19 08:52:20.978	2026-05-19 10:20:33.013	\N
cmpcpjwwv00027sg03ysd098c	cmpb6tahi00017sp4hxu4tvlz	71340.00	MNT	PAID	dev-cmpcpjwy700077sg04qifqcdo	2026-05-19 14:08:02.142	2026-05-19 14:08:02.202	\N
cmpcq4eor00017s74l905dfc2	cmpb6tahi00017sp4hxu4tvlz	53400.00	MNT	PAID	dev-cmpcq4epv00057s74ueumqy7o	2026-05-19 14:23:58.299	2026-05-19 14:23:58.348	START10
cmpfrfpnc00017sbc7rvzrjau	cmpb6tahi00017sp4hxu4tvlz	189000.00	MNT	CANCELLED	DG-cmpfrfpnc00017sbc7rvzrjau	2026-05-21 17:24:03.861	2026-05-22 07:49:28.459	\N
cmpgmfpta00077sjof2dcpz49	cmpb6tahi00017sp4hxu4tvlz	189000.00	MNT	CANCELLED	DG-cmpgmfpta00077sjof2dcpz49	2026-05-22 07:51:52.174	2026-05-22 17:26:25.371	\N
cmpgme9wc00017sjov1uwcuhj	cmpb6tahi00017sp4hxu4tvlz	189000.00	MNT	CANCELLED	DG-cmpgme9wc00017sjov1uwcuhj	2026-05-22 07:50:44.89	2026-05-22 17:26:26.417	\N
cmph6z4rk00017sss6lapcwxk	cmpb6tahi00017sp4hxu4tvlz	1000.00	MNT	PAID	0a5a7ad2-051b-430c-b977-8e830b3dcc97	2026-05-22 17:26:50.333	2026-05-22 17:29:46.199	\N
cmphbohwj00017sowfje1br7x	cmpb6tahi00017sp4hxu4tvlz	49900.00	MNT	PENDING	DG-cmphbohwj00017sowfje1br7x	2026-05-22 19:38:32.227	2026-05-22 19:38:33.011	\N
\.


--
-- Data for Name: OrderItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OrderItem" (id, "orderId", "productId", price) FROM stdin;
cmph6z4rk00037ssst5wm3uon	cmph6z4rk00017sss6lapcwxk	cmpgpyumu00tx7s2swj1osyxy	1000.00
cmphbohwj00037sowmqk51jpf	cmphbohwj00017sowfje1br7x	cmpgpytzb00if7s2ske45g8st	49900.00
\.


--
-- Data for Name: Page; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Page" (id, slug, title, content, "updatedAt") FROM stdin;
cmpc9egmk00007scs0gqif50w	privacy-policy	Нууцлалын бодлого	<h2>1. Мэдээлэл цуглуулах</h2><p>DigitalGer нь үйлчилгээгээ үзүүлэхийн тулд дараах мэдээллийг цуглуулна: нэр, и-мэйл хаяг, утасны дугаар, төлбөрийн мэдээлэл.</p><h2>2. Мэдээлэл ашиглах</h2><p>Цуглуулсан мэдээллийг дараах зорилгоор ашиглана: захиалга биелүүлэх, хэрэглэгчтэй холбоо барих, үйлчилгээ сайжруулах, хуулийн шаардлага биелүүлэх.</p><h2>3. Мэдээлэл хамгаалах</h2><p>Бид таны хувийн мэдээллийг хамгаалахын тулд стандарт шифрлэлт болон аюулгүй байдлын арга хэмжээ авч ажиллана. Гуравдагч талд таны мэдээллийг борлуулахгүй.</p><h2>4. Күүки ашиглах</h2><p>Вэб сайт дээр хэрэглэгчийн туршлагыг сайжруулахын тулд күүки технологи ашигладаг. Та хөтөчийнхөө тохиргооноос күүкийг хаах боломжтой.</p><h2>5. Гуравдагч талын холбоосууд</h2><p>Манай вэб сайт гуравдагч талын вэб сайтруу чиглүүлэх холбоосыг агуулж болно. Тэдгээр вэб сайтуудын нууцлалын бодлогод хариуцлага хүлээхгүй.</p><h2>6. Холбоо барих</h2><p>Нууцлалын бодлоготой холбоотой асуулт байвал <a target="_blank" rel="noopener noreferrer nofollow" href="mailto:info@digitalger.mn">info@digitalger.mn</a> хаягаар холбоо барина уу.</p>	2026-05-19 08:38:33.99
cmpccalv800007suse24rcuvf	terms-of-use	Үйлчилгээний нөхцөл	<h2>1. Ерөнхий нөхцөл</h2>\n<p>DigitalGer платформыг ашигласнаар та эдгээр үйлчилгээний нөхцөлийг хүлээн зөвшөөрч байна. Нөхцөлийг хүлээн зөвшөөрөхгүй бол платформыг ашиглахгүй байхыг хүсье.</p>\n\n<h2>2. Бүртгэл ба аюулгүй байдал</h2>\n<p>Та бүртгэлийн мэдээллээ нууцлан хадгалах үүрэгтэй. Бүртгэлийнхээ аюулгүй байдлыг хангах хариуцлагыг та бүрэн хүлээнэ. Зөвшөөрөлгүй ашиглалт илэрвэл нэн даруй мэдэгдэнэ үү.</p>\n\n<h2>3. Оюуны өмч</h2>\n<p>DigitalGer дээр байрлуулсан бүх контент (зураг, текст, видео, файл) нь оюуны өмчийн хуулиар хамгаалагдсан бөгөөд худалдаж авсан бүтээгдэхүүнийг зөвхөн хувийн хэрэгцээнд ашиглана.</p>\n\n<h2>4. Буцаалт ба төлбөр</h2>\n<p>Дижитал бүтээгдэхүүн нь худалдан авсны дараа буцаалт хийх боломжгүй. Техникийн асуудал үүссэн тохиолдолд 72 цагийн дотор холбоо барьж шийдвэрлүүлэх боломжтой.</p>\n\n<h2>5. Хориглох зүйлс</h2>\n<p>Платформ дээр худалдан авсан бүтээгдэхүүнийг дахин зарах, хуваалцах, нийтийн сүлжээнд байршуулах хатуу хориглоно. Зөрчил илэрвэл бүртгэлийг цуцлах эрхтэй.</p>\n\n<h2>6. Нөхцөл өөрчлөх</h2>\n<p>DigitalGer нь үйлчилгээний нөхцөлийг урьдчилан мэдэгдэлгүйгээр өөрчлөх эрхтэй. Өөрчлөлтийн дараа платформыг үргэлжлүүлэн ашигласан нь шинэ нөхцөлийг хүлээн зөвшөөрсөн гэж үзнэ.</p>	2026-05-19 08:38:36.085
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Payment" (id, "orderId", amount, status, "qpayPaymentId", "rawPayload", "createdAt") FROM stdin;
cmpax6fmu00067so41mhyrxry	cmpax6fl100017so4yksl3ede	118900.00	SUCCESS	dev-cmpax6fmu00067so41mhyrxry	\N	2026-05-18 08:05:57.798
cmpb8wlnh00057suw2poz7esk	cmpb8wllz00017suwxvef4db4	29900.00	SUCCESS	dev-cmpb8wlnh00057suw2poz7esk	\N	2026-05-18 13:34:14.429
cmpcclv4w00087susgrufg4p3	cmpcclv3f00027susmaa99xs3	133900.00	SUCCESS	dev-cmpcclv4w00087susgrufg4p3	\N	2026-05-19 08:05:38.144
cmpccn3m8000f7suseoubk8hy	cmpccn3la000a7susxyqjl4tk	118900.00	SUCCESS	dev-cmpccn3m8000f7suseoubk8hy	\N	2026-05-19 08:06:35.793
cmpce9xue000p7sus5n954sta	cmpce9xtf000k7sus2twlw7um	118900.00	SUCCESS	dev-cmpce9xue000p7sus5n954sta	\N	2026-05-19 08:52:21.015
cmpceb02w000w7sus0aj7bko6	cmpceb01x000r7susm1y2a0x3	118900.00	SUCCESS	dev-cmpceb02w000w7sus0aj7bko6	\N	2026-05-19 08:53:10.568
cmpcpjwy700077sg04qifqcdo	cmpcpjwwv00027sg03ysd098c	71340.00	SUCCESS	dev-cmpcpjwy700077sg04qifqcdo	\N	2026-05-19 14:08:02.191
cmpcq4epv00057s74ueumqy7o	cmpcq4eor00017s74l905dfc2	53400.00	SUCCESS	dev-cmpcq4epv00057s74ueumqy7o	\N	2026-05-19 14:23:58.34
cmpfrfpsz00057sbclope0vp2	cmpfrfpnc00017sbc7rvzrjau	189000.00	PENDING	9b6f525c-1714-40b2-a5dc-4102ebeabf44	{"urls": [{"link": "qpaywallet://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://s3.qpay.mn/p/e9bbdc69-3544-4c2f-aff0-4c292bc094f6/launcher-icon-ios.jpg", "name": "qPay wallet", "description": "qPay хэтэвч"}, {"link": "khanbank://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/khanbank.png", "name": "Khan bank", "description": "Хаан банк"}, {"link": "statebankmongolia://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/state_3.png", "name": "State bank 3.0", "description": "Төрийн банк 3.0"}, {"link": "xacbank://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/xacbank.png", "name": "Xac bank", "description": "Хас банк"}, {"link": "tdbbank://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/tdbbank.png", "name": "Trade and Development bank", "description": "TDB online"}, {"link": "socialpay-payment://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/socialpay.png", "name": "Social Pay", "description": "Голомт банк"}, {"link": "most://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/most.png", "name": "Most money", "description": "МОСТ мони"}, {"link": "nibank://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/nibank.jpeg", "name": "National investment bank", "description": "Үндэсний хөрөнгө оруулалтын банк"}, {"link": "ckbank://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/ckbank.png", "name": "Chinggis khaan bank", "description": "Чингис Хаан банк"}, {"link": "capitronbank://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/capitronbank.png", "name": "Capitron bank", "description": "Капитрон банк"}, {"link": "bogdbank://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/bogdbank.png", "name": "Bogd bank", "description": "Богд банк"}, {"link": "transbank://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/transbank.png", "name": "Trans bank", "description": "Тээвэр хөгжлийн банк"}, {"link": "mbank://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/mbank.png", "name": "M bank", "description": "М банк"}, {"link": "ard://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/ardlogo.png", "name": "Ard App", "description": "Ард Апп"}, {"link": "toki://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/tokipay.png", "name": "Toki App", "description": "Toki App"}, {"link": "arig://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/arig.png", "name": "Arig bank", "description": "Ариг банк"}, {"link": "monpay://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/monpay.png", "name": "Monpay", "description": "Мон Пэй"}, {"link": "hipay://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/hipay.png", "name": "Hipay", "description": "Hipay"}, {"link": "tdbwallet://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/tdbwallet.png", "name": "Happy Pay", "description": "Happy Pay MN"}, {"link": "sono://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/sono.png", "name": "Sono", "description": "Sono"}, {"link": "payon://q?qPay_QRcode=0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "logo": "https://qpay.mn/q/logo/payon.png", "name": "PayOn", "description": "PayOn"}], "qr_text": "0002010102121531279404962794049600260512675969027540014A00000084300010108AGMOMNUB0220j-r4NFbORLc8PgBfXgQZ52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720j-r4NFbORLc8PgBfXgQZ7106QPP_QR781579676649421006079022280020163046D73", "qr_image": "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", "invoice_id": "9b6f525c-1714-40b2-a5dc-4102ebeabf44", "qPay_shortUrl": "https://s.qpay.mn/0CPBi-0xNZ"}	2026-05-21 17:24:04.067
cmpfrh21700077sbcacm332w1	cmpfrfpnc00017sbc7rvzrjau	189000.00	PENDING	b66945a2-f4a7-4c5e-b292-77c5c8c56743	{"urls": [{"link": "qpaywallet://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://s3.qpay.mn/p/e9bbdc69-3544-4c2f-aff0-4c292bc094f6/launcher-icon-ios.jpg", "name": "qPay wallet", "description": "qPay хэтэвч"}, {"link": "khanbank://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/khanbank.png", "name": "Khan bank", "description": "Хаан банк"}, {"link": "statebankmongolia://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/state_3.png", "name": "State bank 3.0", "description": "Төрийн банк 3.0"}, {"link": "xacbank://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/xacbank.png", "name": "Xac bank", "description": "Хас банк"}, {"link": "tdbbank://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/tdbbank.png", "name": "Trade and Development bank", "description": "TDB online"}, {"link": "socialpay-payment://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/socialpay.png", "name": "Social Pay", "description": "Голомт банк"}, {"link": "most://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/most.png", "name": "Most money", "description": "МОСТ мони"}, {"link": "nibank://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/nibank.jpeg", "name": "National investment bank", "description": "Үндэсний хөрөнгө оруулалтын банк"}, {"link": "ckbank://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/ckbank.png", "name": "Chinggis khaan bank", "description": "Чингис Хаан банк"}, {"link": "capitronbank://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/capitronbank.png", "name": "Capitron bank", "description": "Капитрон банк"}, {"link": "bogdbank://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/bogdbank.png", "name": "Bogd bank", "description": "Богд банк"}, {"link": "transbank://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/transbank.png", "name": "Trans bank", "description": "Тээвэр хөгжлийн банк"}, {"link": "mbank://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/mbank.png", "name": "M bank", "description": "М банк"}, {"link": "ard://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/ardlogo.png", "name": "Ard App", "description": "Ард Апп"}, {"link": "toki://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/tokipay.png", "name": "Toki App", "description": "Toki App"}, {"link": "arig://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/arig.png", "name": "Arig bank", "description": "Ариг банк"}, {"link": "monpay://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/monpay.png", "name": "Monpay", "description": "Мон Пэй"}, {"link": "hipay://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/hipay.png", "name": "Hipay", "description": "Hipay"}, {"link": "tdbwallet://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/tdbwallet.png", "name": "Happy Pay", "description": "Happy Pay MN"}, {"link": "sono://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/sono.png", "name": "Sono", "description": "Sono"}, {"link": "payon://q?qPay_QRcode=0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "logo": "https://qpay.mn/q/logo/payon.png", "name": "PayOn", "description": "PayOn"}], "qr_text": "0002010102121531279404962794049600260512676000327540014A00000084300010108AGMOMNUB0220XUo_taGqkW3Ok_li5Tk552048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720XUo_taGqkW3Ok_li5Tk57106QPP_QR781520073082642486679022280020163040653", "qr_image": "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", "invoice_id": "b66945a2-f4a7-4c5e-b292-77c5c8c56743", "qPay_shortUrl": "https://s.qpay.mn/FTR9RaT3bo"}	2026-05-21 17:25:06.571
cmpgme9z000057sjol0n3klyx	cmpgme9wc00017sjov1uwcuhj	189000.00	PENDING	04faa0bd-c4fe-4448-a7ea-dfc955c101b5	{"urls": [{"link": "qpaywallet://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://s3.qpay.mn/p/e9bbdc69-3544-4c2f-aff0-4c292bc094f6/launcher-icon-ios.jpg", "name": "qPay wallet", "description": "qPay хэтэвч"}, {"link": "khanbank://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/khanbank.png", "name": "Khan bank", "description": "Хаан банк"}, {"link": "statebankmongolia://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/state_3.png", "name": "State bank 3.0", "description": "Төрийн банк 3.0"}, {"link": "xacbank://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/xacbank.png", "name": "Xac bank", "description": "Хас банк"}, {"link": "tdbbank://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/tdbbank.png", "name": "Trade and Development bank", "description": "TDB online"}, {"link": "socialpay-payment://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/socialpay.png", "name": "Social Pay", "description": "Голомт банк"}, {"link": "most://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/most.png", "name": "Most money", "description": "МОСТ мони"}, {"link": "nibank://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/nibank.jpeg", "name": "National investment bank", "description": "Үндэсний хөрөнгө оруулалтын банк"}, {"link": "ckbank://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/ckbank.png", "name": "Chinggis khaan bank", "description": "Чингис Хаан банк"}, {"link": "capitronbank://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/capitronbank.png", "name": "Capitron bank", "description": "Капитрон банк"}, {"link": "bogdbank://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/bogdbank.png", "name": "Bogd bank", "description": "Богд банк"}, {"link": "transbank://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/transbank.png", "name": "Trans bank", "description": "Тээвэр хөгжлийн банк"}, {"link": "mbank://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/mbank.png", "name": "M bank", "description": "М банк"}, {"link": "ard://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/ardlogo.png", "name": "Ard App", "description": "Ард Апп"}, {"link": "toki://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/tokipay.png", "name": "Toki App", "description": "Toki App"}, {"link": "arig://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/arig.png", "name": "Arig bank", "description": "Ариг банк"}, {"link": "monpay://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/monpay.png", "name": "Monpay", "description": "Мон Пэй"}, {"link": "hipay://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/hipay.png", "name": "Hipay", "description": "Hipay"}, {"link": "tdbwallet://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/tdbwallet.png", "name": "Happy Pay", "description": "Happy Pay MN"}, {"link": "sono://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/sono.png", "name": "Sono", "description": "Sono"}, {"link": "payon://q?qPay_QRcode=0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "logo": "https://qpay.mn/q/logo/payon.png", "name": "PayOn", "description": "PayOn"}], "qr_text": "0002010102121531279404962794049600260512754097727540014A00000084300010108AGMOMNUB0220VD_ieU-CXEbiJYuG9wFW52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720VD_ieU-CXEbiJYuG9wFW7106QPP_QR781556583083740002779022280020163044167", "qr_image": "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", "invoice_id": "04faa0bd-c4fe-4448-a7ea-dfc955c101b5", "qPay_shortUrl": "https://s.qpay.mn/aR_9H5QnW1"}	2026-05-22 07:50:44.988
cmpgmfqru000b7sjoiume2kb6	cmpgmfpta00077sjof2dcpz49	189000.00	PENDING	0c087076-d54b-475f-ad7e-4fcbf7139189	{"urls": [{"link": "qpaywallet://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://s3.qpay.mn/p/e9bbdc69-3544-4c2f-aff0-4c292bc094f6/launcher-icon-ios.jpg", "name": "qPay wallet", "description": "qPay хэтэвч"}, {"link": "khanbank://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/khanbank.png", "name": "Khan bank", "description": "Хаан банк"}, {"link": "statebankmongolia://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/state_3.png", "name": "State bank 3.0", "description": "Төрийн банк 3.0"}, {"link": "xacbank://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/xacbank.png", "name": "Xac bank", "description": "Хас банк"}, {"link": "tdbbank://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/tdbbank.png", "name": "Trade and Development bank", "description": "TDB online"}, {"link": "socialpay-payment://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/socialpay.png", "name": "Social Pay", "description": "Голомт банк"}, {"link": "most://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/most.png", "name": "Most money", "description": "МОСТ мони"}, {"link": "nibank://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/nibank.jpeg", "name": "National investment bank", "description": "Үндэсний хөрөнгө оруулалтын банк"}, {"link": "ckbank://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/ckbank.png", "name": "Chinggis khaan bank", "description": "Чингис Хаан банк"}, {"link": "capitronbank://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/capitronbank.png", "name": "Capitron bank", "description": "Капитрон банк"}, {"link": "bogdbank://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/bogdbank.png", "name": "Bogd bank", "description": "Богд банк"}, {"link": "transbank://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/transbank.png", "name": "Trans bank", "description": "Тээвэр хөгжлийн банк"}, {"link": "mbank://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/mbank.png", "name": "M bank", "description": "М банк"}, {"link": "ard://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/ardlogo.png", "name": "Ard App", "description": "Ард Апп"}, {"link": "toki://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/tokipay.png", "name": "Toki App", "description": "Toki App"}, {"link": "arig://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/arig.png", "name": "Arig bank", "description": "Ариг банк"}, {"link": "monpay://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/monpay.png", "name": "Monpay", "description": "Мон Пэй"}, {"link": "hipay://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/hipay.png", "name": "Hipay", "description": "Hipay"}, {"link": "tdbwallet://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/tdbwallet.png", "name": "Happy Pay", "description": "Happy Pay MN"}, {"link": "sono://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/sono.png", "name": "Sono", "description": "Sono"}, {"link": "payon://q?qPay_QRcode=0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "logo": "https://qpay.mn/q/logo/payon.png", "name": "PayOn", "description": "PayOn"}], "qr_text": "0002010102121531279404962794049600260512754276127540014A00000084300010108AGMOMNUB0220MfzyA4HcmvJ4u9xW3OKN52048211530349654061890005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720MfzyA4HcmvJ4u9xW3OKN7106QPP_QR78153713594844476057902228002016304E3A1", "qr_image": "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", "invoice_id": "0c087076-d54b-475f-ad7e-4fcbf7139189", "qPay_shortUrl": "https://s.qpay.mn/jub5tVAvls"}	2026-05-22 07:51:53.418
cmph6z4us00057sss8sxmto46	cmph6z4rk00017sss6lapcwxk	1000.00	SUCCESS	0a5a7ad2-051b-430c-b977-8e830b3dcc97	{"urls": [{"link": "qpaywallet://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://s3.qpay.mn/p/e9bbdc69-3544-4c2f-aff0-4c292bc094f6/launcher-icon-ios.jpg", "name": "qPay wallet", "description": "qPay хэтэвч"}, {"link": "khanbank://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/khanbank.png", "name": "Khan bank", "description": "Хаан банк"}, {"link": "statebankmongolia://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/state_3.png", "name": "State bank 3.0", "description": "Төрийн банк 3.0"}, {"link": "xacbank://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/xacbank.png", "name": "Xac bank", "description": "Хас банк"}, {"link": "tdbbank://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/tdbbank.png", "name": "Trade and Development bank", "description": "TDB online"}, {"link": "socialpay-payment://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/socialpay.png", "name": "Social Pay", "description": "Голомт банк"}, {"link": "most://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/most.png", "name": "Most money", "description": "МОСТ мони"}, {"link": "nibank://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/nibank.jpeg", "name": "National investment bank", "description": "Үндэсний хөрөнгө оруулалтын банк"}, {"link": "ckbank://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/ckbank.png", "name": "Chinggis khaan bank", "description": "Чингис Хаан банк"}, {"link": "capitronbank://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/capitronbank.png", "name": "Capitron bank", "description": "Капитрон банк"}, {"link": "bogdbank://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/bogdbank.png", "name": "Bogd bank", "description": "Богд банк"}, {"link": "transbank://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/transbank.png", "name": "Trans bank", "description": "Тээвэр хөгжлийн банк"}, {"link": "mbank://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/mbank.png", "name": "M bank", "description": "М банк"}, {"link": "ard://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/ardlogo.png", "name": "Ard App", "description": "Ард Апп"}, {"link": "toki://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/tokipay.png", "name": "Toki App", "description": "Toki App"}, {"link": "arig://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/arig.png", "name": "Arig bank", "description": "Ариг банк"}, {"link": "monpay://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/monpay.png", "name": "Monpay", "description": "Мон Пэй"}, {"link": "hipay://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/hipay.png", "name": "Hipay", "description": "Hipay"}, {"link": "tdbwallet://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/tdbwallet.png", "name": "Happy Pay", "description": "Happy Pay MN"}, {"link": "sono://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/sono.png", "name": "Sono", "description": "Sono"}, {"link": "payon://q?qPay_QRcode=0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "logo": "https://qpay.mn/q/logo/payon.png", "name": "PayOn", "description": "PayOn"}], "qr_text": "0002010102121531279404962794049600260512823678227540014A00000084300010108AGMOMNUB0220CNf6wbOLQbgncSIZ_uan520482115303496540410005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720CNf6wbOLQbgncSIZ_uan7106QPP_QR78156551843462038667902228002016304CCD2", "qr_image": "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", "invoice_id": "0a5a7ad2-051b-430c-b977-8e830b3dcc97", "qPay_shortUrl": "https://s.qpay.mn/CbXHcrxxg"}	2026-05-22 17:26:50.452
cmphboi4q00057sowuiv3lir9	cmphbohwj00017sowfje1br7x	49900.00	PENDING	d5394400-ab9c-49c4-ae2e-e5b7954ad1b9	{"urls": [{"link": "qpaywallet://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://s3.qpay.mn/p/e9bbdc69-3544-4c2f-aff0-4c292bc094f6/launcher-icon-ios.jpg", "name": "qPay wallet", "description": "qPay хэтэвч"}, {"link": "khanbank://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/khanbank.png", "name": "Khan bank", "description": "Хаан банк"}, {"link": "statebankmongolia://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/state_3.png", "name": "State bank 3.0", "description": "Төрийн банк 3.0"}, {"link": "xacbank://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/xacbank.png", "name": "Xac bank", "description": "Хас банк"}, {"link": "tdbbank://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/tdbbank.png", "name": "Trade and Development bank", "description": "TDB online"}, {"link": "socialpay-payment://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/socialpay.png", "name": "Social Pay", "description": "Голомт банк"}, {"link": "most://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/most.png", "name": "Most money", "description": "МОСТ мони"}, {"link": "nibank://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/nibank.jpeg", "name": "National investment bank", "description": "Үндэсний хөрөнгө оруулалтын банк"}, {"link": "ckbank://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/ckbank.png", "name": "Chinggis khaan bank", "description": "Чингис Хаан банк"}, {"link": "capitronbank://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/capitronbank.png", "name": "Capitron bank", "description": "Капитрон банк"}, {"link": "bogdbank://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/bogdbank.png", "name": "Bogd bank", "description": "Богд банк"}, {"link": "transbank://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/transbank.png", "name": "Trans bank", "description": "Тээвэр хөгжлийн банк"}, {"link": "mbank://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/mbank.png", "name": "M bank", "description": "М банк"}, {"link": "ard://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/ardlogo.png", "name": "Ard App", "description": "Ард Апп"}, {"link": "toki://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/tokipay.png", "name": "Toki App", "description": "Toki App"}, {"link": "arig://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/arig.png", "name": "Arig bank", "description": "Ариг банк"}, {"link": "monpay://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/monpay.png", "name": "Monpay", "description": "Мон Пэй"}, {"link": "hipay://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/hipay.png", "name": "Hipay", "description": "Hipay"}, {"link": "tdbwallet://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/tdbwallet.png", "name": "Happy Pay", "description": "Happy Pay MN"}, {"link": "sono://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/sono.png", "name": "Sono", "description": "Sono"}, {"link": "payon://q?qPay_QRcode=0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "logo": "https://qpay.mn/q/logo/payon.png", "name": "PayOn", "description": "PayOn"}], "qr_text": "0002010102121531279404962794049600260512827130927540014A00000084300010108AGMOMNUB0220HGmSh-OU6ubdVlPqHSz75204821153034965405499005802MN5923GONGORBAYaRAMGALANBAYaR6011ULAANBAATAR62240720HGmSh-OU6ubdVlPqHSz77106QPP_QR78155380923710280917902228002016304F5F4", "qr_image": "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", "invoice_id": "d5394400-ab9c-49c4-ae2e-e5b7954ad1b9", "qPay_shortUrl": "https://s.qpay.mn/KrCnLOE61"}	2026-05-22 19:38:32.522
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Product" (id, title, slug, description, price, type, "categoryId", published, featured, rating, "ratingCount", "downloadCount", "previewUrl", "seoTitle", "seoDescription", "createdAt", "updatedAt", "discountEndsAt", "howToUse", "whatsIncluded", "compareAtPrice", "howToUseSteps", "videoUrl", "proofAuthorName", "proofAuthorRole", "proofImageUrl", "proofQuote", "proofText", "categoryIds", "downloadFileKey") FROM stdin;
cmpgpytf9009m7s2seiktzgih	Ресторан кафе хоолны 31 бэлэн төсөл	restoran-hool-belen-tusluud	Зоогийн газар, кафе, кофе шоп, талх нарийн боовны үйлдвэр, дарсны үйлдвэр зэрэг хоол үйлдвэрлэл, хоолны газрын бэлэн бизнес төсөл. Банк болон хувийн хөрөнгө оруулалт татахад зориулсан.	39900.00	TUSUL	cmpgpysp700027s2s6093zhyg	t	f	5	767	0	\N	Ресторан кафе бизнесийн бэлэн төсөл — 31 файл | DigitalGer	Ресторан, кафе, кофе шоп, талх боов, дарсны 31 бэлэн бизнес төсөл. Банкинд шуудхан өгч болно.	2026-05-22 09:30:42.166	2026-05-23 09:00:45.457	2026-07-05 17:30:00	Нээх гэж буй бизнесийнхээ чиглэлийг сонгоод тохирох загварыг нээнэ. Байршил, суудлын тоо, цэсний үнийн мэдээллийг оруулан засварлаж банкинд өгнө.	31 бэлэн файл: ресторан, зоогийн газрын 11 төсөл, кафе кофены 2 загвар, дарс айрагны 4 төсөл, цайны 2 загвар, талх нарийн боовны 12 файл. Нэмэлтээр: 10 бонус файл.	320000.00	[{"title": "Татаж авах", "description": "Худалдан авсны дараа бүтээгдэхүүний хуудаснаас бүх файлыг нэг дор татаж авна."}, {"title": "Файл нээх", "description": "Word (.docx) болон PDF файлуудыг компьютер дээрх Word, Acrobat эсвэл онлайн Google Docs-оор нээнэ."}, {"title": "Тохируулах", "description": "Компанийн нэр, огноо, тоо хэмжээгээ оруулан загварыг өөрийн онцлогт тохируулна."}, {"title": "Ашиглах", "description": "Банк, ЖДҮ сан, хөрөнгө оруулагчдад шуудхан өгнө. Мэргэжилтнийг ажиллуулах шаардлагагүй."}]	\N	\N	\N	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/9b336c99-1b2e-4910-b519-ebbcabc9f6d9.jpg	Кофе шоп нээхээр зэхэж байсан. Банкны загварчлалын хэсэг хамгийн хэцүү байсан — DigitalGer-ийн кафены бизнес төлөвлөгөөг авсан чинь хэдэн цагийн дотор бэлтгэж дуусгасан.	\N	{cmpgpysp700027s2s6093zhyg}	\N
cmpgpyudz00pn7s2sscoogfdt	Маркетинг боловсрол Технологийн 58 бэлэн загвар	marketing-belen-tusluud	Маркетингийн төлөвлөгөө, санхүүгийн шинжилгээ, төслийн менежмент, боловсролын байгууллага, IT технологийн чиглэлийн бэлэн загвар, судалгааны эмхэтгэл.	39900.00	TUSUL	cmpgpysq900077s2shwn148fo	t	f	4.9	341	0	\N	Маркетинг боловсрол технологийн бэлэн загвар — 58 файл | DigitalGer	Маркетингийн төлөвлөгөө, санхүүгийн шинжилгээ, IT, боловсролын 58 бэлэн загвар.	2026-05-22 09:30:43.415	2026-05-23 09:04:36.62	2026-07-05 09:30:00	Маркетингийн судалгаа, санхүүгийн шинжилгээ эсвэл IT төслийн аль чиглэлд загвар хэрэгтэй болохоо шийдэн тохирох файлыг нээнэ.	58 бэлэн файл: маркетингийн 18 загвар, санхүүгийн шинжилгээний 10 файл, төслийн менежментийн 7 загвар, боловсролын 8 файл, IT технологийн 15 файл. Нэмэлтээр: 10 бонус файл.	390000.00	[{"title": "Татаж авах", "description": "Худалдан авсны дараа бүтээгдэхүүний хуудаснаас бүх файлыг нэг дор татаж авна."}, {"title": "Файл нээх", "description": "Word (.docx) болон PDF файлуудыг компьютер дээрх Word, Acrobat эсвэл онлайн Google Docs-оор нээнэ."}, {"title": "Тохируулах", "description": "Компанийн нэр, огноо, тоо хэмжээгээ оруулан загварыг өөрийн онцлогт тохируулна."}, {"title": "Ашиглах", "description": "Банк, ЖДҮ сан, хөрөнгө оруулагчдад шуудхан өгнө. Мэргэжилтнийг ажиллуулах шаардлагагүй."}]	\N	\N	\N	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/5d86b7b0-cbbd-44c5-bcde-ba3037271176.jpg	Маркетингийн судалгааны тайлан бичиж байгаад загвар хаанаас авах нь тодорхойгүй байсан. DigitalGer-ийн маркетингийн багцаас Свот шинжилгээ, зах зээлийн судалгааны загвар авсан чинь тайланг хурдан дуусгасан.	\N	{cmpgpysq900077s2shwn148fo}	\N
cmpgpytzb00if7s2ske45g8st	Хүнс боловсруулах үйлдвэрийн 52 бэлэн төсөл	huns-uildver-belen-tusluud	Гурилын үйлдвэр, сүүн бүтээгдэхүүн, масло тос, хог боловсруулалт, цаасан уут, цэвэр ус зэрэг хүнс болон хөнгөн үйлдвэрлэлийн бизнес төсөл. Банкны зээл, хөрөнгө оруулалт татахад зориулсан.	49900.00	TUSUL	cmpgpyspw00057s2sv6qujibx	t	t	5	377	0	\N	Хүнс боловсруулах үйлдвэрийн бэлэн төсөл — 52 файл | DigitalGer	Хүнс боловсруулалт, гурил, сүү, масло, хог дахин боловсруулалтын 52 бэлэн бизнес төсөл.	2026-05-22 09:30:42.887	2026-05-23 08:57:38.561	2026-07-04 17:30:00	Хүнс болон хөнгөн үйлдвэрлэлийн чиглэлдээ тохирох загварыг сонгон нээнэ. Хүчин чадал, тоног төхөөрөмжийн мэдээллийг оруулан засварлаж банкинд өгнө.	52 бэлэн файл: гурилын 3 төсөл, сүүн бүтээгдэхүүний 19 файл, масло тосны 4 загвар, бусад хүнс болон хөнгөн үйлдвэрийн 26 файл. Нэмэлтээр: 10 бонус файл.	365000.00	[{"title": "Татаж авах", "description": "Худалдан авсны дараа бүтээгдэхүүний хуудаснаас бүх файлыг нэг дор татаж авна."}, {"title": "Файл нээх", "description": "Word (.docx) болон PDF файлуудыг компьютер дээрх Word, Acrobat эсвэл онлайн Google Docs-оор нээнэ."}, {"title": "Тохируулах", "description": "Компанийн нэр, огноо, тоо хэмжээгээ оруулан загварыг өөрийн онцлогт тохируулна."}, {"title": "Ашиглах", "description": "Банк, ЖДҮ сан, хөрөнгө оруулагчдад шуудхан өгнө. Мэргэжилтнийг ажиллуулах шаардлагагүй."}]	\N	\N	\N	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/6b18e8e2-057e-450c-b56f-96c4691e5fc7.jpg	Цаасан уутны жижиг үйлдвэр байгуулахаар зэхэж байхад DigitalGer-ийн файлыг авлаа. Цаасан уутны 3 өөр загварыг харьцуулан хамгийн тохирохыг сонгосноор санхүүгийн тооцоог хамаагүй хялбарчилсан.	\N	{cmpgpyspw00057s2sv6qujibx}	\N
cmpgpytlx00ce7s2s7196iudd	Барилга тавилга авто техник материалын 52 бэлэн төсөл	barilga-tavlga-auto-belen-tusluud	Барилга, орон сууц, блок тоосго, тавилга, модон эдлэл, авто засвар, хашаа дээврийн чиглэлийн бэлэн бизнес төсөл. Хөрөнгө оруулалт татах, банкны зээл авах, үйлдвэрлэл эхлэхэд зориулсан.	49900.00	TUSUL	cmpgpyspf00037s2sa8e0ta28	t	t	4.8	240	0	\N	Барилга тавилга авто бизнесийн бэлэн төсөл — 52 файл | DigitalGer	Барилга, блок үйлдвэр, тавилга, авто сервисийн 52 бэлэн бизнес төсөл. Банкинд шуудхан өгч болно.	2026-05-22 09:30:42.405	2026-05-23 08:46:41.415	2026-07-05 09:30:00	Барилга, материалын аль чиглэлд үйл ажиллагаа явуулах гэж буйгаа шийдэн тохирох загварыг нээнэ. Аж ахуйн нэгжийн нэр, хүчин чадал, байршлын мэдээллийг оруулан засварлаж банкинд өгнө.	52 бэлэн файл: барилга орон сууцны 18 төсөл, блок тоосгоны 11 загвар, тавилга модон эдлэлийн 12 файл, авто техникийн 8 төсөл, хашаа дээврийн 3 файл. Нэмэлтээр: 10 бонус файл.	465000.00	[{"title": "Татаж авах", "description": "Худалдан авсны дараа бүтээгдэхүүний хуудаснаас бүх файлыг нэг дор татаж авна."}, {"title": "Файл нээх", "description": "Word (.docx) болон PDF файлуудыг компьютер дээрх Word, Acrobat эсвэл онлайн Google Docs-оор нээнэ."}, {"title": "Тохируулах", "description": "Компанийн нэр, огноо, тоо хэмжээгээ оруулан загварыг өөрийн онцлогт тохируулна."}, {"title": "Ашиглах", "description": "Банк, ЖДҮ сан, хөрөнгө оруулагчдад шуудхан өгнө. Мэргэжилтнийг ажиллуулах шаардлагагүй."}]	\N	\N	\N	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/0fd077be-1bc1-44f0-93a3-5b8ff97e6626.jpg	Блокны жижиг үйлдвэр нээхийн тулд 25 сая зээл хэрэгтэй байсан. DigitalGer-ийн блокны үйлдвэрийн загварыг авч 4 хоногт засварлаад зээл авч чадлаа.	\N	{cmpgpyspf00037s2sa8e0ta28}	\N
cmpgpytu900gc7s2sabjusiwg	Оёдол нэхмэлийн 22 бэлэн төсөл	oiodol-huvtsas-belen-tusluud	Оёдлын цех, хувцасны үйлдвэр, нэхмэл эдлэл, оймс, пүүз зэрэг оёдол, нэхмэлийн бизнесийн бэлэн төсөл. Банкны зээл, ЖДҮ сан, хувийн хөрөнгө оруулалт татахад зориулсан.	39900.00	TUSUL	cmpgpyspo00047s2sn9t1thk2	t	f	5	334	0	\N	Оёдол нэхмэлийн бэлэн төсөл — 22 файл | DigitalGer	Оёдлын цех, нэхмэл, хувцасны үйлдвэрийн 22 бэлэн бизнес төсөл. Банкинд шуудхан өгч болно.	2026-05-22 09:30:42.705	2026-05-23 08:54:30.185	2026-07-05 17:30:00	Оёдол эсвэл нэхмэлийн чиглэлийг сонгон тохирох загварыг нээнэ. Цехийн хэмжээ, ажилчдын тоо, борлуулалтын зах зээлийн мэдээллийг оруулан засварлаж банкинд өгнө.	22 бэлэн файл: оёдлын цех үйлдвэрийн 10 загвар, нэхмэл ноосон эдлэлийн 12 файл. Нэмэлтээр: 10 бонус файл.	260000.00	[{"title": "Татаж авах", "description": "Худалдан авсны дараа бүтээгдэхүүний хуудаснаас бүх файлыг нэг дор татаж авна."}, {"title": "Файл нээх", "description": "Word (.docx) болон PDF файлуудыг компьютер дээрх Word, Acrobat эсвэл онлайн Google Docs-оор нээнэ."}, {"title": "Тохируулах", "description": "Компанийн нэр, огноо, тоо хэмжээгээ оруулан загварыг өөрийн онцлогт тохируулна."}, {"title": "Ашиглах", "description": "Банк, ЖДҮ сан, хөрөнгө оруулагчдад шуудхан өгнө. Мэргэжилтнийг ажиллуулах шаардлагагүй."}]	\N	\N	\N	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/e070c8f1-ce3b-4e4b-abbb-8afade22cfa4.jpg	Оёдлын цех 5 жил ажиллуулсан ч тэлэхийн тулд зээл авч байгаагүй. DigitalGer-ийн загварыг авсан чинь өргөтгөлийн санхүүгийн тооцоог хэрхэн бичих нь тодорхой болсон.	\N	{cmpgpyspo00047s2sn9t1thk2}	\N
cmpgpyt6g00547s2szjwu8vjr	Хүлэмж тариалангийн 62 бэлэн төсөл	hulemj-tarialan-belen-tusluud	Дөрвөн улирлын хүлэмж, чацаргана, мод үржүүлэг, мөөг, хүнсний ногоо зэрэг газар тариалан болон хүлэмжийн бизнесийн бэлэн төсөл. Банкны зээл, ЖДҮ санд бэлтгэгдсэн.	49900.00	TUSUL	cmpgpysoy00017s2secgw3nwv	t	t	5	438	0	\N	Хүлэмж тариалангийн бэлэн төсөл — 62 файл | DigitalGer	Хүлэмж, чацаргана, мод, мөөг, ногооны 62 бэлэн бизнес төсөл. Банкинд шуудхан өгч болно.	2026-05-22 09:30:41.848	2026-05-23 08:32:30.892	2026-07-05 17:30:00	Хүлэмж, тариалангийн чиглэлтэйгээ тохирох төслийг сонгон нээнэ. Хашааны хэмжээ, ургамлын төрөл, борлуулалтын зах зээлийн мэдээллийг оруулан засварлаж банкинд өгнө.	62 бэлэн файл: хүлэмжийн 18 төсөл, чацарганы 9 төсөл, мод үржүүлгийн 18 төсөл, мөөгний 3 төсөл, хүнсний ногооны 14 төсөл. Нэмэлтээр: 10 бонус файл.	465000.00	[{"title": "Татаж авах", "description": "Худалдан авсны дараа бүтээгдэхүүний хуудаснаас бүх файлыг нэг дор татаж авна."}, {"title": "Файл нээх", "description": "Word (.docx) болон PDF файлуудыг компьютер дээрх Word, Acrobat эсвэл онлайн Google Docs-оор нээнэ."}, {"title": "Тохируулах", "description": "Компанийн нэр, огноо, тоо хэмжээгээ оруулан загварыг өөрийн онцлогт тохируулна."}, {"title": "Ашиглах", "description": "Банк, ЖДҮ сан, хөрөнгө оруулагчдад шуудхан өгнө. Мэргэжилтнийг ажиллуулах шаардлагагүй."}]	\N	\N	\N	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/e7e69066-e02f-4c04-93f3-b62ae3fa3076.jpg	15 сая зээл авахаар хүлэмжийн төсөл бичих гэж их зүдэрсэн. DigitalGer-ийн хүлэмжийн загварыг авсан чинь 3 хоногт дуусч, хоёр долоо хоногт зөвшөөрөл авлаа.	\N	{cmpgpysoy00017s2secgw3nwv}	\N
cmpgpyu7600ma7s2sfrxh0qyu	Үйлчилгээ, аялал амралтын 42 бэлэн төсөл	uilchilgee-ayalal-belen-tusluud	Зочид буудал, аялал жуулчлал, халуун ус, фитнесс, гоо сайхан, сургалтын төв зэрэг үйлчилгээний бизнесийн бэлэн төсөл. Банкны зээл, хувийн хөрөнгө оруулалт татахад зориулсан.	39900.00	TUSUL	cmpgpysq300067s2sfnphvq5q	t	f	5	539	0	\N	Үйлчилгээ аялал амралтын бэлэн төсөл — 42 файл | DigitalGer	Зочид буудал, аялал жуулчлал, фитнесс, гоо сайханы 42 бэлэн бизнес төсөл.	2026-05-22 09:30:43.17	2026-05-23 09:12:03.816	2026-07-05 17:30:00	Үйлчилгээний чиглэлдээ тохирох загварыг сонгон нээнэ. Байршил, хүчин чадал, тарифын мэдээллийг оруулан засварлаж банкинд өгнө.	42 бэлэн файл: зочид буудлын 7 загвар, аялал жуулчлалын 9 файл, халуун ус фитнессийн 8 загвар, гоо сайхны 5 файл, сургалт болон бусад 13 файл. Нэмэлтээр: 10 бонус файл.	350000.00	[{"title": "Татаж авах", "description": "Худалдан авсны дараа бүтээгдэхүүний хуудаснаас бүх файлыг нэг дор татаж авна."}, {"title": "Файл нээх", "description": "Word (.docx) болон PDF файлуудыг компьютер дээрх Word, Acrobat эсвэл онлайн Google Docs-оор нээнэ."}, {"title": "Тохируулах", "description": "Компанийн нэр, огноо, тоо хэмжээгээ оруулан загварыг өөрийн онцлогт тохируулна."}, {"title": "Ашиглах", "description": "Банк, ЖДҮ сан, хөрөнгө оруулагчдад шуудхан өгнө. Мэргэжилтнийг ажиллуулах шаардлагагүй."}]	\N	\N	\N	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/2dff1469-93c5-4de6-b22e-77eb4dc36bf6.jpg	Жуулчны бааз байгуулахаар хэдэн сар хайсан ч тохирох загвар олоогүй. DigitalGer-ийн аялал жуулчлалын багцаас загвар сонгосон. Зээл амжилттай авсан.	\N	{cmpgpysq300067s2sfnphvq5q}	\N
cmpgpysqm00097s2swx6mfkzp	Мал аж ахуйн 67 бэлэн төсөл	mal-aj-ahui-belen-tusluud	Сүүний үнээ, мах, тахиа, гахай, ноолуур зэрэг мал аж ахуйн бүх чиглэлийн бэлэн бизнес төсөл, судалгааны эмхэтгэл. Банк, ЖДҮ, хөдөөгийн зээлд шуудхан гаргах зориулалттай — мэргэжилтэнтэй ажиллуулах нэмэлт зардалгүй.	49900.00	TUSUL	cmpgpyso800007s2s80pke02w	t	t	5	891	0	\N	Мал аж ахуйн бэлэн төсөл — 67 файл | DigitalGer	Сүүний үнээ, мах, тахиа, гахай, ноолуурын 67 бэлэн бизнес төсөл. Банкинд шуудхан өгч болно.	2026-05-22 09:30:41.275	2026-05-23 07:56:54.06	2026-07-05 17:30:00	Татаж аваад хэрэгтэй чиглэлийнхээ төслийг нээнэ. Компанийн нэр, огноо, тоо хэмжээгээ оруулан засварлаад банк, ЖДҮ санд өгнө.	67 бэлэн файл: сүүний үнээний 17 төсөл, мах үхрийн 17 төсөл, тахиа өндөгний 12 төсөл, гахайн 5 төсөл, ноолуур арьс ширний 10 төсөл, бусад малын 6 төсөл. Нэмэлтээр: 10 бонус файл.	350000.00	[{"title": "Татаж авах", "description": "Худалдан авсны дараа бүтээгдэхүүний хуудаснаас бүх файлыг нэг дор татаж авна."}, {"title": "Файл нээх", "description": "Word (.docx) болон PDF файлуудыг компьютер дээрх Word, Acrobat эсвэл онлайн Google Docs-оор нээнэ."}, {"title": "Тохируулах", "description": "Компанийн нэр, огноо, тоо хэмжээгээ оруулан загварыг өөрийн онцлогт тохируулна."}, {"title": "Ашиглах", "description": "Банк, ЖДҮ сан, хөрөнгө оруулагчдад шуудхан өгнө. Мэргэжилтнийг ажиллуулах шаардлагагүй."}]	\N	Б.Ганбаатар	Өвөрхангай — Сүүний фермерийн эзэн	\N	Мал аж ахуйн зээл авхаар 3 сар тэмцсэн. DigitalGer-ийн сүүний үнээний төслийг тохируулаад банкинд өгсөн чинь хоёр долоо хоногт зөвшөөрөл ирлээ. 80 сая авлаа.	\N	{cmpgpyso800007s2s80pke02w}	\N
cmpgpyumu00tx7s2swj1osyxy	Бүх салбарын нэгтгэсэн 300+ бэлэн төсөл - Platinum  багц	platinum-belen-tusluud	DigitalGer-ийн бүх 8 ангиллын бэлэн бизнес төсөл нэг багцад. Мал аж ахуй, хүлэмж тариалан, ресторан кафе, барилга тавилга, оёдол нэхмэл, хүнс үйлдвэр, үйлчилгээ аялал, маркетинг технологи — нийт 300 гаруй файл. Банк, ЖДҮ сан, хөрөнгө оруулалт, дипломын ажил — аль ч зориулалтад хэрэглэнэ.	139000.00	TUSUL	cmpgpyso800007s2s80pke02w	t	t	5	124	0	\N	PLATINUM — 300+ бэлэн бизнес төсөл | DigitalGer	Мал аж ахуй, хүлэмж, ресторан, барилга, оёдол, хүнс, үйлчилгээ, маркетингийн 300+ бэлэн бизнес төсөл нэг багцад.	2026-05-22 09:30:43.734	2026-05-23 16:23:48.538	2026-06-29 01:30:00	Аль ч ангиллын файлыг нээнэ. Хэрэгтэй загварынхаа нэр, тоо, огноог засварлаад банк, ЖДҮ, хөрөнгө оруулагчдад өгнө.	300 гаруй файл: мал аж ахуй 67, хүлэмж тариалан 62, ресторан кафе 31, барилга тавилга 52, оёдол нэхмэл 22, хүнс үйлдвэр 52, үйлчилгээ аялал 42, маркетинг технологи 58, нэмэлт бонус 10 файл.	1650000.00	[{"title": "Татаж авах", "description": "Худалдан авсны дараа бүтээгдэхүүний хуудаснаас бүх файлыг нэг дор татаж авна."}, {"title": "Файл нээх", "description": "Word (.docx) болон PDF файлуудыг компьютер дээрх Word, Acrobat эсвэл онлайн Google Docs-оор нээнэ."}, {"title": "Тохируулах", "description": "Компанийн нэр, огноо, тоо хэмжээгээ оруулан загварыг өөрийн онцлогт тохируулна."}, {"title": "Ашиглах", "description": "Банк, ЖДҮ сан, хөрөнгө оруулагчдад шуудхан өгнө. Мэргэжилтнийг ажиллуулах шаардлагагүй."}]	\N	\N	\N	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/1d8fd11f-d2b0-4853-90a1-8ee12ec8d100.jpg	PLATINUM авсан нь хамгийн зөв шийдвэр байсан. Тус тусад нь авбал 5-6 дахин илүү үнэ болно байсан. Мал аж ахуй болон маркетингийн загваруудыг хоёуланг нь ашигласан.	PLATINUM-ийн хүлэмж + мал аж ахуйн хослол маш их хэрэгтэй байсан — хоёр чиглэлийн зээлийг нэг дор бэлтгэж чадсан.	{cmpgpyso800007s2s80pke02w,cmpgpysoy00017s2secgw3nwv,cmpgpysp700027s2s6093zhyg,cmpgpyspf00037s2sa8e0ta28,cmpgpyspo00047s2sn9t1thk2,cmpgpyspw00057s2sv6qujibx,cmpgpysq300067s2sfnphvq5q,cmpgpysq900077s2shwn148fo}	\N
cmpij23yk00027s04u7m67yoi	Байгууллагын Бэлэн Албан Баримтын Иж Бүрдэл — 70 Файл, 8 Ангилал	alban-barimt-bundle	<p>Байгууллагын Бэлэн Албан Баримтын Иж Бүрдэл нь Монгол ХХК, стартап, жижиг дунд бизнесүүдэд зориулан боловсруулсан 70 файлын цогц багц юм. Ажил эхлэхдээ бичиг баримт бэлтгэхэд цаг алдах хэрэггүй — дор хаяж 300 цагийн ажлыг орлох бэлэн загваруудыг нэг дарснаар татаж авна. </p>	49000.00	BUNDLE	cmpij23v200007s049qukl9zj	t	t	5	1240	0	\N	Байгууллагын бэлэн бичиг баримт — 70 файл: гэрээ, санхүү, HR, маркетинг | DigitalGer	ХХК, стартап, байгууллагад шуудхан ашиглах 70 файлын бэлэн иж бүрдэл. Хөдөлмөрийн гэрээ, нэхэмжлэх, SWOT, Gantt chart, CRM, OKR, баланс тайлан гэх мэт 8 ангиллын бүх баримт нэг дороос.	2026-05-23 15:52:50.827	2026-05-23 16:20:37.473	2026-05-26 23:56:00	1. Татаж авсны дараа ZIP задлан 8 хавтасны бүтцийг харна\n2. Тус ангиллаасаа хэрэгтэй файлаа нээнэ\n3. Компанийн нэр, хаяг, огноо зэрэг тохируулалтыг хийнэ\n4. Шууд хэвлэж, нотариатаар баталгаажуулж болно (гэрээнүүд)\n5. Excel файлуудад өөрийн тоо баримт оруулахад автоматаар тооцоолно	✅ 70 файл (Word + Excel + PowerPoint)\n✅ 8 ангилал бүрийн хавтас\n✅ Монгол хуульд нийцсэн гэрээний загварууд\n✅ Ажиллагаатай Excel тооцоолуурууд (цалин, баланс, нэхэмжлэх)\n✅ Хэвлэхэд бэлэн форматтай\n✅ Нэр, хаяг өөрчлөхөд л бэлэн\n✅ Татаж авснаас хойш хугацаагүй ашиглана	850000.00	[{"title": "Төлбөрийг хялбар систем", "description": "QPay болон банкны картаар хялбар, аюулгүй төлбөр хийнэ."}, {"title": "Шууд татах линк", "description": "Төлбөр амжилттай болмогц файл татах линк автоматаар ирнэ."}, {"title": "Шууд ашиглахад бэлэн", "description": "Татаж авсан файлаа нээж шууд ашиглана. Тусламж хэрэгтэй бол бидэнтэй холбогдоорой."}]	\N	\N	\N	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/5253f461-7ded-494c-93d1-00b90cb91152.jpg	Хуульчид 200,000 төгрөгийн гэрээ бичүүлдэг байсан. Энэ багцаас авсан гэрээний загварыг 10 минутад тохируулж шууд ашигласан. Мөнгө, цаг хоёулаа хэмнэлээ.	Монголын жижиг бизнес эрхлэгчдийн хамгийн том асуудлын нэг бол бичиг баримт. Хуульч, нягтлан, маркетерт тус бүрд мөнгө зарцуулахгүйгээр мэргэжлийн түвшний бүх загварыг нэг удаа 49,000 төгрөгт авна.	{cmpij23v200007s049qukl9zj,cmpgpysq900077s2shwn148fo}	\N
\.


--
-- Data for Name: ProductBundle; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductBundle" (id, "productId", title, description, "sortOrder", "downloadFileKey") FROM stdin;
cmpij246300047s04g10lzani	cmpij23yk00027s04u7m67yoi	📁 Компанийн үндсэн бичиг баримт	Байгууллагын үйл ажиллагааны суурь баримт бичгүүд — журам, дүрэм, бүртгэл, бичгийн загварууд	1	\N
cmpij24g5000s7s04m08jcnhp	cmpij23yk00027s04u7m67yoi	💰 Санхүүгийн бичиг баримт	Цалин тооцоолуур, баланс тайлан, нэхэмжлэх, мөнгөн урсгал — бүх санхүүгийн загварууд	2	\N
cmpij24kv001c7s0458dt4rn9	cmpij23yk00027s04u7m67yoi	📊 Төслийн удирдлага	Gantt chart, SWOT, Business Model Canvas, OKR, Stakeholder management — төслийн бүх хэрэгсэл	3	\N
cmpij24mp001y7s04yia7vt26	cmpij23yk00027s04u7m67yoi	👥 Хүний нөөцийн бичиг баримт	Ажилтны бүртгэл, анкет, гэрээ, үнэлгээний маягт, NDA — HR-ийн бүх загварууд	4	\N
cmpij24oc002i7s049tfsxsbp	cmpij23yk00027s04u7m67yoi	📝 Гэрээний загварууд	9 төрлийн гэрээний загвар — хөдөлмөрийн, худалдааны, NDA, зөвлөх, түрээс гэх мэт	5	\N
cmpij24r000327s04h1m6rf7i	cmpij23yk00027s04u7m67yoi	📣 Маркетинг, борлуулалт	CRM систем, контент календар, борлуулалтын KPI, өрсөлдөгчийн шинжилгээ, брэндийн удирдамж	6	\N
cmpij24ti003s7s0494mv4bsr	cmpij23yk00027s04u7m67yoi	⚙️ Үйл ажиллагааны удирдлага	OKR систем, агуулахын бүртгэл, эрсдэлийн удирдлага, хөрөнгийн бүртгэл, нийлүүлэгчийн tracker	7	\N
cmpij24va004c7s04lphv8xsn	cmpij23yk00027s04u7m67yoi	🖥️ Компанийн танилцуулга	PowerPoint танилцуулгын мэргэжлийн загвар — хөрөнгө оруулагч, харилцагчид танилцуулахад бэлэн	8	\N
cmpgpysrg000b7s2s1wx99t3l	cmpgpysqm00097s2swx6mfkzp	Сүүний үнээ, сүүн үйлдвэр	17 бэлэн төсөл — ферм байгуулах, зээл авах, үйлдвэрлэл өргөтгөх	1	\N
cmpgpysv4001b7s2sx4bkls5s	cmpgpysqm00097s2swx6mfkzp	Мах, үхэр, адуу	Махны чиглэлийн 17 төсөл — зоорь, боловсруулалт, экспорт	2	\N
cmpgpysx6002b7s2sjyzvwy08	cmpgpysqm00097s2swx6mfkzp	Тахиа, өндөг, тэжээл	Тахианы аж ахуй, малын тэжээлийн 12 төсөл	3	\N
cmpgpysyj00317s2sdzoys9l0	cmpgpysqm00097s2swx6mfkzp	Гахай	Гахайн эрчимжсэн аж ахуйн 5 бэлэн баримт	4	\N
cmpgpyszm003d7s2s31i3buih	cmpgpysqm00097s2swx6mfkzp	Ноолуур, ноос, арьс, шир	Кашмер, арьс шир, ноосон утас — 10 төсөл	5	\N
cmpgpyt0m003z7s2s2lqzv3ag	cmpgpysqm00097s2swx6mfkzp	Бусад мал, тэжээл	Хонь, тэжээлийн үйлдвэр — 6 файл	6	\N
cmpgpyt19004d7s2sa5qa5acb	cmpgpysqm00097s2swx6mfkzp	Бонус файлууд	Төсөл бичих, зээл авах, бизнес удирдахад хэрэгтэй 10 арга зүйн баримт бичиг	7	\N
cmpgpyt6k00567s2su0uedyqi	cmpgpyt6g00547s2szjwu8vjr	Хүлэмжийн аж ахуй	Дөрвөн улирлын, автоматжуулсан, жижиг хүлэмж — 18 төсөл	1	\N
cmpgpyt8d00687s2sxnvtzcxc	cmpgpyt6g00547s2szjwu8vjr	Чацаргана	Чацаргана тариалах, боловсруулах, шүүс гаргах — 9 төсөл	2	\N
cmpgpyt9k006s7s2snys3pvey	cmpgpyt6g00547s2szjwu8vjr	Мод үржүүлэг	Мод тарих, ойжуулалт, жимсний аж ахуй — 18 файл	3	\N
cmpgpytbd007u7s2smu4dzti2	cmpgpyt6g00547s2szjwu8vjr	Мөөг тариалан	Хүнсний мөөгний 3 бэлэн төсөл	4	\N
cmpgpytbs00827s2s5ecu9i3q	cmpgpyt6g00547s2szjwu8vjr	Хүнсний ногоо, тариалан	Төмс, ногоо, тариалангийн 14 бэлэн загвар	5	\N
cmpgpytda008w7s2skqhwsmj1	cmpgpyt6g00547s2szjwu8vjr	Бонус файлууд	Төсөл бичих, зээл авах, бизнес удирдахад хэрэгтэй 10 арга зүйн баримт бичиг	6	\N
cmpgpytfz009o7s2smjv1v7qj	cmpgpytf9009m7s2seiktzgih	Ресторан, зоогийн газар	Жижиг хоолны газраас лаунж ресторан хүртэл — 11 загвар	1	\N
cmpgpythr00ac7s2ss6596gkr	cmpgpytf9009m7s2seiktzgih	Кафе, кофе шоп	Coffee House болон Coffee Shop бизнес төлөвлөгөө	2	\N
cmpgpyti100ai7s2seh5c1y4t	cmpgpytf9009m7s2seiktzgih	Дарс, айраг, шар айраг	Ундааны үйлдвэрлэлийн 4 бэлэн төсөл	3	\N
cmpgpytih00as7s2snefqpo34	cmpgpytf9009m7s2seiktzgih	Цай үйлдвэрлэл	Байхов болон ерөнхий цайны үйлдвэрлэлийн 2 файл	4	\N
cmpgpytir00ay7s2ssti16ita	cmpgpytf9009m7s2seiktzgih	Талх, нарийн боов, гоймон	Талх, бууз, гоймон, хиам үйлдвэрлэлийн 12 загвар	5	\N
cmpgpytk200bo7s2s3bvwnwv7	cmpgpytf9009m7s2seiktzgih	Бонус файлууд	Төсөл бичих, зээл авах, бизнес удирдахад хэрэгтэй 10 арга зүйн баримт бичиг	6	\N
cmpgpytm200cg7s2s2fhk6lpx	cmpgpytlx00ce7s2s7196iudd	Барилга, орон сууц	Зам, барилга, орон сууц, цахилгаан дамжуулгын 18 бэлэн файл	1	\N
cmpgpytob00di7s2sikiyz55j	cmpgpytlx00ce7s2s7196iudd	Блок, тоосго, хийц	Пено блок, бетон хийц, хөнгөн блокны 11 загвар	2	\N
cmpgpytpu00e67s2sfnvwl0pj	cmpgpytlx00ce7s2s7196iudd	Тавилга, модон эдлэл	Тавилгын үйлдвэр, мужааны цех, модон эдлэлийн 12 файл	3	\N
cmpgpytr400ew7s2smbwoxya0	cmpgpytlx00ce7s2s7196iudd	Авто, техник, засвар	Авто угаалга, сервис, дугуй засвар, гагнуурын 8 төсөл	4	\N
cmpgpytrz00fe7s2sofbrvshd	cmpgpytlx00ce7s2s7196iudd	Хашаа, дээвэр	Гоёлын хашаа, черепиц, угсармал хашааны 3 файл	5	\N
cmpgpytsd00fm7s2sc0i5uc8x	cmpgpytlx00ce7s2s7196iudd	Бонус файлууд	Төсөл бичих, зээл авах, бизнес удирдахад хэрэгтэй 10 арга зүйн баримт бичиг	6	\N
cmpgpytuz00ge7s2she0k7tmy	cmpgpytu900gc7s2sabjusiwg	Оёдлын цех, үйлдвэр	Монгол дээл, оёдлын цех, үйлдвэр байгуулах — 10 загвар	1	\N
cmpgpytw600h07s2sk8a0pm04	cmpgpytu900gc7s2sabjusiwg	Нэхмэл, ноосон эдлэл	Оймс, пүүз, бээлий, эсгий, ээрмэл — 12 файл	2	\N
cmpgpytxn00hq7s2sisvavgey	cmpgpytu900gc7s2sabjusiwg	Бонус файлууд	Төсөл бичих, зээл авах, бизнес удирдахад хэрэгтэй 10 арга зүйн баримт бичиг	3	\N
cmpgpytzf00ih7s2s3yhuc84e	cmpgpytzb00if7s2ske45g8st	Гурил, дан тариалан	Гурилын үйлдвэр, хэрчсэн гурилын 3 бэлэн файл	1	\N
cmpgpytzu00ip7s2s824jd7v7	cmpgpytzb00if7s2ske45g8st	Сүүн бүтээгдэхүүн	Сүү боловсруулах, хуурай сүү, цагаан идээний 19 файл	2	\N
cmpgpyu2100jt7s2sa8jlrxeg	cmpgpytzb00if7s2ske45g8st	Масло, тос, ургамал	Маслоны үйлдвэр, ургамлын тосны 4 загвар	3	\N
cmpgpyu2h00k37s2s4yva8bs6	cmpgpytzb00if7s2ske45g8st	Бусад хүнс ба хөнгөн үйлдвэр	Цаасан уут, хог, ус, салфетка гэх мэт 26 файл	4	\N
cmpgpyu5100ll7s2sasebkq5v	cmpgpytzb00if7s2ske45g8st	Бонус файлууд	Төсөл бичих, зээл авах, бизнес удирдахад хэрэгтэй 10 арга зүйн баримт бичиг	5	\N
cmpgpyu7a00mc7s2sne3c2dyb	cmpgpyu7600ma7s2sfrxh0qyu	Зочид буудал, амралт	Буудал, амралтын газар, сувилал, цэцэрлэгт хүрээлэн — 7 загвар	1	\N
cmpgpyu8300ms7s2sbg7q0ml3	cmpgpyu7600ma7s2sfrxh0qyu	Аялал жуулчлал	Аялалын цогцолбор, монгол гэр, жуулчны бааз — 9 файл	2	\N
cmpgpyu9200nc7s2suv9h46nd	cmpgpyu7600ma7s2sfrxh0qyu	Халуун ус, фитнесс	Фитнесс клуб, халуун усны газар, иог, эмэгтэйчүүдийн төв — 8 файл	3	\N
cmpgpyua100nu7s2sau118bf7	cmpgpyu7600ma7s2sfrxh0qyu	Гоо сайхан, үсчин	Арьс гоо засал, маникур, үсчин, гоо сайхны төв — 5 файл	4	\N
cmpgpyual00o67s2sdroci2xa	cmpgpyu7600ma7s2sfrxh0qyu	Сургалтын төв, дэлгүүр, бусад	Супермаркет, кино театр, шатахуун, эрүүл мэнд — 13 файл	5	\N
cmpgpyuc800oy7s2sfy5g2958	cmpgpyu7600ma7s2sfrxh0qyu	Бонус файлууд	Төсөл бичих, зээл авах, бизнес удирдахад хэрэгтэй 10 арга зүйн баримт бичиг	6	\N
cmpgpyue300pp7s2s7tnslvp4	cmpgpyudz00pn7s2sscoogfdt	Маркетингийн загвар, төлөвлөгөө	Маркетингийн судалгаа, SWOT, бизнес загвар — 18 файл	1	\N
cmpgpyug400qr7s2sk5kr87z0	cmpgpyudz00pn7s2sscoogfdt	Санхүүгийн шинжилгээ	Баланс, зээлийн эрсдэл, банкны судалгаа — 10 файл	2	\N
cmpgpyuh800rd7s2srwtujxpd	cmpgpyudz00pn7s2sscoogfdt	Төслийн менежмент	ЖДҮ загвар, төслийн хуваарь, бизнес төлөвлөлт — 7 файл	3	\N
cmpgpyui000rt7s2s1xci0yt6	cmpgpyudz00pn7s2sscoogfdt	Боловсрол, сургалт	Сургууль, цэцэрлэг, сургалтын байгууллагын 8 загвар	4	\N
cmpgpyuix00sb7s2s8ce8pijw	cmpgpyudz00pn7s2sscoogfdt	Технологи, IT	Компьютерийн үйлчилгээ, онлайн систем, IT бизнесийн 15 файл	5	\N
cmpgpyukk00t77s2stns4cai1	cmpgpyudz00pn7s2sscoogfdt	Бонус файлууд	Төсөл бичих, зээл авах, бизнес удирдахад хэрэгтэй 10 арга зүйн баримт бичиг	6	\N
cmpgpyun100tz7s2syplxt1c8	cmpgpyumu00tx7s2swj1osyxy	Мал аж ахуй (67 файл)	Сүүний үнээ, мах, тахиа, гахай, ноолуур, бусад малын бүх төсөл	1	\N
cmpgpyuu500xr7s2s7fex1uzn	cmpgpyumu00tx7s2swj1osyxy	Хүлэмж, тариалан (62 файл)	Хүлэмж, чацаргана, мод үржүүлэг, мөөг, хүнсний ногооны бүх төсөл	2	\N
cmpgpyv0m01197s2s502gt2tc	cmpgpyumu00tx7s2swj1osyxy	Ресторан, кафе, хоол (31 файл)	Ресторан, кафе, дарс, цай, талх нарийн боовны бүх загвар	3	\N
cmpgpyv3z01317s2suoz82xch	cmpgpyumu00tx7s2swj1osyxy	Барилга, тавилга, авто (52 файл)	Барилга, блок, тавилга, авто засвар, хашаа дээврийн бүх файл	4	\N
cmpgpyva8015z7s2supp4f5vu	cmpgpyumu00tx7s2swj1osyxy	Оёдол, нэхмэл, хувцас (22 файл)	Оёдлын цех болон нэхмэл эдлэлийн бүх загвар	5	\N
cmpgpyvci01797s2stnbh93yt	cmpgpyumu00tx7s2swj1osyxy	Хүнс боловсруулах үйлдвэр (52 файл)	Гурил, сүү, масло, хог, цаасан уут, ус гэх мэт бүх файл	6	\N
cmpgpyvhx01a77s2sedb6rghl	cmpgpyumu00tx7s2swj1osyxy	Үйлчилгээ, аялал, амралт (42 файл)	Зочид буудал, аялал, фитнесс, гоо сайхан, дэлгүүрийн бүх загвар	7	\N
cmpgpyvm501cl7s2symruztuu	cmpgpyumu00tx7s2swj1osyxy	Маркетинг, боловсрол, технологи (58 файл)	Маркетинг, санхүү, менежмент, IT, боловсролын бүх загвар	8	\N
cmpgpyvzu01fv7s2siuvpo6ht	cmpgpyumu00tx7s2swj1osyxy	Бонус файлууд	Төсөл бичих, зээл авах, бизнес удирдахад хэрэгтэй 10 арга зүйн баримт бичиг	9	\N
\.


--
-- Data for Name: ProductFAQ; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductFAQ" ("productId", "faqId", "sortOrder") FROM stdin;
cmpij23yk00027s04u7m67yoi	cmpij24vm004f7s047n98fwah	0
cmpij23yk00027s04u7m67yoi	cmpij24wh004g7s04vzebwb51	1
cmpij23yk00027s04u7m67yoi	cmpij24wr004h7s04xd6hsch7	2
cmpij23yk00027s04u7m67yoi	cmpij24x2004i7s042axcb2ar	3
cmpij23yk00027s04u7m67yoi	cmpij252f004j7s04wlinxtj5	4
cmpij23yk00027s04u7m67yoi	cmpij2555004k7s04uo85fhxe	5
cmpgpytlx00ce7s2s7196iudd	cmpgpyttf00g77s2st123j296	0
cmpgpytlx00ce7s2s7196iudd	cmpgpyttm00g87s2sabnekim1	1
cmpgpytlx00ce7s2s7196iudd	cmpgpyttt00g97s2s7q4lt5qv	2
cmpgpytlx00ce7s2s7196iudd	cmpgpytu000ga7s2suht4z8t7	3
cmpgpytf9009m7s2seiktzgih	cmpgpytl600c97s2sb6jqhewf	0
cmpgpytf9009m7s2seiktzgih	cmpgpytld00ca7s2s3g0ka7yl	1
cmpgpytf9009m7s2seiktzgih	cmpgpytlk00cb7s2swh7xjnoa	2
cmpgpytf9009m7s2seiktzgih	cmpgpytlq00cc7s2sxxmiwbci	3
cmpgpyumu00tx7s2swj1osyxy	cmpgpyw1a01gg7s2smfrfmduf	0
cmpgpyumu00tx7s2swj1osyxy	cmpgpyw1i01gh7s2s4eridfv7	1
cmpgpyumu00tx7s2swj1osyxy	cmpgpyw1q01gi7s2sdnmf64l7	2
cmpgpysqm00097s2swx6mfkzp	cmpgpyt2r004y7s2si1gsfg5c	0
cmpgpysqm00097s2swx6mfkzp	cmpgpyt5n004z7s2setp00r6x	1
cmpgpysqm00097s2swx6mfkzp	cmpgpyt5u00507s2spj8fg0oo	2
cmpgpysqm00097s2swx6mfkzp	cmpgpyt6100517s2sgb387ogt	3
cmpgpysqm00097s2swx6mfkzp	cmpgpyt6800527s2ske5ve9kd	4
cmpgpyt6g00547s2szjwu8vjr	cmpgpyte9009h7s2s5y25sz82	0
cmpgpyumu00tx7s2swj1osyxy	cmpgpyw1z01gj7s2sf9pb7aft	3
cmpgpyumu00tx7s2swj1osyxy	cmpgpyw2501gk7s2sloevdyrc	4
cmpgpyt6g00547s2szjwu8vjr	cmpgpyteh009i7s2sqy6r7z1l	1
cmpgpyt6g00547s2szjwu8vjr	cmpgpyteo009j7s2sdqtj0d9v	2
cmpgpyt6g00547s2szjwu8vjr	cmpgpytew009k7s2sb912tps0	3
cmpgpytu900gc7s2sabjusiwg	cmpgpytyr00ib7s2s8abbhng3	0
cmpgpytu900gc7s2sabjusiwg	cmpgpytyx00ic7s2s33t9giqm	1
cmpgpytu900gc7s2sabjusiwg	cmpgpytz300id7s2sxcsci58b	2
cmpgpyudz00pn7s2sscoogfdt	cmpgpyum200ts7s2s3c7w6xtr	0
cmpgpyudz00pn7s2sscoogfdt	cmpgpyum900tt7s2s132zbfkq	1
cmpgpyudz00pn7s2sscoogfdt	cmpgpyumg00tu7s2su051ccl1	2
cmpgpyudz00pn7s2sscoogfdt	cmpgpyumm00tv7s2sidmbyv0t	3
\.


--
-- Data for Name: ProductFile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductFile" (id, "productId", "fileName", "fileKey", "mimeType", "sizeBytes", "sortOrder", "createdAt") FROM stdin;
cmpgwiv5a00017shk5fygoy5s	cmpgpyumu00tx7s2swj1osyxy	100 сүүний үнээний эрчимжсэн аж ахуйн төсөл 21х.docx	uploads/9cca7caa-698f-4133-a0d2-164dd50b7e4c.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	883905	0	2026-05-22 12:34:15.212
cmpgwtiix00017sxs22kzwhyy	cmpgpyumu00tx7s2swj1osyxy	40-50 сүүний үнээний ферм.doc	uploads/16a08c60-9df0-4736-b979-68faab70e519.doc	application/msword	3012608	1	2026-05-22 12:42:32.074
cmpgwvel600037sxsr9wwmw6g	cmpgpyumu00tx7s2swj1osyxy	Сайн чанарын сүүний үйлдвэр байгуулах төсөл 43x.pdf	uploads/57efde0e-5b18-49eb-855a-375a30d6a62c.pdf	application/pdf	1627508	2	2026-05-22 12:44:00.282
cmpgwvmi500057sxsifgdztdr	cmpgpyumu00tx7s2swj1osyxy	СҮҮ СҮҮН БҮТЭЭГДЭХҮҮНИЙ ҮЙЛДВЭРЛЭЛ ХУДАЛДААНД МӨРДӨХ ТЕХНИКИЙН ЗОХИЦУУЛАЛТ 21х.doc	uploads/7389d560-7bb3-4dfd-9640-a6c9c520eebf.doc	application/msword	125952	3	2026-05-22 12:44:10.541
cmpgww2h800077sxs69kpzesp	cmpgpyumu00tx7s2swj1osyxy	Сүү боловсруулах үйлдвэрийн төсөл 27x.pdf	uploads/4d45abc0-29e7-4792-b1ef-589f3c961944.pdf	application/pdf	741751	4	2026-05-22 12:44:31.245
cmpgww6su00097sxsaeaf7bp9	cmpgpyumu00tx7s2swj1osyxy	Сайн чанарын сүүний үйлдвэр байгуулах төсөл 43x.pdf	uploads/99fcc91a-27a6-4cf1-af55-6900821844ca.pdf	application/pdf	1627508	5	2026-05-22 12:44:36.846
cmpgwwoji000b7sxsm0kbaj5o	cmpgpyumu00tx7s2swj1osyxy	Сүү, сүүн бүтээгдэхүүн үйлдвэрлэх төсөл 37х.docx	uploads/c16fd7bd-21fa-4162-916e-5121990d64d1.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	296435	6	2026-05-22 12:44:59.839
cmpgwwttt000d7sxs4dswhoxe	cmpgpyumu00tx7s2swj1osyxy	Сүүний зах зээлийн судалгаа.pdf	uploads/abfadcf8-de0b-403c-95c5-f97caba96414.pdf	application/pdf	580861	7	2026-05-22 12:45:06.689
cmpgwwzbr000f7sxs3u94kupz	cmpgpyumu00tx7s2swj1osyxy	Сүүний үйлдвэр төсөл 36x.docx	uploads/1c3e310f-7d9b-4256-a4d9-2c633bcfee46.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	4783608	8	2026-05-22 12:45:13.816
cmpgwx8jw000h7sxsmhedp853	cmpgpyumu00tx7s2swj1osyxy	Сүүний үйлдвэрийн гарын авлага.pdf	uploads/2aedb2e1-4704-4006-9e41-0817f62ec9de.pdf	application/pdf	2727021	9	2026-05-22 12:45:25.772
cmpgwxet3000j7sxstbnrj5wh	cmpgpyumu00tx7s2swj1osyxy	Хуурай сүүний төсөл 37x.pdf	uploads/b9f8a37e-8885-42b6-867d-524a466510d9.pdf	application/pdf	1193565	10	2026-05-22 12:45:33.879
cmpgwxivd000l7sxsf87nvf2p	cmpgpyumu00tx7s2swj1osyxy	Хуурай сүүний үйлдвэрлэл төсөл 22x.docx	uploads/d6386e6f-aeac-435e-b762-8d0d0865fd1f.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	351084	11	2026-05-22 12:45:39.145
cmpgwxnkr000n7sxsn2wvupsi	cmpgpyumu00tx7s2swj1osyxy	Цагаан идээний үйлдвэрийн төсөл 35х.pdf	uploads/d8d7a2db-2e12-4171-9726-7c4c973e47d1.pdf	application/pdf	941429	12	2026-05-22 12:45:45.243
cmpgwxumn000p7sxsraxt24v5	cmpgpyumu00tx7s2swj1osyxy	сүүний үхрийн аж ахуйн төсөл 43х.docx	uploads/fcbdfaeb-7331-43c9-8588-85fd580da706.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	1275752	13	2026-05-22 12:45:54.383
cmpgwy57f000r7sxsbfphd8ai	cmpgpyumu00tx7s2swj1osyxy	Үнээний ферм төсөл 26x.docx	uploads/9c07ffa3-e948-46b6-88fe-fd8c4600aba6.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	425831	14	2026-05-22 12:46:08.091
cmpgwy9q8000t7sxsn1f6ivio	cmpgpyumu00tx7s2swj1osyxy	Үнээний ферм төсөл 47х.doc	uploads/48f00792-deaa-4cd0-b21f-d60f555513d1.doc	application/msword	3137536	15	2026-05-22 12:46:13.952
cmpgwyeym000v7sxse5vcb6l6	cmpgpyumu00tx7s2swj1osyxy	Үнээний фермер төсөл 29x.docx	uploads/202f3da5-da71-4441-a2d5-9e5e8e2a2757.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	61707	16	2026-05-22 12:46:20.735
cmpgx0m68000x7sxstda8vc3o	cmpgpyumu00tx7s2swj1osyxy	ДӨРВӨН УЛИРЛЫН  ХҮЛЭМЖИЙН ТӨСӨЛ 28х.docx	uploads/e4849b1f-6193-410f-b0eb-2645a9647b07.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	3264475	17	2026-05-22 12:48:03.393
cmpgx0q2n000z7sxs3hz1sh2j	cmpgpyumu00tx7s2swj1osyxy	ДӨРВӨН УЛИРЛЫН ХҮЛЭМЖИЙН АЖ АХУЙ төсөл 201х.pdf	uploads/0b7a40f7-9812-48d9-8014-2abc14fe26a4.pdf	application/pdf	687874	18	2026-05-22 12:48:08.448
cmpgx0wow00117sxsgvb13f0k	cmpgpyumu00tx7s2swj1osyxy	НАРНЫ ЭРЧИМЭЭР АЖИЛЛАДАГ ХҮЛЭМЖ гарын авлага.pdf	uploads/131c782d-d6e7-430b-8878-d05369f77222.pdf	application/pdf	6155812	19	2026-05-22 12:48:17.024
cmpgx12n000137sxsp3qhx8q6	cmpgpyumu00tx7s2swj1osyxy	Нарийн ногооны хүлэмжийн төсөл 11x.docx	uploads/c28bf3e1-0e67-40d6-8b88-ce97ff4a6624.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	41867	20	2026-05-22 12:48:24.732
cmpgx183e00157sxsyiu3b21p	cmpgpyumu00tx7s2swj1osyxy	Хүлэмж төсөл 3x.docx	uploads/9f39da10-5f6b-4d05-8cee-55654c4dcc8f.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	1202421	21	2026-05-22 12:48:31.802
cmpgx1jbu00177sxsozdhfzsm	cmpgpyumu00tx7s2swj1osyxy	Хүлэмжийн автоматжуулалтын систем.pdf	uploads/62d69fdc-9f4d-4fec-b26f-55951244b8ef.pdf	application/pdf	6751051	22	2026-05-22 12:48:46.362
cmpgx1xdx00197sxss5k16nzf	cmpgpyumu00tx7s2swj1osyxy	Хүлэмжийн аж ахуй Ногоон шим төсөл 15x.pdf	uploads/09bb568a-baba-40b8-9dc8-28adc93b7884.pdf	application/pdf	526468	23	2026-05-22 12:49:04.581
cmpgx22pb001b7sxs1dl3u8cu	cmpgpyumu00tx7s2swj1osyxy	Хүлэмжийн аж ахуй эрхлэх “Баян бүрд” төсөл 8х.pptx	uploads/184302bf-0d63-4e0c-8c2c-7010fdfff8be.pptx	application/vnd.openxmlformats-officedocument.presentationml.presentation	219913	24	2026-05-22 12:49:11.471
cmpgx295w001d7sxs7w3qg4a7	cmpgpyumu00tx7s2swj1osyxy	Хүлэмжийн тариалалт 15х.pdf	uploads/87bc0b74-cb86-476a-b535-95fedffd782a.pdf	application/pdf	120254	25	2026-05-22 12:49:19.844
cmpgx2enp001f7sxs6yq9chp1	cmpgpyumu00tx7s2swj1osyxy	Хүлэмжийн төсөл 11x.doc	uploads/cdee4443-c1c9-44c0-a8f5-e80a97258dbb.doc	application/msword	8632320	26	2026-05-22 12:49:26.966
cmpgx2ipy001h7sxs6umlxccp	cmpgpyumu00tx7s2swj1osyxy	Хүлэмжийн төсөл 16x.docx	uploads/12acff3b-15aa-4dcc-97cf-f594dd497ca4.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	1268553	27	2026-05-22 12:49:32.23
cmpgx2nn4001j7sxsupztxwf1	cmpgpyumu00tx7s2swj1osyxy	Хүлэмжийн төсөл.doc	uploads/645a1aa0-ba95-4b75-a256-c6528b02b011.doc	application/msword	8632320	28	2026-05-22 12:49:38.608
cmpgx2rn8001l7sxsal87jl99	cmpgpyumu00tx7s2swj1osyxy	Хүлэмжийн шинэ төсөл.pdf	uploads/acd7beb8-d3b2-48eb-9960-1a3aa155eae2.pdf	application/pdf	1269600	29	2026-05-22 12:49:43.796
cmpgx2xa1001n7sxsink89jrx	cmpgpyumu00tx7s2swj1osyxy	Хүлэмжинд хүнсний ногоо тарих төсөл 19x.docx	uploads/2e01b800-b339-49d3-8468-25347a49eea3.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	289067	30	2026-05-22 12:49:51.097
cmpgx34pz001p7sxszeq5sigu	cmpgpyumu00tx7s2swj1osyxy	Хүлэмжний аж ахуй эрхлэх.pdf	uploads/85342cbc-8bce-46a7-af00-e682b7edaf56.pdf	application/pdf	133055	31	2026-05-22 12:50:00.743
cmpgx383q001r7sxsfemzt9j6	cmpgpyumu00tx7s2swj1osyxy	хүлэмжний аж ахуй 14х.docx	uploads/f3974f53-1b2f-47b9-ac54-8db27d4cff5e.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	47458	32	2026-05-22 12:50:05.126
cmpgx3dml001t7sxsigumu0i9	cmpgpyumu00tx7s2swj1osyxy	Өвлийн хүлэмж байгуулах төсөл.pdf	uploads/8656e75a-c5e9-4161-b1a8-ddd6d3577b42.pdf	application/pdf	371641	33	2026-05-22 12:50:12.286
cmpgx3id9001v7sxswo1ibgpa	cmpgpyumu00tx7s2swj1osyxy	Өвлийн хүлэмжийн төсөл.pdf	uploads/e26d2e73-17d3-49fd-8c8d-eb511989f7b8.pdf	application/pdf	371641	34	2026-05-22 12:50:18.43
cmpha128h00017s04n3pundcb	cmpgpyudz00pn7s2sscoogfdt	197. ЖДҮ-н төслийн жишиг загвар11х.pdf	uploads/ddd29a8a-b1b0-4f82-877b-9f19c4091e2f.pdf	application/pdf	115781	0	2026-05-22 18:52:19.217
cmpha1aw800037s04lioahakd	cmpgpyudz00pn7s2sscoogfdt	OCB JS систем дипломын ажил.pdf	uploads/4c18ad24-3a34-45c9-ab25-e7c8a6488417.pdf	application/pdf	903670	1	2026-05-22 18:52:30.441
cmpha1fhs00057s04mmxs3k7a	cmpgpyudz00pn7s2sscoogfdt	Бизнес төлөвлөгөө бичих.pdf	uploads/d0e282d9-5805-43e2-aa81-a5fe9c70d961.pdf	application/pdf	850392	2	2026-05-22 18:52:36.4
cmpha27vy00077s04zs5tsahm	cmpgpyumu00tx7s2swj1osyxy	197. ЖДҮ-н төслийн жишиг загвар11х.pdf	uploads/498c073a-251d-486c-ba52-68974b0de85e.pdf	application/pdf	115781	37	2026-05-22 18:53:13.198
cmpha2czh00097s04xqvy4sdj	cmpgpyumu00tx7s2swj1osyxy	OCB JS систем дипломын ажил.pdf	uploads/82a90173-edf3-4fb3-9f4b-a77f660b05e5.pdf	application/pdf	903670	38	2026-05-22 18:53:19.806
cmpha2hm7000b7s048ewlraxc	cmpgpyumu00tx7s2swj1osyxy	Бизнес төлөвлөгөө бичих.pdf	uploads/f3af83ba-6a9a-4718-ac0b-4d27971d9f80.pdf	application/pdf	850392	39	2026-05-22 18:53:25.807
\.


--
-- Data for Name: ProductImage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductImage" (id, "productId", "fileKey", alt, "sortOrder", "isPrimary", "videoUrl") FROM stdin;
cmpi213af00017s0wdqz02wwd	cmpgpysqm00097s2swx6mfkzp	uploads/6c1c9e33-4483-4098-a3c5-be9a87dabdef.jpg	МАЛ АЖ АХУЙ.jpg	0	t	\N
cmpi3b6e200037sd818jdd7ty	cmpgpyt6g00547s2szjwu8vjr	uploads/c3ea0958-70de-4559-bf07-3da7e3052705.jpg	ХҮНС БОЛОВСРУУЛАХ ҮЙЛДВЭР.jpg	0	t	\N
cmpi3s5dl00057sd8qtf8sclm	cmpgpytlx00ce7s2s7196iudd	uploads/05762ae7-86a1-410b-9f19-758766aa5c74.jpg	БАРИЛГА, ТАВИЛГА, АВТО.jpg	0	t	\N
cmpi43fce00017s0s4kv7avn9	cmpgpytu900gc7s2sabjusiwg	uploads/b7a109b1-3aea-4426-9790-16386fabaa3f.jpg	ОЁДОЛ, НЭХМЭЛ, ХУВЦАС.jpg	0	t	\N
cmpi483yc00037s0s6vfquku2	cmpgpytzb00if7s2ske45g8st	uploads/e305afe1-cc15-401a-b4b4-875ca710e43f.jpg	хоол, ХҮНС БОЛОВСРУУЛАХ ҮЙЛДВЭР (1).jpg	0	t	\N
cmpi4bocy00057s0sbui5d8fz	cmpgpytf9009m7s2seiktzgih	uploads/24139cc7-d39b-4214-93e5-aa73df204c92.jpg	хоол, ХҮНС БОЛОВСРУУЛАХ ҮЙЛДВЭР (2).jpg	0	t	\N
cmpi4g75f00017sa4re3pufdk	cmpgpyudz00pn7s2sscoogfdt	uploads/b64d31de-e889-4e6f-ba05-dc88cd8cb820.jpg	МАРКЕТИНГ, БОЛОВСРОЛ, ТЕХНОЛОГИ.jpg	0	t	\N
cmpi4q13x00017sl0ksf5z4y4	cmpgpyu7600ma7s2sfrxh0qyu	uploads/2bfd1be1-b35c-44dd-80e5-9ff5c4aae139.jpg	42 бэлэн бичсэн төсөл, Шууд татаж аваарай.jpg	0	t	\N
cmpi5m5b800017smcdx4i1o9l	cmpgpyumu00tx7s2swj1osyxy	uploads/ff04f403-aa9f-490c-9b3c-fbf04267dfb6.gif	Бүх салбарын нэгтгэсэн 300+ бэлэн төсөл.gif	0	t	\N
cmpijms9s00017s3wa16nuzse	cmpij23yk00027s04u7m67yoi	uploads/72e8412a-76cd-4528-9c71-e37542982b12.jpg	alban0.jpg	0	t	\N
cmpijmvgc00037s3wudn1c9ht	cmpij23yk00027s04u7m67yoi	uploads/742d9131-cb60-46b4-b0b3-bc9bef4e676e.jpg	alban1.jpg	1	f	\N
cmpijmy8600057s3ww2fun037	cmpij23yk00027s04u7m67yoi	uploads/a621ed94-03ac-4e99-824b-59b237926512.jpg	alban2.jpg	2	f	\N
\.


--
-- Data for Name: ProductTestimonial; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductTestimonial" ("productId", "testimonialId") FROM stdin;
cmpgpyumu00tx7s2swj1osyxy	cmpgpywa701hb7s2s6ly2ww4b
cmpgpyumu00tx7s2swj1osyxy	cmpgpyw9y01ha7s2sup0mos4d
cmpgpyumu00tx7s2swj1osyxy	cmpgpyw9p01h97s2sbguiljz6
cmpgpytlx00ce7s2s7196iudd	cmpgpyw5o01gu7s2s8x863160
cmpgpytlx00ce7s2s7196iudd	cmpgpyw5x01gv7s2s4me2joow
cmpgpytlx00ce7s2s7196iudd	cmpgpyw6601gw7s2s6lvsswc1
cmpgpytf9009m7s2seiktzgih	cmpgpyw4t01gr7s2sqq3431b0
cmpgpytf9009m7s2seiktzgih	cmpgpyw5301gs7s2simu6kya5
cmpgpytf9009m7s2seiktzgih	cmpgpyw5e01gt7s2sweeggbnw
cmpij23yk00027s04u7m67yoi	cmpij25ae004n7s04i8paga3m
cmpij23yk00027s04u7m67yoi	cmpij25a6004m7s0404z4v32h
cmpij23yk00027s04u7m67yoi	cmpij259c004l7s04jk1cy2ow
cmpgpysqm00097s2swx6mfkzp	cmpgpyw2h01gl7s2svaamoi16
cmpgpysqm00097s2swx6mfkzp	cmpgpyw3n01gm7s2sxugtrhbx
cmpgpysqm00097s2swx6mfkzp	cmpgpyw3t01gn7s2soh624m86
cmpgpyt6g00547s2szjwu8vjr	cmpgpyw4101go7s2syjr3lde3
cmpgpyt6g00547s2szjwu8vjr	cmpgpyw4901gp7s2saq5xjd41
cmpgpyt6g00547s2szjwu8vjr	cmpgpyw4i01gq7s2sd3siwfh7
cmpgpytu900gc7s2sabjusiwg	cmpgpyw6f01gx7s2svsij3n1t
cmpgpytu900gc7s2sabjusiwg	cmpgpyw6n01gy7s2s9900d3fq
cmpgpytu900gc7s2sabjusiwg	cmpgpyw6x01gz7s2svoahuzsm
cmpgpyudz00pn7s2sscoogfdt	cmpgpyw8w01h67s2sr80k83pe
cmpgpyudz00pn7s2sscoogfdt	cmpgpyw9501h77s2snwm0j4bs
cmpgpyudz00pn7s2sscoogfdt	cmpgpyw9f01h87s2si72zqnoa
\.


--
-- Data for Name: ProductTypeConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductTypeConfig" (id, value, label, description, icon, "sortOrder", active, "createdAt", "updatedAt") FROM stdin;
ptc_vid	VIDEO	Видео	Видео хичээл болон контент	play	3	t	2026-05-21 15:24:19.869	2026-05-22 09:07:17.274
ptc_hybrid	HYBRID	Хосолсон	Файл болон хичээлийн хосолсон багц	layers	6	t	2026-05-21 15:24:19.869	2026-05-22 09:07:39.944
ptc_file	FILE	Файл	Татаж авах боломжтой файлууд	file	1	t	2026-05-21 15:24:19.869	2026-05-22 09:30:31.192
ptc_tmpl	TEMPLATE	Загвар	PowerPoint, Word, Canva загварууд	layout	2	t	2026-05-21 15:24:19.869	2026-05-22 09:30:31.258
ptc_doc	DOCUMENT	Баримт	Гэрээ, тайлан, акт, баримт бичиг	file-text	3	t	2026-05-21 15:24:19.869	2026-05-22 09:30:31.263
ptc_bundle	BUNDLE	Багц	Олон файлын нэгдсэн цуглуулга	package	4	t	2026-05-21 15:24:19.869	2026-05-22 09:30:31.268
ptc_lesson	LESSON	Хичээл	Видео хичээл, онлайн сургалт	book-open	5	t	2026-05-21 15:24:19.869	2026-05-22 09:30:31.273
cmpfrymag00067s48c8n6yuy3	COURSE	Курс	Бүрэн курс, видео цуврал	graduation-cap	6	t	2026-05-21 17:38:45.977	2026-05-22 09:30:31.278
cmpfrymam00077s48yla67h02	OTHER	Бусад	Бусад дижитал бүтээгдэхүүн	box	7	t	2026-05-21 17:38:45.983	2026-05-22 09:30:31.282
cmpgrrl3i00007sfkhqwzrscm	TUSUL	Төсөл	Бүх  төрлийн төслүүдийг салбараар эсвэл багцлаад хямдралтай үнээр аваарай	newspaper	0	t	2026-05-22 10:21:04.013	2026-05-22 10:54:52.531
\.


--
-- Data for Name: Review; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Review" (id, "userId", "productId", rating, comment, "createdAt") FROM stdin;
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Session" (id, "sessionToken", "userId", expires) FROM stdin;
\.


--
-- Data for Name: SiteSetting; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SiteSetting" (id, "siteName", "siteUrl", "supportEmail", "updatedAt", "logoUrl", "canonicalUrl", "fbPixelId", "googleAnalyticsId", "googleSiteVerification", "googleTagManagerId", "metaDescription", "metaKeywords", "metaTitle", "naverSiteVerification", "ogDescription", "ogImageUrl", "ogTitle", "robotsNoFollow", "robotsNoIndex", "sitemapChangeFreq", "sitemapEnabled", "sitemapPriority", "twitterCardType") FROM stdin;
default	Digital Ger	https://digitalger.mn	info@digitalger.mn	2026-05-19 06:39:11.95	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/uploads/c79227d3-271f-41e2-bb17-687b276bff1d.png	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	f	weekly	t	0.8	summary_large_image
\.


--
-- Data for Name: Testimonial; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Testimonial" (id, name, avatar, role, content, rating, featured, active, "sortOrder", "createdAt", "updatedAt") FROM stdin;
cmpij259c004l7s04jk1cy2ow	Б. Оюунтуяа	\N	ХХК үүсгэн байгуулагч	Хуульчид 200,000 төгрөгийн гэрээ бичүүлдэг байсан. Энэ багцаас авсан гэрээний загварыг 10 минутад тохируулж шууд ашигласан. Мөнгө, цаг хоёулаа хэмнэлээ.	5	t	t	0	2026-05-23 15:52:52.513	2026-05-23 16:12:50
cmpij25a6004m7s0404z4v32h	Д. Батбаяр	\N	Жижиг бизнес эрхлэгч	Excel цалин тооцоолуур гайхалтай. НДШХ, ХХОАТ-ыг гараар тооцдог байсан — одоо тоо оруулчихад л автоматаар гарчихдаг болсон. Нягтлангаасаа асуух хэрэггүй болсон.	5	t	t	0	2026-05-23 15:52:52.542	2026-05-23 16:12:54.282
cmpij25ae004n7s04i8paga3m	Г. Мөнхзаяа	\N	Стартапын захирал	70 файл байгаа ч эмх замбараагүй биш — 8 хавтаст ангилагдсан, шуудхан хэрэгтэй файлаа олдог. CRM, OKR, Gantt chart — гурвыг нь байнга ашиглаж байна. 49,000₮-д маш үнэ цэнтэй.	5	t	t	0	2026-05-23 15:52:52.55	2026-05-23 16:12:56.455
cmpgpywa701hb7s2s6ly2ww4b	Э.Цэнд	\N	ЖДҮ зөвлөх, Дархан	Олон үйлчлүүлэгчийнхээ зээлийн материалыг PLATINUM загваруудаар бэлтгэдэг болсон. Цаг хэмнэлт асар их болсон.	5	t	t	0	2026-05-22 09:30:45.872	2026-05-23 16:13:01.105
cmpgpyw8g01h57s2ssplbdxs0	Г.Алтансүрэн	\N	Гоо сайхны салоны эзэн, Улаанбаатар	Маникурын салоны загварыг авч засварлаад ЖДҮ санд өгсөн. 10 саяын зээл авлаа.	5	t	t	0	2026-05-22 09:30:45.808	2026-05-22 09:30:45.808
cmpgpyw8w01h67s2sr80k83pe	Э.Билгүүн	\N	Маркетингийн мэргэжилтэн, Улаанбаатар	Маркетингийн судалгааны загвар авч хэрэглэсэн. SWOT болон зах зээлийн шинжилгээ бэлэн байсан нь тайланг хурдан дуусгасан.	5	t	t	0	2026-05-22 09:30:45.825	2026-05-22 09:30:45.825
cmpgpyw9501h77s2snwm0j4bs	Р.Мөнхтуяа	\N	Санхүүгийн мэргэжилтэн, Улаанбаатар	Санхүүгийн шинжилгээний загвар авсан. Баланс шинжилгээний загвар маш дэлгэрэнгүй бэлтгэгдсэн байлаа.	5	t	t	0	2026-05-22 09:30:45.834	2026-05-22 09:30:45.834
cmpgpyw9f01h87s2si72zqnoa	Б.Зоригтбаатар	\N	IT компанийн захирал, Улаанбаатар	Компьютерийн үйлчилгээний төвийн загварыг авч банкинд өгсөн. IT бизнесийн загвар олох хэцүү байсан — DigitalGer-д байсан нь гайхамшиг байлаа.	5	t	t	0	2026-05-22 09:30:45.843	2026-05-22 09:30:45.843
cmpgpyw9p01h97s2sbguiljz6	О.Мөнхзул	\N	Олон салбарт бизнес эзэн, Улаанбаатар	PLATINUM авсан нь хамгийн зөв шийдвэр байсан. Мал аж ахуй болон маркетингийн загваруудыг хоёуланг нь ашигласан — 2 банкны зээлийг нэг дор бэлтгэж чадсан.	5	t	t	0	2026-05-22 09:30:45.853	2026-05-22 09:30:45.853
cmpgpyw9y01ha7s2sup0mos4d	Ч.Батзориг	\N	Хөрөнгө оруулагч, Улаанбаатар	Хэд хэдэн бизнесийн санал бэлтгэхэд PLATINUM маш их тус болсон. Тус тусад нь авбал 5 дахин үнэтэй болох байсан.	5	t	t	0	2026-05-22 09:30:45.863	2026-05-22 09:30:45.863
cmpgpyw2h01gl7s2svaamoi16	Б.Ганбаатар	\N	Сүүний фермерийн эзэн, Өвөрхангай	Сүүний үнээний 3 загварыг харьцуулан хамгийн тохирохыг сонгосон. Банкинд өгснөөс хойш 12 хоногт 80 сая зөвшөөрөл авлаа. Мэргэжилтэн ажиллуулах хэрэггүй болсон.	5	t	t	0	2026-05-22 09:30:45.593	2026-05-22 09:30:45.593
cmpgpyw3n01gm7s2sxugtrhbx	Э.Нямжав	\N	Тахианы аж ахуй, Төв аймаг	Тахианы аж ахуйн 12 загварын хоёрыг ашиглан хөрөнгө оруулагч татсан. Санхүүгийн тооцооны хэсэг маш нарийн бэлтгэгдсэн байсан.	5	t	t	0	2026-05-22 09:30:45.635	2026-05-22 09:30:45.635
cmpgpyw3t01gn7s2soh624m86	С.Цогбадрах	\N	Ноолуурын үйлдвэрийн эзэн, Архангай	Ноолуур кашмерийн үйлдвэрийн өргөтгөлийн загварыг авсан. 86 хуудасны дэлгэрэнгүй файл — банк мэргэжилтэн шиг бэлтгэгдсэн гэж хэлсэн.	5	t	t	0	2026-05-22 09:30:45.642	2026-05-22 09:30:45.642
cmpgpyw4101go7s2syjr3lde3	Н.Оюунцэцэг	\N	Хүлэмжийн аж ахуйн эзэн, Сэлэнгэ	Дөрвөн улирлын хүлэмжийн загварыг авсан чинь бүх нарийн ширийн зүйл бэлэн байсан. 3 хоногт засварлаж банкинд өгч 15 сая авлаа.	5	t	t	0	2026-05-22 09:30:45.65	2026-05-22 09:30:45.65
cmpgpyw4901gp7s2saq5xjd41	Ж.Дорж	\N	Чацарганы тариалан, Булган	Чацарганы зах зээлийн судалгааны файл маш их тус болсон. Хөрөнгө оруулагчдад яагаад ашигтай болохыг тайлбарлахад хэрэглэсэн.	5	t	t	0	2026-05-22 09:30:45.658	2026-05-22 09:30:45.658
cmpgpyw4i01gq7s2sd3siwfh7	Т.Энхтуул	\N	Мод үржүүлгийн газрын эзэн, Хэнтий	Мод үржүүлгийн 3 загварыг харьцуулан ойжуулалтын төслийг сонгосон. Байгаль хамгааллын сантай хамтран ажиллах хэлэлцээрт ч ашигласан.	4	t	t	0	2026-05-22 09:30:45.667	2026-05-22 09:30:45.667
cmpgpyw4t01gr7s2sqq3431b0	Д.Дөлгөөн	\N	Кофе шопны эзэн, Улаанбаатар	Кофе шопны бизнес төлөвлөгөө авсан чинь санхүүгийн хэсгийг ойлгоход маш хялбар болсон. Банкны зээл 14 хоногт шийдэгдлээ.	5	t	t	0	2026-05-22 09:30:45.677	2026-05-22 09:30:45.677
cmpgpyw5301gs7s2simu6kya5	М.Цэрэнчимэд	\N	Талх нарийн боовны үйлдвэрийн эзэн	Талх, нарийн боовны үйлдвэрийн загварыг авч засварлаад ЖДҮ санд өгсөн. 20 саяын зээл амжилттай авсан.	5	t	t	0	2026-05-22 09:30:45.688	2026-05-22 09:30:45.688
cmpgpyw5e01gt7s2sweeggbnw	Г.Сарнай	\N	Зоогийн газрын эзэн, Эрдэнэт	Зоогийн газрын загварыг авч хэрэглэлээ. Хоёр долоо хоногийн дотор банкны зөвшөөрөл ирлээ.	5	t	t	0	2026-05-22 09:30:45.699	2026-05-22 09:30:45.699
cmpgpyw5o01gu7s2s8x863160	Г.Мөнхбаяр	\N	Барилгын материалын үйлдвэр, Дархан	Блокны үйлдвэрийн загварыг авч 4 хоногт засварлаад 25 сая зээл авлаа. Мэргэжилтэн ажиллуулах мөнгийг хэмнэсэн.	5	t	t	0	2026-05-22 09:30:45.708	2026-05-22 09:30:45.708
cmpgpyw5x01gv7s2s4me2joow	Л.Батчулуун	\N	Тавилгын үйлдвэрийн эзэн, Улаанбаатар	Тавилгын үйлдвэрийн 52 хуудасны загварыг авсан. Санхүүгийн тооцоо, орлогын таамаглал маш нарийн байсан.	5	t	t	0	2026-05-22 09:30:45.718	2026-05-22 09:30:45.718
cmpgpyw6601gw7s2s6lvsswc1	Д.Мөнхзул	\N	Авто сервисийн эзэн, Орхон	Авто угаалга болон авто сервисийн загварыг авч засварлаад банкинд өгсөн. Санхүүгийн урсгалын хэсэг бэлэн байсан нь хамгийн их тус болсон.	4	t	t	0	2026-05-22 09:30:45.726	2026-05-22 09:30:45.726
cmpgpyw6f01gx7s2svsij3n1t	Х.Цэцэгмаа	\N	Оёдлын цехийн эзэн, Улаанбаатар	Оёдлын цехийг тэлэхийн тулд DigitalGer-ийн загвар авсан. Өргөтгөлийн санхүүгийн тооцоог хэрхэн бичих нь тодорхой болсон.	5	t	t	0	2026-05-22 09:30:45.736	2026-05-22 09:30:45.736
cmpgpyw6n01gy7s2s9900d3fq	Б.Номин	\N	Нэхмэл эдлэлийн бизнес, Сүхбаатар	ОЙМСНЫ ҮЙЛДВЭР 67 хуудасны загвар авсан чинь бизнесийн бүх хэсгийг хамарсан дэлгэрэнгүй файл байлаа. Зээл амжилттай авлаа.	5	t	t	0	2026-05-22 09:30:45.744	2026-05-22 09:30:45.744
cmpgpyw6x01gz7s2svoahuzsm	О.Энхтүвшин	\N	Монгол дээлийн бизнес, Улаанбаатар	Монгол дээл хувцас үйлдвэрлэлийн загвар авч хэрэглэлээ. Загвар нарийн бэлтгэгдсэн байсан тул ажиллуулахад маш хялбар болсон.	5	t	t	0	2026-05-22 09:30:45.753	2026-05-22 09:30:45.753
cmpgpyw7501h07s2s9r5buy3v	Б.Эрдэнэтуяа	\N	Хөнгөн үйлдвэрийн эзэн, Эрдэнэт	Цаасан уутны 3 загварыг харьцуулан хамгийн тохирохыг сонгосон. Санхүүгийн тооцооны хэсэг бэлэн байсан нь маш их хэмнэлт болсон.	5	t	t	0	2026-05-22 09:30:45.762	2026-05-22 09:30:45.762
cmpgpyw7f01h17s2smcng4mec	Д.Ганчимэг	\N	Сүүний үйлдвэрийн эзэн, Дархан	Хуурай сүүний үйлдвэрийн загварыг авч банкинд өгсөн. 45 сая зээл авлаа.	5	t	t	0	2026-05-22 09:30:45.771	2026-05-22 09:30:45.771
cmpgpyw7o01h27s2syq4p4307	Т.Нарантуяа	\N	Цэвэр усны үйлдвэрийн эзэн, Хөвсгөл	Хөвсгөлийн цэвэр ус төслийн загварыг авч хэрэглэсэн. Орон нутгийн онцлогт тохируулах нь хялбар байсан.	4	t	t	0	2026-05-22 09:30:45.78	2026-05-22 09:30:45.78
cmpgpyw7y01h37s2sl7s2ljkc	Д.Баярхүү	\N	Аялал жуулчлалын компани, Хэнтий	Аялалын загварыг авч хэрэглэсэн. Жуулчны бааз байгуулах зориулалттай загвар тохирсон — зээл амжилттай авсан.	5	t	t	0	2026-05-22 09:30:45.79	2026-05-22 09:30:45.79
cmpgpyw8701h47s2sakg3rzqh	А.Сарантуяа	\N	Фитнесс клубын эзэн, Улаанбаатар	Фитнесс клубын 32 хуудасны загварыг авсан. Санхүүгийн тооцоо, ажилчдын зардал бэлэн байсан нь хамгийн их тус болсон.	5	t	t	0	2026-05-22 09:30:45.8	2026-05-22 09:30:45.8
\.


--
-- Data for Name: ThemeSetting; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ThemeSetting" (id, "primaryColor", "secondaryColor", "accentColor", "layoutMode", "updatedAt", "defaultTheme") FROM stdin;
default	221 83% 53%	210 40% 96%	262 83% 58%	light	2026-05-22 15:56:22.699	system
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, name, "passwordHash", image, role, "emailVerified", "oauthProvider", "oauthId", "refreshToken", "createdAt", "updatedAt", "isGuest", phone) FROM stdin;
cmpb6tahi00017sp4hxu4tvlz	ambuk_2006@yahoo.com	Ambuk MN	$2b$12$imMl2MMzl.wk8OHz08Wd/OLqzaqXXbKT2EzwsduKBVMaSYjnieiJy	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/avatars/af0e88d4-2db9-4b12-90bc-bb017f7c76d7.png	USER	2026-05-22 17:26:10.734	\N	\N	$2b$12$vvr4PmtftvNvQtJcv8YRseWZY9ciWsYy9t1M5WifMXp2SSRXX5LN.	2026-05-18 12:35:40.758	2026-05-22 19:48:25.895	f	90116635
cmpaxc3it00077so4cw3lv8yr	guest_ikzx7dmy@guest.digitalger.mn	Зочин	$2b$12$bwkh8q7H8ovGy9tzgM.siubhaL/nOEczmNsaeXc0MlK70mHXrtNvO	\N	USER	\N	\N	\N	$2b$12$W4H8USvJU9SIMs5EuOLa9eX2E3SK7.MbwiM2q015Y7RkkNeoAkAni	2026-05-18 08:10:22.037	2026-05-18 08:10:22.983	f	\N
cmpaxo51y00007s0sbdf2x7w7	guest_gd9plgrn@guest.digitalger.mn	Зочин	$2b$12$e4xLSVsGY2PxzhWzVd7.qOWYtFse4WqNClLVoGKH/zuFTroXnPGLO	\N	USER	\N	\N	\N	$2b$12$t2THPzdcTjM5oiqU.29vWeADYaT29JIEUvBs01BeXUzzS3e2.q3d.	2026-05-18 08:19:43.875	2026-05-18 08:19:44.861	f	\N
cmpb4gkq000007stk4guxjrxt	guest_d6lpsye7@guest.digitalger.mn	Зочин	$2b$12$nt65pJ/.B3MllASgQ/YegO6UAPgQ/WzKjJ1b6hwg.QEiNi77u6Z/G	\N	USER	\N	\N	\N	$2b$12$gm7o6nzjx/MBddhNLB88b.toXa7Rbt83dN0h76HdM8a.33MQYKL7S	2026-05-18 11:29:48.264	2026-05-18 11:32:47.619	t	\N
cmpa1fbnl00007s5kdzhd85a9	guest_mfj07v00@guest.digitalger.mn	Зочин	$2b$12$Jsz0XHw7hNZFwWVcrUlnfu5BDhiViCe8sS9mOJqf6CqqUDkim3Bfu	\N	USER	\N	\N	\N	$2b$12$TaHPcKsfOWlZtfQOJh9K7OtKPtI3QQfptjgrkRBjpmZ9RORl9XGwC	2026-05-17 17:17:04.832	2026-05-17 17:17:05.897	f	\N
cmpbb9yl800007seco3fxoylb	amgalanbayar1984@gmail.com	Amgalanbayar G	\N	https://lh3.googleusercontent.com/a/ACg8ocK0colQeEG-PUT0D9HNAUskjxaTkLR5O26Xfj8b6wdeI9dJaws=s96-c	USER	2026-05-18 14:40:36.954	google	106130992204922006760	$2b$12$02fLeuXNOfsjxM/LSsEhVOTYW9A7DMahDCkjOdbB0WurDAhSKAEri	2026-05-18 14:40:36.955	2026-05-19 08:53:01.829	f	\N
cmpaztvck00007sv4bsmbqteo	test@gmail.com	Test User	\N	\N	USER	2026-05-18 09:20:10.482	google	test123	$2b$12$c5qg.CDDrznnuhX.Vnia0O0HiY0Og36s875l/Wj/8Be6cBK6.Z8eG	2026-05-18 09:20:10.483	2026-05-18 09:20:14.472	f	\N
cmpb6s8c400007sp4cqbkhmzq	info@digitalger1.mn	Зочин	$2b$12$iux5AF0eK.JPOJGszLmkc.EmmUgBJ9ox3eMGWRsadzGsCjEuJlcQG	\N	USER	2026-05-18 12:35:33.178	\N	\N	$2b$12$PopnBrGTahwDMD8uIvO//.P4hOCQvxJTRL5xRr5H0dtYOvXs4mYmy	2026-05-18 12:34:51.315	2026-05-18 12:35:33.18	f	90116632
cmpb01dtu00037sv4c5in8m35	guest_263b6mu3@guest.digitalger.mn	Зочин	$2b$12$m.waYGEyKrzBs4yR/.3cJurqUY8zHKzNcyDFB1EGT6eDVOhQKVJ8G	\N	USER	\N	\N	\N	$2b$12$MgXA1VzuFagUmwKYjkpcsupeZX82kziTi5lvj3kwxrOsDkvOIKmgm	2026-05-18 09:26:01.025	2026-05-18 09:26:42.652	t	90116633
cmpb02g0s00047sv4fhu11vxq	guest_fz1i00w8@guest.digitalger.mn	Зочин	$2b$12$fmuwhHBY9oNk9LuyZg1eOu7wWVUyQKHC47WGCr/sk3lSfbUaOAsW6	\N	USER	\N	\N	\N	$2b$12$9.gNG.W6t2L9184jpP/zh.7A/twYoKFr1XfPkDyXCelASD.vY1BnW	2026-05-18 09:26:50.524	2026-05-18 11:29:31.531	t	90116634
cmp9nt7j800007s5wr36po3s2	admin@digitalger.mn	Admin	$2b$12$3FFHe1UiLzwgIcixk4TpAOEMWat.mlzHqu/pjDaltzIwE7u53/WSG	https://pub-56e173698658449685aec1a3fc320b5a.r2.dev/avatars/c106bd48-c644-495e-a2df-2f418b4310d3.jpg	ADMIN	2026-05-17 10:55:57.992	\N	\N	$2b$12$lzhfmCZzwTOPsG3kLZl2iu6AYO85P5/QKvBm/l.AMQLAGV42v8s0e	2026-05-17 10:55:58.049	2026-05-22 19:45:55.539	f	\N
\.


--
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VerificationToken" (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: Wishlist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Wishlist" (id, "userId", "productId", "createdAt") FROM stdin;
cmphb688n00017sz8ole5zqk2	cmpb6tahi00017sp4hxu4tvlz	cmpgpytzb00if7s2ske45g8st	2026-05-22 19:24:19.895
cmphb6bbp00037sz896kyo74z	cmpb6tahi00017sp4hxu4tvlz	cmpgpytlx00ce7s2s7196iudd	2026-05-22 19:24:23.893
\.


--
-- Data for Name: ZipJob; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ZipJob" (id, "userId", status, "zipKey", error, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
6bf5caa2-4f17-4c87-81c0-1bc4a7460fbc	a29f50498cc8e0c06e39b143d1a03fcda1490092b423d36f6133dda35f1acbfb	2026-05-17 10:55:30.21857+00	20260517105529_init	\N	\N	2026-05-17 10:55:29.908085+00	1
47491d90-ea73-4ffc-a0a9-1d04ff0c6cb8	0fca009259a111ee5d5be22e56192d202576e21946338cae239f478e4aa2eae3	2026-05-21 15:24:20.547928+00	20260522000000_add_product_type_config	\N	\N	2026-05-21 15:24:19.818611+00	1
41a78e11-8ae0-454f-bc5c-767282205549	b932d70f3d888b46548e470c958c5796ad95ffb0c1b4f2190fce0b116a3621b1	2026-05-17 12:01:11.675614+00	20260517120111_make_product_category_optional	\N	\N	2026-05-17 12:01:11.647109+00	1
589b9ec9-ed8a-4bf0-8886-5fc18fba1ddb	e9e66aa3e7562a348881471ef1f8a415a145f0d0c8268dd89743c300089d9819	2026-05-23 12:57:17.768869+00	20260523100000_add_seo_fields_to_site_setting		\N	2026-05-23 12:57:17.768869+00	0
93bcf31d-00a4-49f2-81c4-b2ea17087e5b	6eaf3fcc1738566577fcc987122874cd7c5705cad0a175b830a47a4187048d14	2026-05-17 12:32:41.320287+00	20260517123241_add_logo_url_to_site_setting	\N	\N	2026-05-17 12:32:41.304163+00	1
14aaff61-1ad3-48c3-8de6-8e3c970c2269	3f17bf2cc8594cd0090c83a8f5029413e2fcf370a64d20599c8c1520c36270b4	2026-05-17 14:00:21.937964+00	20260517140021_add_banners_faqs_menu_product_fields	\N	\N	2026-05-17 14:00:21.830341+00	1
2f851253-260f-4346-8a8a-690529b5bf66	64b6c6a2fc4b2b9b60727a10c7c9dbf7e14be0569181a3a1882809907e54bcd4	2026-05-17 16:35:06.010834+00	20260517163505_standalone_faq_testimonials_bundles_compare_price	\N	\N	2026-05-17 16:35:05.87112+00	1
c44e184f-a91e-4eef-9378-54be03ba966b	58ad1d051cecf0bde2f2102f499c37ec1719e7ea2cbe97fe79fd7cb5669510a6	2026-05-18 05:36:31.638551+00	20260518053631_add_blog_pages_howtousesteps	\N	\N	2026-05-18 05:36:31.515395+00	1
5d7f91fa-d172-43be-a6c4-49a5fb042082	f0b71e09e2516f26673a2766579bbad7905f81887d7430a447fa7709c3f397fa	2026-05-18 06:30:34.321954+00	20260518063034_add_video_url_to_product	\N	\N	2026-05-18 06:30:34.305188+00	1
64e9c1e4-586d-446b-b969-1e5b78fb797a	f0e273955b3ee6f473c3a2e8d46c6aa18421dce6c021ba042168c87695fc044c	2026-05-18 06:41:38.294275+00	20260518064138_add_social_proof_gallery	\N	\N	2026-05-18 06:41:38.274397+00	1
24ce47f9-f055-4407-b99a-15b9aaa050d9	c19d8ca7493ec988443e539a5d2ef67f66d7d5369f43186137e411238e4c3da3	2026-05-19 19:47:40.379077+00	20260520000000_add_course_modules_coupons_phone_guest		\N	2026-05-19 19:47:40.379077+00	0
2e2c819b-d7fc-46e5-8c57-bfd215aadee7	471d1b8b6f3327a59a12a2857e53dde40f599264b8df390b397674e32dad5810	2026-05-21 11:58:05.698645+00	20260521000000_add_bundle_product_type	\N	\N	2026-05-21 11:58:05.588433+00	1
b0787dde-8714-40be-bf25-d1db1c67519e	b8640729d2a8a855984d0f66b1435398e9c27bfae876b57ddab2a51562704ba3	2026-05-21 11:59:02.274287+00	20260521100000_add_category_ids_to_product	\N	\N	2026-05-21 11:59:02.255425+00	1
a2318523-8625-4ccc-ac1d-3e46eb0fc3d1	2d636bf72fed2cba404af64e7dc912ed9eaaaa0114e21b6060ea4570040478dc	2026-05-21 13:38:14.789109+00	20260521200000_add_fileids_to_bundle_item	\N	\N	2026-05-21 13:38:14.457357+00	1
a3c2bc63-3ee7-4eae-9316-9a8e60c71105	c2e6f2dcd72782ffc91d9fa27dd686eac55a57561bb3bc11bd568159a0e78e0e	2026-05-21 14:10:01.255812+00	20260521300000_add_label_to_bundle_item	\N	\N	2026-05-21 14:10:01.146876+00	1
\.


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Banner Banner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Banner"
    ADD CONSTRAINT "Banner_pkey" PRIMARY KEY (id);


--
-- Name: BlogPost BlogPost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BlogPost"
    ADD CONSTRAINT "BlogPost_pkey" PRIMARY KEY (id);


--
-- Name: BundleItem BundleItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BundleItem"
    ADD CONSTRAINT "BundleItem_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: Coupon Coupon_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Coupon"
    ADD CONSTRAINT "Coupon_pkey" PRIMARY KEY (id);


--
-- Name: CourseModule CourseModule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseModule"
    ADD CONSTRAINT "CourseModule_pkey" PRIMARY KEY (id);


--
-- Name: Course Course_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_pkey" PRIMARY KEY (id);


--
-- Name: Download Download_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Download"
    ADD CONSTRAINT "Download_pkey" PRIMARY KEY (id);


--
-- Name: FAQ FAQ_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FAQ"
    ADD CONSTRAINT "FAQ_pkey" PRIMARY KEY (id);


--
-- Name: Lesson Lesson_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lesson"
    ADD CONSTRAINT "Lesson_pkey" PRIMARY KEY (id);


--
-- Name: MenuItem MenuItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MenuItem"
    ADD CONSTRAINT "MenuItem_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Page Page_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Page"
    ADD CONSTRAINT "Page_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: ProductBundle ProductBundle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductBundle"
    ADD CONSTRAINT "ProductBundle_pkey" PRIMARY KEY (id);


--
-- Name: ProductFAQ ProductFAQ_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductFAQ"
    ADD CONSTRAINT "ProductFAQ_pkey" PRIMARY KEY ("productId", "faqId");


--
-- Name: ProductFile ProductFile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductFile"
    ADD CONSTRAINT "ProductFile_pkey" PRIMARY KEY (id);


--
-- Name: ProductImage ProductImage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductImage"
    ADD CONSTRAINT "ProductImage_pkey" PRIMARY KEY (id);


--
-- Name: ProductTestimonial ProductTestimonial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductTestimonial"
    ADD CONSTRAINT "ProductTestimonial_pkey" PRIMARY KEY ("productId", "testimonialId");


--
-- Name: ProductTypeConfig ProductTypeConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductTypeConfig"
    ADD CONSTRAINT "ProductTypeConfig_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: Review Review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: SiteSetting SiteSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SiteSetting"
    ADD CONSTRAINT "SiteSetting_pkey" PRIMARY KEY (id);


--
-- Name: Testimonial Testimonial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Testimonial"
    ADD CONSTRAINT "Testimonial_pkey" PRIMARY KEY (id);


--
-- Name: ThemeSetting ThemeSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ThemeSetting"
    ADD CONSTRAINT "ThemeSetting_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Wishlist Wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_pkey" PRIMARY KEY (id);


--
-- Name: ZipJob ZipJob_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ZipJob"
    ADD CONSTRAINT "ZipJob_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: Banner_active_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Banner_active_sortOrder_idx" ON public."Banner" USING btree (active, "sortOrder");


--
-- Name: BlogPost_published_publishedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BlogPost_published_publishedAt_idx" ON public."BlogPost" USING btree (published, "publishedAt");


--
-- Name: BlogPost_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BlogPost_slug_key" ON public."BlogPost" USING btree (slug);


--
-- Name: BundleItem_bundleId_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BundleItem_bundleId_sortOrder_idx" ON public."BundleItem" USING btree ("bundleId", "sortOrder");


--
-- Name: Category_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Category_slug_key" ON public."Category" USING btree (slug);


--
-- Name: Coupon_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Coupon_code_key" ON public."Coupon" USING btree (code);


--
-- Name: Course_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Course_productId_key" ON public."Course" USING btree ("productId");


--
-- Name: Download_fileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Download_fileId_idx" ON public."Download" USING btree ("fileId");


--
-- Name: Download_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Download_userId_createdAt_idx" ON public."Download" USING btree ("userId", "createdAt");


--
-- Name: FAQ_active_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FAQ_active_sortOrder_idx" ON public."FAQ" USING btree (active, "sortOrder");


--
-- Name: MenuItem_active_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MenuItem_active_sortOrder_idx" ON public."MenuItem" USING btree (active, "sortOrder");


--
-- Name: OrderItem_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderItem_productId_idx" ON public."OrderItem" USING btree ("productId");


--
-- Name: Order_qpayIdentifier_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Order_qpayIdentifier_key" ON public."Order" USING btree ("qpayIdentifier");


--
-- Name: Order_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_status_createdAt_idx" ON public."Order" USING btree (status, "createdAt");


--
-- Name: Order_userId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_userId_status_createdAt_idx" ON public."Order" USING btree ("userId", status, "createdAt");


--
-- Name: Page_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Page_slug_key" ON public."Page" USING btree (slug);


--
-- Name: ProductBundle_productId_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductBundle_productId_sortOrder_idx" ON public."ProductBundle" USING btree ("productId", "sortOrder");


--
-- Name: ProductTypeConfig_active_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductTypeConfig_active_sortOrder_idx" ON public."ProductTypeConfig" USING btree (active, "sortOrder");


--
-- Name: ProductTypeConfig_value_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProductTypeConfig_value_key" ON public."ProductTypeConfig" USING btree (value);


--
-- Name: Product_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_slug_key" ON public."Product" USING btree (slug);


--
-- Name: Review_userId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Review_userId_productId_key" ON public."Review" USING btree ("userId", "productId");


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: Testimonial_active_featured_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Testimonial_active_featured_sortOrder_idx" ON public."Testimonial" USING btree (active, featured, "sortOrder");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: Wishlist_userId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON public."Wishlist" USING btree ("userId", "productId");


--
-- Name: ZipJob_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ZipJob_status_createdAt_idx" ON public."ZipJob" USING btree (status, "createdAt");


--
-- Name: ZipJob_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ZipJob_userId_createdAt_idx" ON public."ZipJob" USING btree ("userId", "createdAt");


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BundleItem BundleItem_bundleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BundleItem"
    ADD CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES public."ProductBundle"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseModule CourseModule_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseModule"
    ADD CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Course Course_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Download Download_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Download"
    ADD CONSTRAINT "Download_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Lesson Lesson_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lesson"
    ADD CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Lesson Lesson_moduleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lesson"
    ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES public."CourseModule"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Payment Payment_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductBundle ProductBundle_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductBundle"
    ADD CONSTRAINT "ProductBundle_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductFAQ ProductFAQ_faqId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductFAQ"
    ADD CONSTRAINT "ProductFAQ_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES public."FAQ"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductFAQ ProductFAQ_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductFAQ"
    ADD CONSTRAINT "ProductFAQ_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductFile ProductFile_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductFile"
    ADD CONSTRAINT "ProductFile_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductImage ProductImage_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductImage"
    ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductTestimonial ProductTestimonial_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductTestimonial"
    ADD CONSTRAINT "ProductTestimonial_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductTestimonial ProductTestimonial_testimonialId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductTestimonial"
    ADD CONSTRAINT "ProductTestimonial_testimonialId_fkey" FOREIGN KEY ("testimonialId") REFERENCES public."Testimonial"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Product Product_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Review Review_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Review Review_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Wishlist Wishlist_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Wishlist Wishlist_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict DhMGITtEr61E3GHcpnJTfyx5t7o8eGpYB30E2hgcoqn88KphxyB1mEL0oP422So

