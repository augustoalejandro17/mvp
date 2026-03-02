import { SetMetadata } from '@nestjs/common';
import { Permission } from '../guards/permissions.guard';

/**
 * Decorator that sets required permissions on a route or controller.
 * This metadata is used by the PermissionsGuard to check if user has necessary permissions.
 * @param permissions Array of permissions required to access the route
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata('permissions', permissions);
