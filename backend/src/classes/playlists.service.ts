import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Playlist } from './schemas/playlist.schema';
import { Class } from './schemas/class.schema';
import { Course } from '../courses/schemas/course.schema';
import { Enrollment } from '../courses/schemas/enrollment.schema';
import {
  CreatePlaylistDto,
  UpdatePlaylistDto,
  AddClassToPlaylistDto,
  RemoveClassFromPlaylistDto,
} from './dto/create-playlist.dto';
import { S3Service } from '../services/s3.service';
import { CloudFrontService } from '../services/cloudfront.service';

@Injectable()
export class PlaylistsService {
  private readonly logger = new Logger(PlaylistsService.name);

  constructor(
    @InjectModel(Playlist.name) private playlistModel: Model<Playlist>,
    @InjectModel(Class.name) private classModel: Model<Class>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
    private readonly s3Service: S3Service,
    private readonly cloudFrontService: CloudFrontService,
  ) {}

  // Helper method to generate signed URLs for classes
  private async generateSignedUrlsForClasses(classes: any[]): Promise<any[]> {
    const classesWithSignedUrls = [];

    for (const classItem of classes) {
      try {
        if (classItem.videoUrl) {
          const signedUrl = await this.s3Service.getSignedUrl(
            classItem.videoUrl,
          );
          const classObj = classItem.toObject
            ? classItem.toObject()
            : { ...classItem };
          classObj.videoUrl = signedUrl;
          classesWithSignedUrls.push(classObj);
        } else {
          this.logger.warn(
            `Class ${classItem._id} has no videoUrl, using original object`,
          );
          classesWithSignedUrls.push(
            classItem.toObject ? classItem.toObject() : { ...classItem },
          );
        }
      } catch (error) {
        this.logger.error(
          `Error generating signed URL for class ${classItem._id}: ${error.message}`,
          error.stack,
        );
        // Use original object but log the issue for debugging
        const classObj = classItem.toObject
          ? classItem.toObject()
          : { ...classItem };
        classesWithSignedUrls.push(classObj);
      }
    }

    return classesWithSignedUrls;
  }

