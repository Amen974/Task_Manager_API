import {
  Body,
  Controller,
  Delete,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MemberService } from './member.service';
import express from 'express';
import {
  RemoveMemberDto,
  UpdateRoleDtoBody,
  UpdateRoleDtoPram,
} from '../workspace.dto';
import { WorkspaceGuard } from '../guards/workspace.guard';
import { RequireRole } from '../roles.decorator';

@Controller('workspaces')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Delete(':workspaceId/members/:memberId')
  @UseGuards(WorkspaceGuard)
  async removeMember(
    @Req() req: express.Request,
    @Param() dto: RemoveMemberDto,
  ) {
    const userId = Number(req.user?.id);

    await this.memberService.removeMember(
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

    await this.memberService.updateRole(
      userId,
      params.workspaceId.workspaceId,
      params.memberId,
      dto.role,
    );
  }
}
