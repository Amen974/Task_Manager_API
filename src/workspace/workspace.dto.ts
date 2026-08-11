import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Status = 'pending' | 'done' | 'failed';

export type Role = 'owner' | 'admin' | 'member';

export type SortOrder = 'asc' | 'desc';

export type SortBy = 'createdAt' | 'updatedAt' | 'priority' | 'title';

export class WorkspaceId {
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

export class CreateTask {
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must be under 100 characters' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Name must be under 1000 characters' })
  instructions!: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  assigned_to!: number | null;

  @IsString()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority!: Priority;

  @IsString()
  @IsIn(['pending', 'done', 'failed'])
  status!: Status;

  @IsOptional()
  completedAt!: Date | null;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must be under 100 characters' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Name must be under 1000 characters' })
  instructions?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  assigned_to?: number | null;

  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: Priority;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'done', 'failed'])
  status?: Status;

  @IsOptional()
  completedAt?: Date | null;
}

export class UpdateRoleDtoPram {
  @IsInt()
  @Min(1)
  memberId!: number;

  @ValidateNested()
  @Type(() => WorkspaceId)
  workspaceId!: WorkspaceId;
}

export class UpdateRoleDtoBody {
  @IsString()
  @IsNotEmpty()
  @IsIn(['owner', 'admin', 'member'])
  role!: Role;
}

export class RemoveMemberDto {
  @ValidateNested()
  @Type(() => WorkspaceId)
  workspaceId!: WorkspaceId;

  @IsInt()
  @Min(1)
  memberId!: number;
}

export class ProjectRouteDto {
  @ValidateNested()
  @Type(() => WorkspaceId)
  workspaceId!: WorkspaceId;

  @IsInt()
  @Min(1)
  projectId!: number;
}

export class CreateTaskRouteDto {
  @ValidateNested()
  @Type(() => WorkspaceId)
  workspaceId!: WorkspaceId;

  @IsInt()
  @Min(1)
  projectId!: number;
}

export class TaskRouteDto {
  @ValidateNested()
  @Type(() => WorkspaceId)
  workspaceId!: WorkspaceId;

  @IsInt()
  @Min(1)
  taskId!: number;
}

export class GetProjectsDto {
  @ValidateNested()
  @Type(() => WorkspaceId)
  workspaceId!: WorkspaceId;

  @IsInt()
  @Min(1)
  projectId!: number;
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
