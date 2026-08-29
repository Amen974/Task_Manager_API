import { IsEmail, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class EmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password_hash!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class GetUserByIdDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  id!: number;
}
