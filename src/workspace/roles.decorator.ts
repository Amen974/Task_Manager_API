import { SetMetadata } from '@nestjs/common';
import { Role } from '../types/workspace.types';

export const RequireRole = (...roles: Role[]) =>
  SetMetadata('requiredRoles', roles);
