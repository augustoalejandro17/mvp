import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  apiClient,
  ReportContentType,
  ReportReason,
} from '@/services/apiClient';

const REASONS: Array<{ value: ReportReason; label: string; description: string }> = [
  { value: 'spam', label: 'Spam', description: 'Contenido irrelevante o repetitivo' },
  { value: 'harassment', label: 'Acoso', description: 'Ataques o intimidación' },
  { value: 'hate', label: 'Discurso de odio', description: 'Promueve odio o discriminación' },
  { value: 'sexual', label: 'Contenido sexual', description: 'Contenido sexual inapropiado' },
  { value: 'violence', label: 'Violencia', description: 'Promueve violencia o daño' },
  { value: 'misinformation', label: 'Desinformación', description: 'Información engañosa o falsa' },
  { value: 'copyright', label: 'Copyright', description: 'Uso no autorizado de contenido protegido' },
  { value: 'other', label: 'Otro', description: 'Otro motivo' },
];

const VALID_CONTENT_TYPES: ReportContentType[] = ['class', 'course', 'school'];

export default function ReportContentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    contentType?: string;
    contentId?: string;
    contentTitle?: string;
  }>();

  const contentType = useMemo<ReportContentType>(() => {
    const incoming = (params.contentType || '').toLowerCase();
    return VALID_CONTENT_TYPES.includes(incoming as ReportContentType)
      ? (incoming as ReportContentType)
      : 'class';
  }, [params.contentType]);

  const contentId = params.contentId ?? '';
  const contentTitle = params.contentTitle ?? '';

  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!contentId) {
      Alert.alert('Error', 'No se pudo identificar el contenido a reportar.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.createContentReport({
        contentType,
        contentId,
        reason,
        contentTitle: contentTitle || undefined,
        details: details.trim() || undefined,
      });

      Alert.alert(
        'Gracias por reportar',
        'Recibimos tu denuncia y la revisaremos a la brevedad.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      Alert.alert(
        'No se pudo enviar',
        Array.isArray(msg) ? msg.join('\n') : msg || 'Intenta de nuevo en unos minutos.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-amber-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="bg-amber-500 px-5 pt-6 pb-8">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-xs opacity-80 mb-1">
                Seguridad y Moderación
              </Text>
              <Text className="text-white text-xl font-bold">Denunciar Contenido</Text>
            </View>
          </View>
        </View>

        <View className="px-4 -mt-4 pb-8">
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text className="text-gray-500 text-xs uppercase tracking-wide mb-1">
              Contenido
            </Text>
            <Text className="text-gray-900 font-semibold">
              {contentTitle || `${contentType} #${contentId.slice(0, 8)}`}
            </Text>
            <Text className="text-gray-500 text-xs mt-1">Tipo: {contentType}</Text>
          </View>

          <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-100">
            <Text className="text-gray-900 font-bold text-base mb-3">
              Motivo de la denuncia
            </Text>
            {REASONS.map((item) => {
              const selected = reason === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setReason(item.value)}
                  className={`rounded-xl px-3 py-3 mb-2 border ${
                    selected ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <View className="flex-row items-start">
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selected ? '#d97706' : '#9ca3af'}
                    />
                    <View className="ml-2 flex-1">
                      <Text className="text-gray-900 font-semibold">{item.label}</Text>
                      <Text className="text-gray-500 text-xs mt-0.5">{item.description}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-100">
            <Text className="text-gray-900 font-bold text-base mb-2">
              Detalles adicionales (opcional)
            </Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Describe brevemente por qué reportas este contenido..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              maxLength={1000}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
              style={{ minHeight: 110, textAlignVertical: 'top' }}
            />
            <Text className="text-xs text-gray-400 mt-1 text-right">
              {details.length}/1000
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className="bg-red-500 rounded-2xl py-4 items-center"
            style={{ opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Enviar Denuncia</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
