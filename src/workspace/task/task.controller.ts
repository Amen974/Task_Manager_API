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
import { WorkspaceGuard } from '../guards/workspace.guard';
import { RequireRole } from '../roles.decorator';
import { TaskService } from './task.service';
import {
  CreateTask,
  CreateTaskRouteDto,
  GetTaskDto,
  TaskRouteDto,
  UpdateTaskDto,
} from './task.dto';

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
      params.workspaceId,
      params.projectId,
      dto,
    );
  }

  @Get(':workspaceId/projects/:projectId/tasks')
  @UseGuards(WorkspaceGuard)
  async getTasks(
    @Query() query: GetTaskDto,
    @Param() params: CreateTaskRouteDto,
  ) {
    const result = await this.taskService.getTask(
      params.projectId,
      params.workspaceId,
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

  @Put(':workspaceId/projects/:projectId/tasks/:taskId')
  @RequireRole('owner', 'admin', 'member')
  @UseGuards(WorkspaceGuard)
  async updateTask(
    @Req() req: express.Request,
    @Param() params: TaskRouteDto,
    @Body() dto: UpdateTaskDto,
  ) {
    const userId = Number(req.user?.id);

    const response = await this.taskService.updateTask(
      userId,
      params.workspaceId,
      params.projectId,
      params.taskId,
      dto,
    );

    return response;
  }

  @Delete(':workspaceId/projects/:projectId/tasks/:taskId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async deleteTask(@Param() params: TaskRouteDto) {
    await this.taskService.deleteTask(params.workspaceId, params.taskId);
  }
}
