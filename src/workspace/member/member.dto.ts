import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import type { Role } from '../../types/workspace.types';

export class UpdateRoleDtoPram {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  memberId!: number;
}

export class UpdateRoleDtoBody {
  @IsString()
  @IsNotEmpty()
  @IsIn(['owner', 'admin', 'member'])
  role!: Role;
}

export class RemoveMemberDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  memberId!: number;
}
