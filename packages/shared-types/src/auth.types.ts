/**
 * Authentication-related types and DTOs
 */

import { UserRole } from './user.types';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  age?: number;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    profileImageUrl?: string;
    hasOnboarded: boolean;
  };
  message?: string;
  isNewUser?: boolean;
}

export interface GoogleAuthDto {
  idToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ChangeRoleDto {
  userId: string;
  newRole: UserRole;
}

