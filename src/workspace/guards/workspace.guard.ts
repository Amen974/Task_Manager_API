import {
  CanActivate,
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceService } from '../workspace.service';
import { Request } from 'express';
import { Role } from '../workspace.dto';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const workspaceId = Number(request.params.workspaceId);
    const userId = Number(request.user?.id);

    const member = await this.workspaceService.getMemberRole(
      workspaceId,
      userId,
    );
    if (!member) {
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
