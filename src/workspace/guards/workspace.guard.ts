import {
  CanActivate,
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role } from '../workspace.dto';
import { MemberService } from '../member/member.service';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly memberService: MemberService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const workspaceId = Number(request.params.workspaceId);
    const userId = Number(request.user?.id);

    const member = await this.memberService.getMemberRole(workspaceId, userId);

    if (member === null) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    const requiredRoles = this.reflector.get<Role[]>(
      'requiredRoles',
      context.getHandler(),
    );
    if (requiredRoles && !requiredRoles.includes(member)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
