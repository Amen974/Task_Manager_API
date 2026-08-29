import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  Priority,
  SortBy,
  SortOrder,
  Status,
} from '../types/workspace.types';

export class WorkspaceId {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workspaceId!: number;
}

export class Name {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class GetQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'done', 'failed'])
  status?: Status;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedTo?: number;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: Priority;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'priority', 'title'])
  sortBy?: SortBy;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: SortOrder;

  @IsOptional()
  @IsString()
  search?: string;
}
