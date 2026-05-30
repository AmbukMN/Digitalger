const { PrismaClient } = require('/app/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const t = await p.$queryRawUnsafe('SELECT value, label FROM "ProductTypeConfig" ORDER BY value');
  console.log('TYPES:', JSON.stringify(t));
  const counts = await p.$queryRawUnsafe(
    'SELECT type::text AS type, COUNT(*)::int AS n FROM "Product" WHERE published=true GROUP BY type ORDER BY n DESC'
  );
  console.log('COUNTS:', JSON.stringify(counts));
  await p.$disconnect();
})().catch((e) => { console.log('ERR', e.message); process.exit(0); });
