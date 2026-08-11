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
import {
  CreateTask,
  CreateTaskRouteDto,
  GetQueryDto,
  Name,
  ProjectRouteDto,
  RemoveMemberDto,
  TaskRouteDto,
  UpdateRoleDtoBody,
  UpdateRoleDtoPram,
  UpdateTaskDto,
  WorkspaceId,
} from './workspace.dto';

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
  async updateWorkspace(@Param() workspaceId: WorkspaceId, @Body() dto: Name) {
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
  async createProject(@Param() params: WorkspaceId, @Body() dto: Name) {
    await this.workspaceService.createProject(params.workspaceId, dto);
  }

  @Put(':workspaceId/projects/:projectId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async updateProject(@Param() params: ProjectRouteDto, @Body() dto: Name) {
    await this.workspaceService.updateProject(
      params.workspaceId.workspaceId,
      params.projectId,
      dto,
    );
  }

  @Delete(':workspaceId/projects/:projectId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async deleteProject(@Param() params: ProjectRouteDto) {
    await this.workspaceService.deleteProject(
      params.workspaceId.workspaceId,
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
      params.workspaceId.workspaceId,
      params.projectId,
      dto,
    );
  }

  @Get(':workspaceId/projects/:projectId/tasks')
  @UseGuards(WorkspaceGuard)
  async getTasks(
    @Query() query: GetQueryDto,
    @Param() params: CreateTaskRouteDto,
  ) {
    const result = await this.workspaceService.getTask(
      params.workspaceId.workspaceId,
      params.projectId,
      query.page,
      query.status,
      query.assignedTo,
      query.priority,
      query.sortBy,
      query.sortOrder,
      query.search,
    );

    return result;
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
      params.workspaceId.workspaceId,
      params.taskId,
      dto,
    );
  }

  @Delete(':workspaceId/tasks/:taskId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async deleteTask(@Param() params: TaskRouteDto) {
    await this.workspaceService.deleteTask(
      params.workspaceId.workspaceId,
      params.taskId,
    );
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
      dto.workspaceId.workspaceId,
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
      params.workspaceId.workspaceId,
      params.memberId,
      dto.role,
    );
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

  @Get(':workspaceId')
  @UseGuards(WorkspaceGuard)
  async getProject(@Query() query: GetQueryDto, @Param() param: WorkspaceId) {
    const result = await this.workspaceService.getProject(
      param.workspaceId,
      query.page,
      query.search,
      query.sortBy,
      query.sortOrder,
    );

    return result;
  }
}
