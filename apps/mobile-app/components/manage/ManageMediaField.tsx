import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ManageMediaFieldProps {
  label: string;
  helperText?: string;
  mediaType: 'image' | 'video';
  previewUrl?: string;
  selectedFileName?: string;
  isUploading?: boolean;
  imagePreviewAspectRatio?: number;
  imagePreviewResizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onPick: () => void;
  onClear?: () => void;
}

export default function ManageMediaField({
  label,
  helperText,
  mediaType,
  previewUrl,
  selectedFileName,
  isUploading,
  imagePreviewAspectRatio = 16 / 9,
  imagePreviewResizeMode = 'cover',
  onPick,
  onClear,
}: ManageMediaFieldProps) {
  const normalizedPreviewUrl = typeof previewUrl === 'string' ? previewUrl.trim() : '';
  const hasContent = Boolean(normalizedPreviewUrl || selectedFileName);
  const iconName = mediaType === 'image' ? 'image-outline' : 'videocam-outline';
  const buttonLabel =
    mediaType === 'image' ? 'Seleccionar y encuadrar imagen' : 'Seleccionar video';

  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-semibold text-sm mb-2">{label}</Text>

      <View className="bg-gray-50 border border-gray-200 rounded-xl p-3">
        <View className="flex-row items-center">
          <View className="w-9 h-9 rounded-lg bg-amber-100 items-center justify-center mr-2">
            <Ionicons name={iconName as any} size={18} color="#b45309" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-semibold text-sm">
              {hasContent ? 'Archivo seleccionado' : 'Sin archivo'}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
              {selectedFileName || helperText || 'Selecciona un archivo desde tu dispositivo'}
            </Text>
          </View>
          {onClear && hasContent && !isUploading ? (
            <TouchableOpacity
              onPress={onClear}
              className="p-2 rounded-lg bg-red-50 border border-red-100"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color="#dc2626" />
            </TouchableOpacity>
          ) : null}
        </View>

        {mediaType === 'image' && normalizedPreviewUrl ? (
          <Image
            source={{ uri: normalizedPreviewUrl }}
            style={{
              width: '100%',
              aspectRatio: imagePreviewAspectRatio,
              borderRadius: 12,
              marginTop: 12,
              backgroundColor: '#ffffff',
            }}
            resizeMode={imagePreviewResizeMode}
          />
        ) : null}

        <TouchableOpacity
          onPress={onPick}
          disabled={Boolean(isUploading)}
          className="mt-3 bg-white border border-gray-200 rounded-xl py-2.5 items-center"
          style={{ opacity: isUploading ? 0.7 : 1 }}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#d97706" />
          ) : (
            <Text className="text-gray-800 font-semibold text-sm">{buttonLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
