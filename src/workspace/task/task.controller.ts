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
import {
  CreateTask,
  CreateTaskRouteDto,
  GetQueryDto,
  TaskRouteDto,
  UpdateTaskDto,
} from '../workspace.dto';
import { WorkspaceGuard } from '../guards/workspace.guard';
import { RequireRole } from '../roles.decorator';
import { TaskService } from './task.service';

@Controller('workspaces')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post(':workspaceId/projects/:projectId/tasks')
  @RequireRole('owner', 'admin', 'member')
  @UseGuards(WorkspaceGuard)
  async createTask(
    @Param() params: CreateTaskRouteDto,
    @Body() dto: CreateTask,
  ) {
    await this.taskService.createTask(
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
    const result = await this.taskService.getTask(
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

    await this.taskService.updateTask(
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
    await this.taskService.deleteTask(
      params.workspaceId.workspaceId,
      params.taskId,
    );
  }
}
