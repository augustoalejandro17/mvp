import type { NativeUploadFile } from '@/services/apiClient';

declare const require: (moduleName: string) => any;

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

const getFileExtension = (fileName: string): string => {
  const parts = String(fileName || '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
};

const resolveMimeType = (
  fileName: string,
  explicitMimeType: string | null | undefined,
  fallbackMediaType: 'image' | 'video',
): string => {
  if (explicitMimeType && explicitMimeType.includes('/')) {
    return explicitMimeType;
  }

  const ext = getFileExtension(fileName);
  if (fallbackMediaType === 'image') {
    return IMAGE_MIME_BY_EXT[ext] || 'image/jpeg';
  }

  return VIDEO_MIME_BY_EXT[ext] || 'video/mp4';
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

  return {
    uri: asset.uri,
    name,
    type,
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

  return {
    uri: asset.uri,
    name,
    type,
  };
}
