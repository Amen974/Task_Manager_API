import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceGuard } from '../guards/workspace.guard';
import { RequireRole } from '../roles.decorator';
import { ProjectService } from './project.service';
import { GetQueryDto, WorkspaceId } from '../workspace.dto';
import { Name, ProjectRouteDto } from './project.dto';

@Controller('workspaces')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post(':workspaceId/projects')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async createProject(@Param() params: WorkspaceId, @Body() dto: Name) {
    await this.projectService.createProject(params.workspaceId, dto);
  }

  @Put(':workspaceId/projects/:projectId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async updateProject(@Param() params: ProjectRouteDto, @Body() dto: Name) {
    const response = await this.projectService.updateProject(
      params.workspaceId,
      params.projectId,
      dto,
    );

    return response;
  }

  @Delete(':workspaceId/projects/:projectId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async deleteProject(@Param() params: ProjectRouteDto) {
    await this.projectService.deleteProject(
      params.workspaceId,
      params.projectId,
    );
  }

  @Get(':workspaceId/projects')
  @UseGuards(WorkspaceGuard)
  async getProject(@Query() query: GetQueryDto, @Param() param: WorkspaceId) {
    const result = await this.projectService.getProject(
      param.workspaceId,
      query.page,
      query.search,
      query.sortBy,
      query.sortOrder,
    );

    return result;
  }
}
