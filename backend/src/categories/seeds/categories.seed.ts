import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../schemas/category.schema';

@Injectable()
export class CategoriesSeedService {
  private readonly logger = new Logger(CategoriesSeedService.name);

  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async seedCategories(): Promise<void> {
    this.logger.log('Starting categories seeding...');

    const existingCategories = await this.categoryModel.countDocuments();
    if (existingCategories > 0) {
      this.logger.log('Categories already exist, skipping seed');
      return;
    }

    const categoryData = [
      {
        name: 'Danza',
        description: 'Categorías relacionadas con la danza',
        color: '#FF6B6B',
        icon: '💃',
        sortOrder: 1,
        subcategories: [
          { name: 'Urban', description: 'Danza urbana y hip-hop', color: '#4ECDC4', sortOrder: 1 },
          { name: 'Heels', description: 'Danza en tacones', color: '#45B7D1', sortOrder: 2 },
          { name: 'Ballet', description: 'Ballet clásico', color: '#F7DC6F', sortOrder: 3 },
        ]
      },
      {
        name: 'Música',
        description: 'Categorías relacionadas con la música',
        color: '#9B59B6',
        icon: '🎵',
        sortOrder: 2,
        subcategories: [
          { name: 'Clásico', description: 'Música clásica', color: '#D5A6BD', sortOrder: 1 },
          { name: 'Rock', description: 'Música rock', color: '#5D6D7E', sortOrder: 2 },
          { name: 'Pop', description: 'Música pop', color: '#F1948A', sortOrder: 3 },
        ]
      },
      {
        name: 'Arte',
        description: 'Categorías relacionadas con las artes visuales',
        color: '#E67E22',
        icon: '🎨',
        sortOrder: 3,
        subcategories: [
          { name: 'Pintura', description: 'Técnicas de pintura', color: '#F39C12', sortOrder: 1 },
          { name: 'Escultura', description: 'Arte escultórico', color: '#D68910', sortOrder: 2 },
        ]
      }
    ];

    for (const categoryGroup of categoryData) {
      try {
        const parentCategory = new this.categoryModel({
          name: categoryGroup.name,
          description: categoryGroup.description,
          color: categoryGroup.color,
          icon: categoryGroup.icon,
          sortOrder: categoryGroup.sortOrder,
          parentCategory: null,
        });

        const savedParent = await parentCategory.save();
        this.logger.log(`Created parent category: ${savedParent.name}`);

        for (const subcategory of categoryGroup.subcategories) {
          const subCat = new this.categoryModel({
            name: subcategory.name,
            description: subcategory.description,
            color: subcategory.color,
            sortOrder: subcategory.sortOrder,
            parentCategory: savedParent._id,
          });

          const savedSub = await subCat.save();
          this.logger.log(`Created subcategory: ${savedSub.name}`);
        }
      } catch (error) {
        this.logger.error(`Error creating category ${categoryGroup.name}:`, error);
      }
    }

    this.logger.log('Categories seeding completed');
  }
} 