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
import {
  GetQueryDto,
  Name,
  ProjectRouteDto,
  WorkspaceId,
} from '../workspace.dto';
import { WorkspaceGuard } from '../guards/workspace.guard';
import { RequireRole } from '../roles.decorator';
import { ProjectService } from './project.service';

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
    await this.projectService.updateProject(
      params.workspaceId.workspaceId,
      params.projectId,
      dto,
    );
  }

  @Delete(':workspaceId/projects/:projectId')
  @RequireRole('owner', 'admin')
  @UseGuards(WorkspaceGuard)
  async deleteProject(@Param() params: ProjectRouteDto) {
    await this.projectService.deleteProject(
      params.workspaceId.workspaceId,
      params.projectId,
    );
  }

  @Get(':workspaceId')
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
