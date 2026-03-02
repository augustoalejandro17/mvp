import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryDocument> {
    try {
      // If parentCategory is provided, verify it exists
      if (createCategoryDto.parentCategory) {
        const parentExists = await this.categoryModel.findById(
          createCategoryDto.parentCategory,
        );
        if (!parentExists) {
          throw new BadRequestException('Parent category not found');
        }
      }

      const category = new this.categoryModel(createCategoryDto);
      return await category.save();
    } catch (error) {
      this.logger.error(
        `Error creating category: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findAll(): Promise<CategoryDocument[]> {
    return this.categoryModel
      .find({ isActive: true })
      .populate('parentCategory', 'name')
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findAllHierarchical(): Promise<any[]> {
    // Get all active categories
    const allCategories = await this.categoryModel
      .find({ isActive: true })
      .populate('parentCategory', 'name')
      .sort({ sortOrder: 1, name: 1 })
      .exec();

    // Build hierarchical structure
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    // First pass: create map of all categories
    allCategories.forEach((category) => {
      categoryMap.set(category._id.toString(), {
        ...category.toObject(),
        children: [],
      });
    });

    // Second pass: build hierarchy
    allCategories.forEach((category) => {
      const categoryWithChildren = categoryMap.get(category._id.toString());

      if (category.parentCategory && (category.parentCategory as any)._id) {
        const parentId = (category.parentCategory as any)._id.toString();
        const parent = categoryMap.get(parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        } else {
          // Parent not found or inactive, treat as root
          rootCategories.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  }

  async findByParent(parentId?: string): Promise<CategoryDocument[]> {
    const query = parentId
      ? { parentCategory: parentId, isActive: true }
      : { parentCategory: null, isActive: true };

    return this.categoryModel
      .find(query)
      .populate('parentCategory', 'name')
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findRootCategories(): Promise<CategoryDocument[]> {
    return this.findByParent();
  }

  async findSubcategories(parentId: string): Promise<CategoryDocument[]> {
    return this.findByParent(parentId);
  }

  async findOne(id: string): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID');
    }

    const category = await this.categoryModel
      .findById(id)
      .populate('parentCategory', 'name')
      .exec();

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID');
    }

    // Prevent circular references
    if (
      updateCategoryDto.parentCategory &&
      updateCategoryDto.parentCategory === id
    ) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    // If updating parent, verify it exists and doesn't create circular reference
    if (updateCategoryDto.parentCategory) {
      const parentExists = await this.categoryModel.findById(
        updateCategoryDto.parentCategory,
      );
      if (!parentExists) {
        throw new BadRequestException('Parent category not found');
      }

      // Check for circular reference by checking if the new parent is a descendant
      const isCircular = await this.wouldCreateCircularReference(
        id,
        updateCategoryDto.parentCategory,
      );
      if (isCircular) {
        throw new BadRequestException(
          'Cannot create circular reference in category hierarchy',
        );
      }
    }

    const category = await this.categoryModel
      .findByIdAndUpdate(id, updateCategoryDto, { new: true })
      .populate('parentCategory', 'name')
      .exec();

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID');
    }

    // Check if category has children
    const hasChildren = await this.categoryModel.countDocuments({
      parentCategory: id,
      isActive: true,
    });
    if (hasChildren > 0) {
      throw new BadRequestException(
        'Cannot delete category with active subcategories',
      );
    }

    // Soft delete by setting isActive to false
    const category = await this.categoryModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
  }

  async hardDelete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID');
    }

    // Check if category has children
    const hasChildren = await this.categoryModel.countDocuments({
      parentCategory: id,
    });
    if (hasChildren > 0) {
      throw new BadRequestException(
        'Cannot delete category with subcategories',
      );
    }

    const result = await this.categoryModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
  }

  private async wouldCreateCircularReference(
    categoryId: string,
    newParentId: string,
  ): Promise<boolean> {
    // Check if newParentId is a descendant of categoryId
    const descendants = await this.getAllDescendants(categoryId);
    return descendants.some((desc) => desc._id.toString() === newParentId);
  }

  private async getAllDescendants(
    categoryId: string,
  ): Promise<CategoryDocument[]> {
    const children = await this.categoryModel
      .find({ parentCategory: categoryId })
      .exec();
    let allDescendants: CategoryDocument[] = [...children];

    for (const child of children) {
      const grandChildren = await this.getAllDescendants(child._id.toString());
      allDescendants = [...allDescendants, ...grandChildren];
    }

    return allDescendants;
  }
}
