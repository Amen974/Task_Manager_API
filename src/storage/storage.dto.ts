import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateUploadUrlPram {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskId!: number;
}

export class CreateUploadUrlBody {
  @IsString()
  @IsNotEmpty()
  contentType!: string;
}

export class ConfirmUploadParams {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskId!: number;

  @IsString()
  @IsNotEmpty()
  fileId!: string;
}

export class ConfirmUploadBody {
  @IsString()
  @IsNotEmpty()
  originalName!: string;
}

export class getFileDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskId!: number;

  @IsString()
  @IsNotEmpty()
  fileId!: string;
}
