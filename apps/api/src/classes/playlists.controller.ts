import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import {
  CreatePlaylistDto,
  UpdatePlaylistDto,
  AddClassToPlaylistDto,
  RemoveClassFromPlaylistDto,
} from './dto/create-playlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createPlaylistDto: CreatePlaylistDto, @Request() req) {
    const userId = req.user.sub || req.user._id?.toString();
    return this.playlistsService.create(
      createPlaylistDto,
      userId,
      req.user.role,
    );
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findByCourse(@Query('courseId') courseId: string, @Request() req) {
    const userId = req.user?.sub || req.user?._id?.toString();
    const userRole = req.user?.role;
    return this.playlistsService.findByCourse(courseId, userId, userRole);
  }

  @Get('unorganized')
  @UseGuards(OptionalJwtAuthGuard)
  getUnorganizedClasses(@Query('courseId') courseId: string, @Request() req) {
    const userId = req.user?.sub || req.user?._id?.toString();
    const userRole = req.user?.role;
    return this.playlistsService.getUnorganizedClasses(
      courseId,
      userId,
      userRole,
    );
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.playlistsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
    @Request() req,
  ) {
    const userId = req.user.sub || req.user._id?.toString();
    return this.playlistsService.update(
      id,
      updatePlaylistDto,
      userId,
      req.user.role,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub || req.user._id?.toString();
    return this.playlistsService.remove(id, userId, req.user.role);
  }

  @Post(':id/add-class')
  @UseGuards(JwtAuthGuard)
  addClassToPlaylist(
    @Param('id') id: string,
    @Body() addClassDto: AddClassToPlaylistDto,
    @Request() req,
  ) {
    const userId = req.user.sub || req.user._id?.toString();
    return this.playlistsService.addClassToPlaylist(
      id,
      addClassDto,
      userId,
      req.user.role,
    );
  }

  @Post(':id/remove-class')
  @UseGuards(JwtAuthGuard)
  removeClassFromPlaylist(
    @Param('id') id: string,
    @Body() removeClassDto: RemoveClassFromPlaylistDto,
    @Request() req,
  ) {
    const userId = req.user.sub || req.user._id?.toString();
    return this.playlistsService.removeClassFromPlaylist(
      id,
      removeClassDto,
      userId,
      req.user.role,
    );
  }

  @Post('default')
  @UseGuards(JwtAuthGuard)
  createDefaultPlaylist(@Body() body: { courseId: string }, @Request() req) {
    const userId = req.user.sub || req.user._id?.toString();
    return this.playlistsService.createDefaultPlaylist(body.courseId, userId);
  }

  @Post('reorder-course')
  @UseGuards(JwtAuthGuard)
  reorderPlaylistsInCourse(
    @Body() body: { courseId: string; playlistIds: string[] },
    @Request() req,
  ) {
    const userId = req.user.sub || req.user._id?.toString();
    return this.playlistsService.reorderPlaylistsInCourse(
      body.courseId,
      body.playlistIds,
      userId,
      req.user.role,
    );
  }

  @Post(':id/reorder')
  @UseGuards(JwtAuthGuard)
  reorderClasses(
    @Param('id') id: string,
    @Body() body: { classIds: string[] },
    @Request() req,
  ) {
    const userId = req.user.sub || req.user._id?.toString();
    return this.playlistsService.reorderClassesInPlaylist(
      id,
      body.classIds,
      userId,
      req.user.role,
    );
  }
}
