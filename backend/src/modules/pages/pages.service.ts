import { Injectable } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { assertOwner } from '../../common/ownership';

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

  async upsert(slug: string, dto: UpsertPageDto, me: JwtPayload) {
    // Хэрэв хуудас аль хэдийн байгаа бол ЗАСАХ эрхийг шалгана (IDOR хаах).
    const existing = await this.prisma.page.findUnique({ where: { slug } });
    if (existing) assertOwner(me, existing, 'засах');
    return this.prisma.page.upsert({
      where: { slug },
      update: { ...dto },
      // ownership зөвхөн create үед бичигдэнэ (update-д createdByUserId-г хадгалахгүй)
      create: { slug, ...dto, ...(me.sub && { createdByUserId: me.sub }) },
    });
  }
}
