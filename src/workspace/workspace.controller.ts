import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import express from 'express';
import { WorkspaceService } from './workspace.service';
import { RequireRole } from './roles.decorator';
import { WorkspaceGuard } from './guards/workspace.guard';
import {
  CreateProjectDto,
  CreateTask,
  CreateTaskRouteDto,
  CreateWorkspaceDto,
  ProjectRouteDto,
  RemoveMemberDto,
  TaskRouteDto,
  UpdateProjectDto,
  UpdateRoleDtoBody,
  UpdateRoleDtoPram,
  UpdateTaskDto,
  UpdateWorkspaceDto,
  WorkspaceId,
} from './workspace.dto';

@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  async createWorkspace(
    @Req() req: express.Request,
    @Body() dto: CreateWorkspaceDto,
  ) {
    const userId = Number(req.user?.id);

    await this.workspaceService.createWorkspace(dto.name, userId);
  }

  @Put(':workspaceId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async updateWorkspace(
    @Param() workspaceId: WorkspaceId,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    await this.workspaceService.updateWorkspace(
      workspaceId.workspaceId,
      dto.name,
    );
  }

  @Delete(':workspaceId')
  @RequireRole('owner')
  @UseGuards(WorkspaceGuard)
  async deleteWorkspace(@Param() workspaceId: WorkspaceId) {
    await this.workspaceService.deleteWorkspace(workspaceId.workspaceId);
  }

  @Post(':workspaceId/projects')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async createProject(
    @Param() params: WorkspaceId,
    @Body() dto: CreateProjectDto,
  ) {
    await this.workspaceService.createProject(params.workspaceId, dto);
  }

  @Put(':workspaceId/projects/:projectId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async updateProject(
    @Param() params: ProjectRouteDto,
    @Body() dto: UpdateProjectDto,
  ) {
    await this.workspaceService.updateProject(
      params.workspaceId,
      params.projectId,
      dto,
    );
  }

  @Delete(':workspaceId/projects/:projectId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async deleteProject(@Param() params: ProjectRouteDto) {
    await this.workspaceService.deleteProject(
      params.workspaceId,
      params.projectId,
    );
  }

  @Post(':workspaceId/projects/:projectId/tasks')
  @RequireRole('owner', 'admin', 'member')
  @UseGuards(WorkspaceGuard)
  async createTask(
    @Param() params: CreateTaskRouteDto,
    @Body() dto: CreateTask,
  ) {
    await this.workspaceService.createTask(
      params.workspaceId,
      params.projectId,
      dto,
    );
  }

  @Put(':workspaceId/tasks/:taskId')
  @RequireRole('owner', 'admin', 'member')
  @UseGuards(WorkspaceGuard)
  async updateTask(
    @Req() req: express.Request,
    @Param() params: TaskRouteDto,
    @Body() dto: UpdateTaskDto,
  ) {
    const userId = Number(req.user?.id);

    await this.workspaceService.updateTask(
      userId,
      params.workspaceId,
      params.taskId,
      dto,
    );
  }

  @Delete(':workspaceId/tasks/:taskId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async deleteTask(@Param() params: TaskRouteDto) {
    await this.workspaceService.deleteTask(params.workspaceId, params.taskId);
  }

  @Delete(':workspaceId/members/:memberId')
  @UseGuards(WorkspaceGuard)
  async removeMember(
    @Req() req: express.Request,
    @Param() dto: RemoveMemberDto,
  ) {
    const userId = Number(req.user?.id);

    await this.workspaceService.removeMember(
      userId,
      dto.workspaceId,
      dto.memberId,
    );
  }

  @Put(':workspaceId/members/:memberId/role')
  @RequireRole('owner')
  @UseGuards(WorkspaceGuard)
  async updateRole(
    @Req() req: express.Request,
    @Param() params: UpdateRoleDtoPram,
    @Body() dto: UpdateRoleDtoBody,
  ) {
    const userId = Number(req.user?.id);

    await this.workspaceService.updateRole(
      userId,
      params.workspaceId,
      params.memberId,
      dto.role,
    );
  }
}
