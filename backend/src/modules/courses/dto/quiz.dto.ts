import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Quiz хариулт илгээх DTO — answers нь сонгосон индексүүдийн массив. */
export class SubmitQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  answers!: number[];
}

/** Quiz асуулт (admin талд үүсгэх/засах). */
export class QuizQuestionDto {
  @IsString()
  @MinLength(1)
  question!: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  correctIndex!: number;
}

/** Quiz үүсгэх/засах DTO (admin). */
export class UpsertQuizDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  passScore?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions!: QuizQuestionDto[];
}
