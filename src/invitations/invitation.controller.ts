import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { RequireRole } from '../workspace/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import express from 'express';
import { WorkspaceGuard } from '../workspace/guards/workspace.guard';
import { InviteDto, WorkspaceId } from './invitation.dto';

@Controller('workspaces')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}
  @Post(':workspaceId/invitations')
  @UseGuards(WorkspaceGuard)
  @RequireRole('owner', 'admin')
  async invite(
    @Req() req: express.Request,
    @Param() params: WorkspaceId,
    @Body() dto: InviteDto,
  ) {
    const userId = Number(req.user?.id);
    await this.invitationService.generateInvitation(
      Number(params.workspaceId),
      dto.email,
      Number(userId),
    );
  }

  @Post('invitations/accept')
  async accept(@Req() req: express.Request, @Body() dto: { token: string }) {
    const userId = Number(req.user?.id);
    await this.invitationService.acceptInvitation(dto.token, userId);
  }

  @Post('invitations/decline')
  @Public()
  async decline(@Body() dto: { token: string }) {
    await this.invitationService.declineInvitation(dto.token);
  }
}
