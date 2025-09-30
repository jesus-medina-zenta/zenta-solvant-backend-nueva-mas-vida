import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PhoneNumberDto } from './phone-number.dto';

export class ListPhoneNumbersResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhoneNumberDto)
  phone_numbers: PhoneNumberDto[];
}
