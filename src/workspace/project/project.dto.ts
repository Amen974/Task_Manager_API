import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { WorkspaceId } from '../workspace.dto';
import { Type } from 'class-transformer';

export class Name {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class ProjectRouteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId!: number;
}

export class GetProjectsDto {
  @Type(() => Number)
  @ValidateNested()
  @Type(() => WorkspaceId)
  workspaceId!: WorkspaceId;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId!: number;
}
