import { SetMetadata } from '@nestjs/common';
import { Role } from './workspace.dto';

export const RequireRole = (...roles: Role[]) =>
  SetMetadata('requiredRoles', roles);
