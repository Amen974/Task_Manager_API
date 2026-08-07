import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

type Priority = 'low' | 'medium' | 'high' | 'urgent';

type Status = 'pending' | 'done' | 'failed';

export type Role = 'owner' | 'admin' | 'member';

export class CreateTask {
  @IsInt()
  @Min(1)
  projectId!: number;

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

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class UpdateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class UpdateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class UpdateRoleDtoPram {
  @IsInt()
  @Min(1)
  memberId!: number;

  @IsInt()
  @Min(1)
  workspaceId!: number;
}

export class UpdateRoleDtoBody {
  @IsString()
  @IsNotEmpty()
  @IsIn(['owner', 'admin', 'member'])
  role!: Role;
}

export class RemoveMemberDto {
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @IsInt()
  @Min(1)
  memberId!: number;
}

export class WorkspaceId {
  @IsInt()
  @Min(1)
  workspaceId!: number;
}

export class ProjectRouteDto {
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @IsInt()
  @Min(1)
  projectId!: number;
}

export class CreateTaskRouteDto {
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @IsInt()
  @Min(1)
  projectId!: number;
}

export class TaskRouteDto {
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @IsInt()
  @Min(1)
  taskId!: number;
}
