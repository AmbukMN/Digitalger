import { IsString, MaxLength, MinLength } from 'class-validator';

/** Хичээлд асуулт асуух DTO. */
export class AskQuestionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  question!: string;
}

/** Асуултад хариулах DTO (хэрэглэгч ч хариулж болно). */
export class AddAnswerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  answer!: string;
}
