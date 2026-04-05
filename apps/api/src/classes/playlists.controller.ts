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
import { PlaylistsFacade } from './services/playlists.facade';
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
  constructor(private readonly playlistsFacade: PlaylistsFacade) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createPlaylistDto: CreatePlaylistDto, @Request() req) {
    return this.playlistsFacade.create(createPlaylistDto, req);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findByCourse(@Query('courseId') courseId: string, @Request() req) {
    return this.playlistsFacade.findByCourse(courseId, req);
  }

  @Get('unorganized')
  @UseGuards(OptionalJwtAuthGuard)
  getUnorganizedClasses(@Query('courseId') courseId: string, @Request() req) {
    return this.playlistsFacade.getUnorganizedClasses(courseId, req);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.playlistsFacade.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
    @Request() req,
  ) {
    return this.playlistsFacade.update(id, updatePlaylistDto, req);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() req) {
    return this.playlistsFacade.remove(id, req);
  }

  @Post(':id/add-class')
  @UseGuards(JwtAuthGuard)
  addClassToPlaylist(
    @Param('id') id: string,
    @Body() addClassDto: AddClassToPlaylistDto,
    @Request() req,
  ) {
    return this.playlistsFacade.addClassToPlaylist(
      id,
      addClassDto,
      req,
    );
  }

  @Post(':id/remove-class')
  @UseGuards(JwtAuthGuard)
  removeClassFromPlaylist(
    @Param('id') id: string,
    @Body() removeClassDto: RemoveClassFromPlaylistDto,
    @Request() req,
  ) {
    return this.playlistsFacade.removeClassFromPlaylist(
      id,
      removeClassDto,
      req,
    );
  }

  @Post('default')
  @UseGuards(JwtAuthGuard)
  createDefaultPlaylist(@Body() body: { courseId: string }, @Request() req) {
    return this.playlistsFacade.createDefaultPlaylist(
      body.courseId,
      req,
    );
  }

  @Post('reorder-course')
  @UseGuards(JwtAuthGuard)
  reorderPlaylistsInCourse(
    @Body() body: { courseId: string; playlistIds: string[] },
    @Request() req,
  ) {
    return this.playlistsFacade.reorderPlaylistsInCourse(
      body.courseId,
      body.playlistIds,
      req,
    );
  }

  @Post(':id/reorder')
  @UseGuards(JwtAuthGuard)
  reorderClasses(
    @Param('id') id: string,
    @Body() body: { classIds: string[] },
    @Request() req,
  ) {
    return this.playlistsFacade.reorderClasses(
      id,
      body.classIds,
      req,
    );
  }
}
