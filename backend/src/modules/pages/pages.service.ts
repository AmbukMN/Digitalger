import { Injectable } from '@nestjs/common';
import { IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

export class UpsertPageDto {
  @IsString() title!: string;
  @IsString() content!: string;
}

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  findBySlug(slug: string) {
    return this.prisma.page.findUnique({ where: { slug } });
  }

  upsert(slug: string, dto: UpsertPageDto) {
    return this.prisma.page.upsert({
      where: { slug },
      update: { ...dto },
      create: { slug, ...dto },
    });
  }
}
