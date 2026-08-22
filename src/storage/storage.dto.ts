import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateUploadUrlPram {
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @IsInt()
  @Min(1)
  projectId!: number;

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
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @IsInt()
  @Min(1)
  projectId!: number;

  @IsInt()
  @Min(1)
  taskId!: number;

  @IsInt()
  @Min(1)
  fileId!: number;
}

export class ConfirmUploadBody {
  @IsString()
  @IsNotEmpty()
  originalName!: string;
}

export class getFileDto {
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @IsInt()
  @Min(1)
  projectId!: number;

  @IsInt()
  @Min(1)
  taskId!: number;

  @IsInt()
  @Min(1)
  fileId!: number;
}
