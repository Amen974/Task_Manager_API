import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import express from 'express';
import { WorkspaceService } from './workspace.service';
import { RequireRole } from './roles.decorator';
import { WorkspaceGuard } from './guards/workspace.guard';
import { GetQueryDto, Name, WorkspaceId } from './workspace.dto';

@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  async createWorkspace(@Req() req: express.Request, @Body() dto: Name) {
    const userId = Number(req.user?.id);

    await this.workspaceService.createWorkspace(dto.name, userId);
  }

  @Put(':workspaceId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async updateWorkspace(@Param() parm: WorkspaceId, @Body() dto: Name) {
    await this.workspaceService.updateWorkspace(parm.workspaceId, dto.name);
  }

  @Delete(':workspaceId')
  @RequireRole('owner')
  @UseGuards(WorkspaceGuard)
  async deleteWorkspace(@Param() workspaceId: WorkspaceId) {
    await this.workspaceService.deleteWorkspace(workspaceId.workspaceId);
  }

  @Get()
  async getWorkspace(@Req() req: express.Request, @Query() query: GetQueryDto) {
    const userId = Number(req.user?.id);

    const result = await this.workspaceService.getWorkspaces(
      userId,
      query.page,
      query.search,
      query.sortBy,
      query.sortOrder,
    );

    return result;
  }
}
