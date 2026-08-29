import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class InviteDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;
}

export class WorkspaceId {
  @Type(() => Number)
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  workspaceId!: number;
}
