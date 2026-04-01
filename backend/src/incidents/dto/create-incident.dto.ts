import { Type } from 'class-transformer';
import {
  IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested,
} from 'class-validator';

export class IncidentItemDto {
  @IsUUID()
  kitItemId: string;

  @IsInt()
  @Min(0)
  quantityUsed: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateIncidentDto {
  @IsUUID()
  kitId: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncidentItemDto)
  items: IncidentItemDto[];
}
