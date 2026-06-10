import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Marketing bulk email — admin compose (subject/body → сонгосон эсвэл бүх/category subscriber).
export class SendBulkEmailDto {
  // Хүлээн авагч сонгох 3 арга (давхар хэрэглэж болно):
  //  1) recipientIds — UI-д сонгосон subscriber-ууд.
  //  2) status — тодорхой төлөв (default ACTIVE).
  //  3) categoryId — тодорхой категори.
  // recipientIds байвал тэр давамгайлна; эс бол status/category-аар шүүнэ.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientIds?: string[];

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'UNSUBSCRIBED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'UNSUBSCRIBED';

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Гарчиг (subject) оруулна уу' })
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty({ message: 'Имэйлийн агуулга оруулна уу' })
  @MaxLength(50000)
  bodyHtml!: string;
}
