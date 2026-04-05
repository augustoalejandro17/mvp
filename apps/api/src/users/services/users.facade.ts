import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { User as AuthUser } from '../../auth/schemas/user.schema';
import { UserRole } from '../../auth/enums/user-role.enum';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UsersService } from '../users.service';

@Injectable()
export class UsersFacade {
  private readonly logger = new Logger(UsersFacade.name);

  constructor(private readonly usersService: UsersService) {}

  private getRequester(req: Request) {
    return {
      userId: String(req.user['sub'] || req.user['_id'] || ''),
      userRole: String(req.user['role'] || ''),
    };
  }

  findAll(req: Request) {
    const { userId, userRole } = this.getRequester(req);
    this.logger.log(
      `User ${userId} with role ${userRole} is requesting all users`,
    );
    return this.usersService.findAll(userId, userRole);
  }

  searchUsersByEmail(req: Request, email: string, schoolId?: string) {
    this.logger.log(`Buscando usuarios con email similar a: ${email}`);
    const { userId, userRole } = this.getRequester(req);
    return this.usersService.searchUsersByEmail(
      email,
      userId,
      userRole,
      schoolId,
    );
  }

  findUnregistered(req: Request) {
    const { userId, userRole } = this.getRequester(req);
    return this.usersService.findUnregistered(userId, userRole);
  }

  findOne(id: string, req: Request) {
    const { userId, userRole } = this.getRequester(req);
    const requesterRole = userRole.toLowerCase();
    const canViewAny = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.SCHOOL_OWNER,
      UserRole.ADMINISTRATIVE,
    ].includes(requesterRole as UserRole);

    if (!canViewAny && userId !== id) {
      throw new ForbiddenException('No tienes permisos para ver este usuario');
    }

    return this.usersService.findOne(id);
  }

  async deleteSelf(req: Request) {
    const { userId } = this.getRequester(req);
    this.logger.log(`User ${userId} requested account deletion`);
    await this.usersService.deleteSelf(userId);

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }

  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
    req: Request,
  ): Promise<{ message: string }> {
    const { userId } = this.getRequester(req);
    if (id !== userId) {
      throw new ForbiddenException('You can only change your own password');
    }

    await this.usersService.changePassword(id, changePasswordDto);
    return { message: 'Password changed successfully' };
  }

  async adminChangePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    this.logger.log(`Admin changing password for user: ${id}`);
    if (!changePasswordDto.password && !changePasswordDto.newPassword) {
      throw new BadRequestException(
        'Either password or newPassword must be provided',
      );
    }
    await this.usersService.changePassword(id, changePasswordDto);
    return { message: 'Password changed successfully by admin' };
  }

  async updateUserStatus(
    id: string,
    body: { status: string; reason?: string },
    req: Request,
  ) {
    const { userId } = this.getRequester(req);
    const user = await this.usersService.updateUserStatus(
      id,
      body.status,
      userId,
      body.reason,
    );
    return { success: true, user };
  }

  findAllWithStatus(req: Request, includeInactive?: string) {
    const { userId, userRole } = this.getRequester(req);
    const includeInactiveBoolean = includeInactive === 'true';

    this.logger.log(
      `User ${userId} with role ${userRole} is requesting all users with status filter`,
    );
    return this.usersService.findAllWithStatus(
      includeInactiveBoolean,
      userId,
      userRole,
    );
  }

  assignSchoolRole(
    userId: string,
    assignRoleDto: { schoolId: string; role: string },
    req: Request,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Intentando asignar rol en escuela: ${JSON.stringify(assignRoleDto)}`,
    );

    const { userId: authUserId } = this.getRequester(req);
    return this.usersService.assignSchoolRoleForManager(
      userId,
      assignRoleDto.schoolId,
      assignRoleDto.role,
      authUserId,
    );
  }

  registerUnregisteredUser(
    userId: string,
    registerDto: {
      email: string;
      password: string;
      additionalInfo?: Record<string, any>;
    },
  ): Promise<{ success: boolean; message: string; user: AuthUser }> {
    return this.usersService.registerUnregisteredUserByManager(
      userId,
      registerDto,
    );
  }

  createUnregisteredUser(createDto: {
    name: string;
    schoolId?: string;
    courseId?: string;
    role?: string;
  }) {
    return this.usersService.createUnregisteredUserFromPayload(createDto);
  }

  testCreateAssistant(body: any) {
    return this.usersService.createAssistantTestRecord(body);
  }

  createAssistantBypass(rawData: any) {
    return this.usersService.createUnregisteredUserFromPayload(rawData);
  }

  assignRoleInSchool(
    userId: string,
    body: { schoolId: string; role: string },
    req: Request,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Asignando rol ${body.role} en escuela ${body.schoolId} al usuario ${userId}`,
    );

    const { userId: requestUserId, userRole } = this.getRequester(req);
    return this.usersService.assignRoleInSchoolForRequester(
      userId,
      body.schoolId,
      body.role,
      requestUserId,
      userRole.toLowerCase(),
    );
  }

  removeRoleInSchool(
    userId: string,
    schoolId: string,
    role: string,
    req: Request,
  ): Promise<{ success: boolean; message: string; user: AuthUser }> {
    const { userId: requestUserId, userRole } = this.getRequester(req);
    return this.usersService.removeRoleInSchoolForRequester(
      userId,
      schoolId,
      role,
      requestUserId,
      userRole.toLowerCase(),
    );
  }

  async setOwnerSeatQuota(
    ownerId: string,
    body: { schoolId: string; totalSeats: number },
  ): Promise<any> {
    if (!body?.schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    if (body?.totalSeats === undefined || body?.totalSeats === null) {
      throw new BadRequestException('totalSeats is required');
    }

    const result = await this.usersService.setOwnerSeatQuota(
      ownerId,
      body.schoolId,
      Number(body.totalSeats),
    );

    return { success: true, quota: result };
  }

  getOwnerSeatQuota(
    ownerId: string,
    schoolId: string,
    req: Request,
  ): Promise<any> {
    const { userId, userRole } = this.getRequester(req);
    return this.usersService.getOwnerSeatQuotaForRequester(
      ownerId,
      schoolId,
      userId,
      userRole.toLowerCase(),
    );
  }

  getOwnerSeatQuotaReport(schoolId: string, req: Request): Promise<any> {
    const { userId, userRole } = this.getRequester(req);
    return this.usersService.getOwnerSeatQuotaReportForRequester(
      schoolId,
      userId,
      userRole.toLowerCase(),
    );
  }

  assignCourseSeat(
    userId: string,
    body: { schoolId: string; courseId: string; ownerId?: string },
    req: Request,
  ) {
    const { userId: assignedByUserId, userRole } = this.getRequester(req);
    return this.usersService.assignCourseSeatForRequester(
      userId,
      body,
      assignedByUserId,
      userRole,
    );
  }

  revokeCourseSeat(
    userId: string,
    schoolId: string,
    courseId: string,
    req: Request,
  ) {
    const { userId: revokedByUserId, userRole } = this.getRequester(req);
    return this.usersService.revokeCourseSeatForRequester(
      userId,
      schoolId,
      courseId,
      revokedByUserId,
      userRole,
    );
  }
}
