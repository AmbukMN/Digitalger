import { Injectable } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

export class UpsertPageDto {
  @IsString() title!: string;
  @IsString() content!: string;
  // SEO талбарууд — admin-аас тохируулна, generateMetadata уншина
  @IsOptional() @IsString() metaTitle?: string;
  @IsOptional() @IsString() metaDescription?: string;
  @IsOptional() @IsString() metaKeywords?: string;
  @IsOptional() @IsString() ogImageUrl?: string;
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
