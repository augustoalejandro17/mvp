import type { NativeUploadFile } from '@/services/apiClient';

declare const require: (moduleName: string) => any;

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mov',
  'avi',
  'mpeg',
  'mpg',
  'mkv',
  '3gp',
  'ogv',
  'm4v',
]);

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
  ogv: 'video/ogg',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
};

const SUPPORTED_VIDEO_MIME_TYPES = new Set(Object.values(VIDEO_MIME_BY_EXT));

const getFileExtension = (fileName: string): string => {
  const parts = String(fileName || '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
};

const normalizeMimeType = (mimeType: string | null | undefined): string | null => {
  if (!mimeType) {
    return null;
  }
  return mimeType.toLowerCase().split(';')[0].trim();
};

const resolveMimeType = (
  fileName: string,
  explicitMimeType: string | null | undefined,
  fallbackMediaType: 'image' | 'video',
): string => {
  const normalizedMimeType = normalizeMimeType(explicitMimeType);
  if (normalizedMimeType && normalizedMimeType.includes('/')) {
    return normalizedMimeType;
  }

  const ext = getFileExtension(fileName);
  if (fallbackMediaType === 'image') {
    return IMAGE_MIME_BY_EXT[ext] || 'image/jpeg';
  }

  return VIDEO_MIME_BY_EXT[ext] || 'video/mp4';
};

const isSupportedImage = (fileName: string, mimeType: string): boolean => {
  if (SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    return true;
  }
  const ext = getFileExtension(fileName);
  return SUPPORTED_IMAGE_EXTENSIONS.has(ext);
};

const isSupportedVideo = (fileName: string, mimeType: string): boolean => {
  if (SUPPORTED_VIDEO_MIME_TYPES.has(mimeType)) {
    return true;
  }
  const ext = getFileExtension(fileName);
  return SUPPORTED_VIDEO_EXTENSIONS.has(ext);
};

const loadDocumentPicker = () => {
  try {
    return require('expo-document-picker');
  } catch {
    throw new Error(
      'No se encontró expo-document-picker. Instala la dependencia en apps/mobile-app para habilitar selección de archivos en móvil.',
    );
  }
};

export async function pickImageFromDevice(): Promise<NativeUploadFile | null> {
  const DocumentPicker = loadDocumentPicker();
  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (!result || result.canceled || !Array.isArray(result.assets) || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const name = asset.name || `image-${Date.now()}.jpg`;
  const type = resolveMimeType(name, asset.mimeType, 'image');
  const size = typeof asset.size === 'number' ? asset.size : undefined;

  if (!asset.uri || typeof asset.uri !== 'string') {
    throw new Error('No se pudo leer el archivo de imagen seleccionado.');
  }

  if (!isSupportedImage(name, type)) {
    throw new Error(
      'Formato no compatible. Usa JPG, PNG, WEBP o GIF.',
    );
  }

  if (typeof size === 'number' && size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('La imagen supera el límite de 5MB.');
  }

  return {
    uri: asset.uri,
    name,
    type,
    size,
  };
}

export async function pickVideoFromDevice(): Promise<NativeUploadFile | null> {
  const DocumentPicker = loadDocumentPicker();
  const result = await DocumentPicker.getDocumentAsync({
    type: 'video/*',
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (!result || result.canceled || !Array.isArray(result.assets) || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const name = asset.name || `video-${Date.now()}.mp4`;
  const type = resolveMimeType(name, asset.mimeType, 'video');
  const size = typeof asset.size === 'number' ? asset.size : undefined;

  if (!asset.uri || typeof asset.uri !== 'string') {
    throw new Error('No se pudo leer el archivo de video seleccionado.');
  }

  if (!isSupportedVideo(name, type)) {
    throw new Error(
      'Formato no compatible. Usa MP4, WEBM, MOV, AVI, MPEG, MPG, MKV, 3GP, OGV o M4V.',
    );
  }

  if (typeof size === 'number' && size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error('El video supera el límite de 200MB.');
  }

  return {
    uri: asset.uri,
    name,
    type,
    size,
  };
}
