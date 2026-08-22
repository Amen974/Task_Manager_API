import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { MemberController } from './member/member.controller';
import { MemberService } from './member/member.service';
import { ProjectController } from './project/project.controller';
import { TaskController } from './task/task.controller';
import { ProjectService } from './project/project.service';
import { TaskService } from './task/task.service';
import { WorkspaceGuard } from './guards/workspace.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [
    MemberController,
    WorkspaceController,
    ProjectController,
    TaskController,
  ],
  providers: [MemberService, WorkspaceService, ProjectService, TaskService],
  exports: [
    MemberService,
    WorkspaceService,
    ProjectService,
    TaskService,
    WorkspaceGuard,
  ],
})
export class WorkspaceModule {}
