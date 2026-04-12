import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  IClass,
  IClassSubmission,
  SubmissionReviewStatus,
  VideoStatus,
} from '@inti/shared-types';

interface VideoCardProps {
  classItem: IClass;
  onPress: () => void;
  submission?: IClassSubmission | null;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToPlaylist?: () => void;
}

const STATUS_CONFIG: Record<VideoStatus, { icon: string; label: string; color: string; bg: string }> = {
  [VideoStatus.READY]: { icon: 'play-circle', label: 'Ver ahora', color: '#16a34a', bg: '#f0fdf4' },
  [VideoStatus.PROCESSING]: { icon: 'time', label: 'Procesando', color: '#d97706', bg: '#fffbeb' },
  [VideoStatus.UPLOADING]: { icon: 'cloud-upload', label: 'Subiendo', color: '#6b7280', bg: '#f9fafb' },
  [VideoStatus.ERROR]: { icon: 'alert-circle', label: 'Error', color: '#dc2626', bg: '#fef2f2' },
};

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export default function VideoCard({
  classItem,
  onPress,
  submission,
  isAdmin,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveToPlaylist,
}: VideoCardProps) {
  const status = STATUS_CONFIG[classItem.videoStatus] ?? STATUS_CONFIG[VideoStatus.UPLOADING];
  const isReady = classItem.videoStatus === VideoStatus.READY;
  const duration = formatDuration(classItem.videoMetadata?.duration);

  const submissionSummary = (() => {
    if (!submission) {
      return null;
    }

    if (submission.reviewStatus === SubmissionReviewStatus.NEEDS_RESUBMISSION) {
      return {
        icon: 'refresh-circle',
        label: 'Reenvio solicitado',
        color: '#9a3412',
        bg: '#fff7ed',
      };
    }

    if (submission.reviewStatus === SubmissionReviewStatus.REVIEWED) {
      return {
        icon: 'chatbubble-ellipses',
        label:
          submission.annotationsCount && submission.annotationsCount > 0
            ? `${submission.annotationsCount} anotaciones`
            : 'Revisada',
        color: '#166534',
        bg: '#f0fdf4',
      };
    }

    if (submission.videoStatus === VideoStatus.PROCESSING) {
      return {
        icon: 'time',
        label: 'Práctica procesándose',
        color: '#b45309',
        bg: '#fffbeb',
      };
    }

    return {
      icon: 'videocam',
      label: 'Práctica enviada',
      color: '#1d4ed8',
      bg: '#eff6ff',
    };
  })();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="bg-white rounded-xl mb-3 overflow-hidden border border-gray-100"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8 }}
    >
      <View className="flex-row p-4">
        {/* Thumbnail */}
        <View
          className="w-24 h-16 rounded-lg justify-center items-center mr-4"
          style={{ backgroundColor: status.bg }}
        >
          <Ionicons name={status.icon as any} size={28} color={status.color} />
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text className="text-gray-900 font-semibold text-sm leading-5 mb-1" numberOfLines={2}>
            {classItem.title}
          </Text>
          {classItem.description ? (
            <Text className="text-gray-400 text-xs mb-2" numberOfLines={1}>
              {classItem.description}
            </Text>
          ) : null}

          <View className="flex-row items-center">
            {duration ? (
              <View className="flex-row items-center mr-3">
                <Ionicons name="time-outline" size={12} color="#9ca3af" />
                <Text className="text-gray-400 text-xs ml-0.5">{duration}</Text>
              </View>
            ) : null}
            <View className="flex-row items-center">
              <Ionicons name={status.icon as any} size={12} color={status.color} />
              <Text className="text-xs ml-0.5 font-medium" style={{ color: status.color }}>
                {status.label}
              </Text>
            </View>
            {!classItem.isPublic && (
              <View className="flex-row items-center ml-2">
                <Ionicons name="lock-closed" size={11} color="#9ca3af" />
                <Text className="text-gray-400 text-xs ml-0.5">Privada</Text>
              </View>
            )}
          </View>

          {submissionSummary && !isAdmin && (
            <View
              className="flex-row items-center self-start mt-2 px-2.5 py-1 rounded-full"
              style={{ backgroundColor: submissionSummary.bg }}
            >
              <Ionicons
                name={submissionSummary.icon as any}
                size={12}
                color={submissionSummary.color}
              />
              <Text
                className="text-xs font-semibold ml-1.5"
                style={{ color: submissionSummary.color }}
              >
                {submissionSummary.label}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View className="justify-center ml-2">
          {isAdmin ? (
            <View className="flex-row items-center" style={{ gap: 4 }}>
              {(onMoveUp || onMoveDown) && (
                <View className="flex-col items-center" style={{ gap: 4 }}>
                  <TouchableOpacity
                    onPress={onMoveUp}
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: onMoveUp ? '#f0f9ff' : '#f9fafb' }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    disabled={!onMoveUp}
                  >
                    <Ionicons name="chevron-up" size={16} color={onMoveUp ? '#0ea5e9' : '#d1d5db'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onMoveDown}
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: onMoveDown ? '#f0f9ff' : '#f9fafb' }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    disabled={!onMoveDown}
                  >
                    <Ionicons name="chevron-down" size={16} color={onMoveDown ? '#0ea5e9' : '#d1d5db'} />
                  </TouchableOpacity>
                </View>
              )}
              <View className="flex-col items-center" style={{ gap: 4 }}>
                {onMoveToPlaylist && (
                  <TouchableOpacity
                    onPress={onMoveToPlaylist}
                    className="p-1.5 bg-blue-50 rounded-lg"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="swap-horizontal" size={16} color="#3b82f6" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={onEdit}
                  className="p-1.5 bg-amber-50 rounded-lg"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="create-outline" size={16} color="#d97706" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onDelete}
                  className="p-1.5 bg-red-50 rounded-lg"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Ionicons
              name={isReady ? 'play-circle' : 'chevron-forward'}
              size={isReady ? 28 : 18}
              color={isReady ? '#d97706' : '#d1d5db'}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
