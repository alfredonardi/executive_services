import { SetMetadata } from '@nestjs/common';

export type UserRole = 'EXECUTIVE' | 'CONCIERGE_AGENT' | 'ADMIN';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
