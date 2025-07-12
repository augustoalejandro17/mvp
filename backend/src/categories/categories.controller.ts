import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Logger,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { CategoriesSeedService } from './seeds/categories.seed';

@Controller('categories')
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly categoriesSeedService: CategoriesSeedService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    this.logger.log(`Creating category: ${createCategoryDto.name}`);
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  async findAll(@Query('hierarchical') hierarchical?: string) {
    if (hierarchical === 'true') {
      this.logger.log('Fetching categories in hierarchical structure');
      return this.categoriesService.findAllHierarchical();
    }

    this.logger.log('Fetching all categories');
    return this.categoriesService.findAll();
  }

  @Get('root')
  async findRootCategories() {
    this.logger.log('Fetching root categories');
    return this.categoriesService.findRootCategories();
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async seedDefaultCategories() {
    this.logger.log('Seeding default categories...');
    await this.categoriesSeedService.seedCategories();
    return { message: 'Default categories seeded successfully' };
  }

  @Get('subcategories/:parentId')
  async findSubcategories(@Param('parentId') parentId: string) {
    this.logger.log(`Fetching subcategories for parent: ${parentId}`);
    return this.categoriesService.findSubcategories(parentId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.log(`Fetching category: ${id}`);
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    this.logger.log(`Updating category: ${id}`);
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SCHOOL_OWNER)
  async remove(@Param('id') id: string) {
    this.logger.log(`Soft deleting category: ${id}`);
    return this.categoriesService.remove(id);
  }

  @Delete(':id/hard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async hardDelete(@Param('id') id: string) {
    this.logger.log(`Hard deleting category: ${id}`);
    return this.categoriesService.hardDelete(id);
  }
}
