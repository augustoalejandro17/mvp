import { UserRole } from '../types/user';

/**
 * Utility functions to check permissions in the frontend
 * Can be used to conditionally render UI elements like action buttons
 */

/**
 * Helper function to normalize role names for comparison
 * This handles different case formats (SUPER_ADMIN vs super_admin)
 */
const normalizeRole = (role: UserRole | string): string => {
  if (!role) return '';
  return String(role).toLowerCase();
};

/**
 * Check if a user has sufficient role-based permissions
 * @param userRole The current user's role
 * @param requiredRoles Array of roles that are allowed to perform the action
 */
export const hasRolePermission = (userRole: UserRole | string, requiredRoles: (UserRole | string)[]): boolean => {
  if (!userRole) return false;

  const normalizedUserRole = normalizeRole(userRole);
  
  // Super admin can do everything
  if (normalizedUserRole === 'super_admin') return true;

  // Check if user role is in the required roles (case-insensitive)
  return requiredRoles.some(role => normalizeRole(role) === normalizedUserRole);
};

/**
 * Check if the current user can modify a class (update, delete, etc.)
 * @param userRole User's role
 * @param isTeacher Whether the user is the teacher of the class
 */
export const canModifyClass = (userRole: UserRole | string, isTeacher: boolean): boolean => {
  if (!userRole) return false;
  const normalizedRole = normalizeRole(userRole);
  
  // Super_admin, school_owner, admin can modify any class
  if (normalizedRole === 'super_admin' ||
      normalizedRole === 'school_owner' ||
      normalizedRole === 'admin') {
    return true;
  }

  // Teachers can modify their own classes
  return normalizedRole === 'teacher' && isTeacher;
};

/**
 * Check if the current user can upload, delete or manage videos
 * @param userRole User's role
 */
export const canManageVideos = (userRole: UserRole | string): boolean => {
  if (!userRole) return false;
  const normalizedRole = normalizeRole(userRole);
  
  return normalizedRole === 'admin' || 
         normalizedRole === 'super_admin' || 
         normalizedRole === 'teacher' ||
         normalizedRole === 'school_owner';
};

/**
 * Check if the current user can manage users (view, edit, delete)
 * @param userRole User's role
 */
export const canManageUsers = (userRole: UserRole | string): boolean => {
  if (!userRole) return false;
  const normalizedRole = normalizeRole(userRole);
  
  return normalizedRole === 'admin' || 
         normalizedRole === 'super_admin' ||
         normalizedRole === 'school_owner';
};

/**
 * Check if the current user can manage schools (create, update, delete)
 * @param userRole User's role
 */
export const canManageSchools = (userRole: UserRole | string): boolean => {
  if (!userRole) return false;
  const normalizedRole = normalizeRole(userRole);
  
  return normalizedRole === 'admin' || 
         normalizedRole === 'super_admin' || 
         normalizedRole === 'school_owner';
};

/**
 * Check if the current user can manage attendance for a class
 * @param userRole User's role
 * @param isTeacher Whether the user is the teacher of the class
 */
export const canManageAttendance = (userRole: UserRole | string, isTeacher: boolean): boolean => {
  if (!userRole) return false;
  const normalizedRole = normalizeRole(userRole);
  
  // Admin, super_admin, school_owner, administrative can manage attendance
  if (normalizedRole === 'admin' || 
      normalizedRole === 'super_admin' ||
      normalizedRole === 'school_owner' ||
      normalizedRole === 'administrative') {
    return true;
  }

  // Teachers can manage attendance for their own classes
  return normalizedRole === 'teacher' && isTeacher;
}; 