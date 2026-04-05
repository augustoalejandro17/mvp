import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';

const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
  'video/x-matroska',
  'video/3gpp',
  'video/ogg',
  'video/x-m4v',
];

const ALLOWED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mpeg',
  '.mpg',
  '.mkv',
  '.3gp',
  '.ogv',
  '.m4v',
];

export const isAllowedVideoFile = (file: Express.Multer.File): boolean => {
  const mimeType = String(file.mimetype || '').toLowerCase();
  const fileName = String(file.originalname || '').toLowerCase();

  const hasAllowedMime = ALLOWED_VIDEO_MIME_TYPES.includes(mimeType);
  const hasAllowedExtension = ALLOWED_VIDEO_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext),
  );

  return hasAllowedMime || hasAllowedExtension;
};

export const videoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: any, acceptFile: boolean) => void,
) => {
  if (isAllowedVideoFile(file)) {
    callback(null, true);
    return;
  }

  callback(
    new BadRequestException(
      `Formato de archivo no soportado: ${file.mimetype}. Se admiten solamente archivos de video.`,
    ),
    false,
  );
};
