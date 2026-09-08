# Сайтын тусгаарлалтын тест

BestTV + BestFilm нэг backend дээр ажиллах үед өгөгдөл ХОЛИЛДОХГҮЙ
байхыг батлана.

## Ажиллуулах

```bash
# ⚠️ ТУСДАА тест DB хэрэгтэй — production-д ОГТ ажиллуулж БОЛОХГҮЙ
node test/site/read.test.mjs  "postgresql://user:pass@host:port/testdb"
node test/site/write.test.mjs "postgresql://user:pass@host:port/testdb"
```

## Тест DB бэлдэх

```bash
# production-ийн хуулбар дээр туршина
createdb bestfilm_migration_test
zcat besttv-backup.sql.gz | psql -d bestfilm_migration_test
psql -d bestfilm_migration_test -f prisma/migrations/20260911000000_add_site_scope/1_columns.sql
psql -d bestfilm_migration_test -f prisma/migrations/20260911000000_add_site_scope/2_indexes.sql
psql -d bestfilm_migration_test -f prisma/migrations/20260911000000_add_site_scope/3_drop_old.sql
```

## Юуг батлах вэ

**read.test.mjs (17)** — уншилтын тусгаарлалт
- Хэрэглэгч, төлбөр сайт бүрд тусдаа
- Кино хоёуланд харагдана (`sites[]`)
- `groupBy`, `aggregate` шүүгдэнэ
- Байгаа `AND`/`OR` нөхцөл эвдрэхгүй
- cron (контекстгүй) бүх сайтыг хардаг

**write.test.mjs (10)** — бичилтийн тусгаарлалт
- `create` дээр site автоматаар
- ⚠️ `updateMany` / `deleteMany` нөгөө сайтад ХҮРЭХГҮЙ
- ⚠️ `$transaction` дотор өргөтгөл ажиллана
- Тестийн дата бүрэн цэвэрлэгдэнэ

## ⚠️ Хоёр урхи (аль хэдийн зассан)

1. **`runWithSite(s, () => prisma.x())`** — sync callback нь Promise-ыг
   гадагш буцаахад контекст АЛДАГДАНА. `runWithSiteAsync` ашиглана.

2. **`Object.assign` хуулбар** — `$transaction` дотор өргөтгөл
   ажиллахгүй. `PrismaService` нь Proxy буцаана.
