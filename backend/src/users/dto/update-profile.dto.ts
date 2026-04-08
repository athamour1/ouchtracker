import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsIn(['en', 'el'])
  @IsOptional()
  locale?: string;

  /** Required when newPassword is provided. */
  @ValidateIf((o: UpdateProfileDto) => !!o.newPassword)
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  newPassword?: string;
}