  async create(
    createPlaylistDto: CreatePlaylistDto,
    userId: string,
    userRole: string,
  ): Promise<Playlist> {
    try {
      // Verify course exists
      const course = await this.courseModel
        .findById(createPlaylistDto.course)
        .populate('teacher teachers');
      if (!course) {
        throw new NotFoundException('Curso no encontrado');
      }

      // Check permissions - only teachers, administrators, and school owners can create playlists
      if (!this.canModifyPlaylist(course, userId, userRole)) {
        throw new BadRequestException(
          'No tienes permisos para crear listas de reproducción en este curso',
        );
      }

      const playlist = new this.playlistModel({
        ...createPlaylistDto,
        createdBy: userId,
      });

      return await playlist.save();
    } catch (error) {
      this.logger.error(
        `Error creating playlist: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findByCourse(
    courseId: string,
    userId?: string,
    userRole?: string,
  ): Promise<Playlist[]> {
    try {
      const playlistQuery: any = { course: courseId, isActive: true };

      // If user is not provided or is a regular student, only show public playlists
      if (!userId || !userRole || userRole === 'student') {
        // Check if user is enrolled in the course (if userId is provided)
        if (userId) {
          const enrollment = await this.enrollmentModel.findOne({
            course: courseId,
            student: userId,
            isActive: true,
          });

          // If user is enrolled, show both public and private playlists
          if (enrollment) {
            // Show all playlists for enrolled users
          } else {
            // Show only public playlists for non-enrolled users
            playlistQuery.isPublic = true;
          }
        } else {
          // Show only public playlists for anonymous users
          playlistQuery.isPublic = true;
        }
      }
      // For teachers, admins, etc., show all playlists (handled by existing permissions)

      const playlists = await this.playlistModel
        .find(playlistQuery)
        .populate('classes')
        .populate('createdBy', 'name email')
        .sort({ order: 1, createdAt: 1 })
        .exec();

      // Generate signed URLs for all classes in playlists
      const playlistsWithSignedUrls = [];
      for (const playlist of playlists) {
        const playlistObj = playlist.toObject();
        if (playlistObj.classes && playlistObj.classes.length > 0) {
          // Filter classes based on user access level
          const filteredClasses = await this.filterClassesForUser(
            playlistObj.classes,
            courseId,
            userId,
            userRole,
          );
          
          playlistObj.classes = await this.generateSignedUrlsForClasses(
            filteredClasses,
          );
        }
        playlistsWithSignedUrls.push(playlistObj);
      }

      return playlistsWithSignedUrls;
    } catch (error) {
      this.logger.error(
        `Error finding playlists for course: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findOne(id: string): Promise<Playlist> {
    try {
      const playlist = await this.playlistModel
        .findById(id)
        .populate('classes')
        .populate('course', 'title')
        .populate('createdBy', 'name email')
        .exec();

      if (!playlist) {
        throw new NotFoundException('Lista de reproducción no encontrada');
      }

      // Generate signed URLs for classes in this playlist
      const playlistObj = playlist.toObject();
      if (playlistObj.classes && playlistObj.classes.length > 0) {
        playlistObj.classes = await this.generateSignedUrlsForClasses(
          playlistObj.classes,
        );
      }

      return playlistObj;
    } catch (error) {
      this.logger.error(
        `Error finding playlist: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async update(
    id: string,
    updatePlaylistDto: UpdatePlaylistDto,
    userId: string,
    userRole: string,
  ): Promise<Playlist> {
    try {
      const playlist = await this.playlistModel.findById(id).populate('course');
      if (!playlist) {
        throw new NotFoundException('Lista de reproducción no encontrada');
      }

      // Check permissions
      if (!this.canModifyPlaylist(playlist.course, userId, userRole)) {
        throw new BadRequestException(
          'No tienes permisos para modificar esta lista de reproducción',
        );
      }

      const updatedPlaylist = await this.playlistModel
        .findByIdAndUpdate(
          id,
          { ...updatePlaylistDto, updatedAt: new Date() },
          { new: true },
        )
        .populate('classes')
        .populate('createdBy', 'name email')
        .exec();

      return updatedPlaylist;
    } catch (error) {
      this.logger.error(
        `Error updating playlist: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    try {
      const playlist = await this.playlistModel.findById(id).populate('course');
      if (!playlist) {
        throw new NotFoundException('Lista de reproducción no encontrada');
      }

      // Prevent deletion of default playlist
      if (playlist.isDefault) {
        throw new BadRequestException(
          'No se puede eliminar la lista de reproducción por defecto',
        );
      }

      // Check permissions
      if (!this.canModifyPlaylist(playlist.course, userId, userRole)) {
        throw new BadRequestException(
          'No tienes permisos para eliminar esta lista de reproducción',
        );
      }

      await this.playlistModel.findByIdAndUpdate(id, { isActive: false });
    } catch (error) {
      this.logger.error(
        `Error removing playlist: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async addClassToPlaylist(
    playlistId: string,
    addClassDto: AddClassToPlaylistDto,
    userId: string,
    userRole: string,
  ): Promise<Playlist> {
    try {
      const playlist = await this.playlistModel
        .findById(playlistId)
        .populate('course');
      if (!playlist) {
        this.logger.error(`Playlist not found: ${playlistId}`);
        throw new NotFoundException('Lista de reproducción no encontrada');
      }

      // Check permissions
      if (!this.canModifyPlaylist(playlist.course, userId, userRole)) {
        this.logger.error(
          `Permission denied for user ${userId} with role ${userRole} to modify playlist ${playlistId}`,
        );
        throw new BadRequestException(
          'No tienes permisos para modificar esta lista de reproducción',
        );
      }

      const classToAdd = await this.classModel.findById(addClassDto.classId);
      if (!classToAdd) {
        this.logger.error(`Class not found: ${addClassDto.classId}`);
        throw new NotFoundException('Clase no encontrada');
      }

      // Check if class belongs to the same course
      const playlistCourseId =
        (playlist.course as any)._id?.toString() || playlist.course.toString();
      const classCourseId = classToAdd.course.toString();

      if (classCourseId !== playlistCourseId) {
        this.logger.error(
          `Course mismatch: class course ${classCourseId} vs playlist course ${playlistCourseId}`,
        );
        throw new BadRequestException(
          'La clase debe pertenecer al mismo curso que la lista de reproducción',
        );
      }

      // Check if class is already in the playlist
      if (playlist.classes.includes(addClassDto.classId as any)) {
        this.logger.error(
          `Class ${addClassDto.classId} already in playlist ${playlistId}`,
        );
        throw new BadRequestException(
          'La clase ya está en esta lista de reproducción',
        );
      }

      playlist.classes.push(addClassDto.classId as any);
      playlist.updatedAt = new Date();
      await playlist.save();

      return await this.findOne(playlistId);
    } catch (error) {
      this.logger.error(
        `Error adding class to playlist: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async removeClassFromPlaylist(
    playlistId: string,
    removeClassDto: RemoveClassFromPlaylistDto,
    userId: string,
    userRole: string,
  ): Promise<Playlist> {
    try {
      const playlist = await this.playlistModel
        .findById(playlistId)
        .populate('course');
      if (!playlist) {
        throw new NotFoundException('Lista de reproducción no encontrada');
      }

      // Check permissions
      if (!this.canModifyPlaylist(playlist.course, userId, userRole)) {
        throw new BadRequestException(
          'No tienes permisos para modificar esta lista de reproducción',
        );
      }

      playlist.classes = playlist.classes.filter(
        (classId) => classId.toString() !== removeClassDto.classId,
      );
      playlist.updatedAt = new Date();
      await playlist.save();

      return await this.findOne(playlistId);
    } catch (error) {
      this.logger.error(
        `Error removing class from playlist: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async createDefaultPlaylist(
    courseId: string,
    userId: string,
  ): Promise<Playlist> {
    try {
      // Check if default playlist already exists
      const existingDefault = await this.playlistModel.findOne({
        course: courseId,
        isDefault: true,
        isActive: true,
      });

      if (existingDefault) {
        return existingDefault;
      }

      const defaultPlaylist = new this.playlistModel({
        name: 'Todas las clases',
        description:
          'Lista de reproducción por defecto con todas las clases del curso',
        course: courseId,
        createdBy: userId,
        isDefault: true,
        order: 0,
      });

      return await defaultPlaylist.save();
    } catch (error) {
      this.logger.error(
        `Error creating default playlist: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getUnorganizedClasses(
    courseId: string,
    userId?: string,
    userRole?: string,
  ): Promise<Class[]> {
    try {
      // Check if user has access to this course
      const course = await this.courseModel.findById(courseId);
      if (!course) {
        throw new NotFoundException('Curso no encontrado');
      }

      // For public courses, allow unauthenticated access
      if (!course.isPublic && !userId) {
        return []; // Return empty array for non-public courses without authentication
      }

      // For private courses, check permissions
      if (!course.isPublic && userId) {
        const hasAccess = this.canModifyPlaylist(course, userId, userRole);
        
        // Check if user is enrolled in the course
        const enrollment = await this.enrollmentModel.findOne({
          course: courseId,
          student: userId,
          isActive: true,
        });

        if (!hasAccess && !enrollment) {
          return []; // Return empty array if no access
        }
      }

      // Get all playlists for the course
      const playlists = await this.playlistModel
        .find({ course: courseId, isActive: true })
        .exec();

      // Get all class IDs that are in playlists
      const organizedClassIds = new Set();
      playlists.forEach((playlist) => {
        playlist.classes.forEach((classId) => {
          organizedClassIds.add(classId.toString());
        });
      });

      // Get all classes for the course that are not in any playlist
      const allClasses = await this.classModel
        .find({ course: courseId, isActive: true })
        .exec();
      const unorganizedClasses = allClasses.filter(
        (cls) => !organizedClassIds.has(cls._id.toString()),
      );

      // Generate signed URLs for unorganized classes
      const unorganizedClassesWithSignedUrls =
        await this.generateSignedUrlsForClasses(unorganizedClasses);

      return unorganizedClassesWithSignedUrls;
    } catch (error) {
      this.logger.error(
        `Error getting unorganized classes: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private canModifyPlaylist(
    course: any,
    userId: string,
    userRole: string,
  ): boolean {
    // Super admin and admin can modify any playlist
    if (['super_admin', 'admin'].includes(userRole)) {
      return true;
    }

    // School owner and administrative can modify playlists in their school
    if (['school_owner', 'administrative'].includes(userRole)) {
      // In a real implementation, you'd verify the user belongs to the course's school
      // For now, we'll allow it for these roles
      return true;
    }

    // Teachers can modify playlists in courses they teach
    if (userRole === 'teacher') {
      // Check if user is the main teacher
      if (course.teacher && course.teacher._id.toString() === userId) {
        return true;
      }
      // Check if user is in the additional teachers array
      if (course.teachers && Array.isArray(course.teachers)) {
        return course.teachers.some(
          (teacher) => teacher._id.toString() === userId,
        );
      }
    }

    // Students and other roles cannot modify playlists
    return false;
  }

  async reorderClassesInPlaylist(
    playlistId: string,
    classIds: string[],
    userId: string,
    userRole: string,
  ): Promise<Playlist> {
    try {
      const playlist = await this.playlistModel
        .findById(playlistId)
        .populate('course');
      if (!playlist) {
        throw new NotFoundException('Lista de reproducción no encontrada');
      }

      // Check permissions
      if (!this.canModifyPlaylist(playlist.course, userId, userRole)) {
        throw new BadRequestException(
          'No tienes permisos para modificar esta lista de reproducción',
        );
      }

      // Verify all class IDs exist and belong to the course
      const classes = await this.classModel.find({
        _id: { $in: classIds },
        course: (playlist.course as any)._id,
      });

      if (classes.length !== classIds.length) {
        throw new BadRequestException(
          'Algunas clases no existen o no pertenecen a este curso',
        );
      }

      // Update the playlist with the new order
      playlist.classes = classIds as any;
      playlist.updatedAt = new Date();
      await playlist.save();

      return await this.findOne(playlistId);
    } catch (error) {
      this.logger.error(
        `Error reordering classes in playlist: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async filterClassesForUser(
    classes: any[],
    courseId: string,
    userId?: string,
    userRole?: string,
  ): Promise<any[]> {
    // If no user is provided, only show public classes
    if (!userId || !userRole) {
      return classes.filter(classItem => classItem.isPublic === true);
    }

    // Admin and super admin can see all classes
    if (['super_admin', 'admin'].includes(userRole)) {
      return classes;
    }

    // Check if user is enrolled in the course
    const enrollment = await this.enrollmentModel.findOne({
      course: courseId,
      student: userId,
      isActive: true,
    });

    // If user is enrolled, show all classes
    if (enrollment) {
      return classes;
    }

    // Check if user is a teacher of the course
    const course = await this.courseModel.findById(courseId);
    if (course && userRole === 'teacher') {
      const isCourseTeacher = 
        (course.teacher && course.teacher.toString() === userId) ||
        (course.teachers && course.teachers.some(t => t.toString() === userId));
      
      if (isCourseTeacher) {
        return classes;
      }
    }

    // For all other cases (including non-enrolled students), only show public classes
    return classes.filter(classItem => classItem.isPublic === true);
  }
}
