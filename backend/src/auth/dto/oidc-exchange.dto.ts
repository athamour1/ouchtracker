import { IsString, MaxLength } from 'class-validator';

export class OidcExchangeDto {
  @IsString()
  @MaxLength(200)
  ticket: string;
}
