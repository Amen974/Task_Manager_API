import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StorageService } from './storage.service';
import { WorkspaceGuard } from '../workspace/guards/workspace.guard';
import {
  ConfirmUploadBody,
  ConfirmUploadParams,
  CreateUploadUrlBody,
  CreateUploadUrlPram,
  getFileDto,
} from './storage.dto';
import { RequireRole } from '../workspace/roles.decorator';

@Controller('workspaces')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post(':workspaceId/projects/:projectId/tasks/:taskId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async createUploadUrl(
    @Param() params: CreateUploadUrlPram,
    @Body() dto: CreateUploadUrlBody,
  ): Promise<{ signedUrl: string; fileId: string }> {
    const result = await this.storageService.createUploadUrl(
      dto.contentType,
      params.workspaceId,
      params.projectId,
      params.taskId,
    );

    return { signedUrl: result.signedUrl, fileId: result.fileId };
  }

  @Post(':workspaceId/projects/:projectId/tasks/:taskId/files/:fileId/confirm')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async confirmUpload(
    @Param() params: ConfirmUploadParams,
    @Body() dto: ConfirmUploadBody,
    @Req() request: Request,
  ): Promise<{ id: number; fileId: number }> {
    return await this.storageService.confirmUpload(
      params.workspaceId,
      params.projectId,
      params.taskId,
      params.fileId,
      dto.originalName,
      request.user!.id,
    );
  }

  @Get(':workspaceId/projects/:projectId/tasks/:taskId/files/:fileId')
  @UseGuards(WorkspaceGuard)
  async getFile(@Param() params: getFileDto): Promise<{ signedUrl: string }> {
    return await this.storageService.getFile(
      params.workspaceId,
      params.projectId,
      params.taskId,
      params.fileId,
    );
  }
}
