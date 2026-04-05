import { Injectable } from '@nestjs/common';
import { PlaylistsService } from '../playlists.service';
import {
  AddClassToPlaylistDto,
  CreatePlaylistDto,
  RemoveClassFromPlaylistDto,
  UpdatePlaylistDto,
} from '../dto/create-playlist.dto';

@Injectable()
export class PlaylistsFacade {
  constructor(private readonly playlistsService: PlaylistsService) {}

  private getUserContext(req: any) {
    return {
      userId: req.user?.sub || req.user?._id?.toString(),
      userRole: req.user?.role,
    };
  }

  create(createPlaylistDto: CreatePlaylistDto, req: any) {
    const { userId, userRole } = this.getUserContext(req);
    return this.playlistsService.create(createPlaylistDto, userId, userRole);
  }

  findByCourse(courseId: string, req: any) {
    const { userId, userRole } = this.getUserContext(req);
    return this.playlistsService.findByCourse(courseId, userId, userRole);
  }

  getUnorganizedClasses(courseId: string, req: any) {
    const { userId, userRole } = this.getUserContext(req);
    return this.playlistsService.getUnorganizedClasses(
      courseId,
      userId,
      userRole,
    );
  }

  findOne(id: string) {
    return this.playlistsService.findOne(id);
  }

  update(id: string, updatePlaylistDto: UpdatePlaylistDto, req: any) {
    const { userId, userRole } = this.getUserContext(req);
    return this.playlistsService.update(id, updatePlaylistDto, userId, userRole);
  }

  remove(id: string, req: any) {
    const { userId, userRole } = this.getUserContext(req);
    return this.playlistsService.remove(id, userId, userRole);
  }

  addClassToPlaylist(
    id: string,
    addClassDto: AddClassToPlaylistDto,
    req: any,
  ) {
    const { userId, userRole } = this.getUserContext(req);
    return this.playlistsService.addClassToPlaylist(
      id,
      addClassDto,
      userId,
      userRole,
    );
  }

  removeClassFromPlaylist(
    id: string,
    removeClassDto: RemoveClassFromPlaylistDto,
    req: any,
  ) {
    const { userId, userRole } = this.getUserContext(req);
    return this.playlistsService.removeClassFromPlaylist(
      id,
      removeClassDto,
      userId,
      userRole,
    );
  }

  createDefaultPlaylist(courseId: string, req: any) {
    const { userId } = this.getUserContext(req);
    return this.playlistsService.createDefaultPlaylist(courseId, userId);
  }

  reorderPlaylistsInCourse(
    courseId: string,
    playlistIds: string[],
    req: any,
  ) {
    const { userId, userRole } = this.getUserContext(req);
    return this.playlistsService.reorderPlaylistsInCourse(
      courseId,
      playlistIds,
      userId,
      userRole,
    );
  }

  reorderClasses(id: string, classIds: string[], req: any) {
    const { userId, userRole } = this.getUserContext(req);
    return this.playlistsService.reorderClassesInPlaylist(
      id,
      classIds,
      userId,
      userRole,
    );
  }
}
