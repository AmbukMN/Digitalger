import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const DB_URL = process.env.DATABASE_URL ?? '';

// Connection pool: API сервер 50, Worker 20 — PostgreSQL max_connections=300 тохиргоотой ажиллана
const POOL_SIZE = parseInt(process.env.DB_POOL_SIZE ?? '50', 10);
const POOL_TIMEOUT = parseInt(process.env.DB_POOL_TIMEOUT ?? '10', 10);

function buildUrl() {
  if (!DB_URL) return DB_URL;
  try {
    const url = new URL(DB_URL);
    url.searchParams.set('connection_limit', String(POOL_SIZE));
    url.searchParams.set('pool_timeout', String(POOL_TIMEOUT));
    return url.toString();
  } catch {
    return DB_URL;
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: { db: { url: buildUrl() } },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
