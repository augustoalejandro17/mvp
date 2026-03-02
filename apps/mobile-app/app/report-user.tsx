import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { apiClient, UserReportReason } from '@/services/apiClient';

const REASONS: Array<{ value: UserReportReason; label: string; description: string }> = [
  { value: 'harassment', label: 'Acoso o intimidación', description: 'Insultos, amenazas o comportamiento abusivo.' },
  { value: 'hate', label: 'Discurso de odio', description: 'Contenido contra personas por su identidad.' },
  { value: 'impersonation', label: 'Suplantación', description: 'Se hace pasar por otra persona.' },
  { value: 'scam', label: 'Estafa o fraude', description: 'Solicita dinero o datos de forma engañosa.' },
  { value: 'sexual', label: 'Conducta sexual inapropiada', description: 'Contenido o conducta sexual no permitida.' },
  { value: 'violence', label: 'Amenazas o violencia', description: 'Promueve o amenaza con violencia.' },
  { value: 'spam', label: 'Spam', description: 'Mensajes repetitivos o promocionales abusivos.' },
  { value: 'other', label: 'Otro', description: 'Otro motivo no listado.' },
];

export default function ReportUserScreen() {
  const params = useLocalSearchParams<{ userId?: string; userName?: string }>();
  const userId = useMemo(() => (typeof params.userId === 'string' ? params.userId.trim() : ''), [params.userId]);
  const userName = useMemo(() => (typeof params.userName === 'string' ? params.userName : 'usuario'), [params.userName]);

  const [reason, setReason] = useState<UserReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!userId) {
      Alert.alert('Error', 'No se pudo identificar al usuario a denunciar.');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.createUserReport({
        reportedUserId: userId,
        reason,
        details: details.trim() || undefined,
      });

      Alert.alert(
        'Gracias por reportar',
        'Recibimos tu denuncia y nuestro equipo revisará el caso.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo enviar la denuncia.';
      Alert.alert('Error', Array.isArray(message) ? message.join('\n') : String(message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: 'Denunciar usuario' }} />
      <ScrollView className="flex-1 px-5 py-5">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Denunciar usuario</Text>
        <Text className="text-gray-600 mb-4">
          Denunciarás a <Text className="font-semibold text-gray-900">{userName}</Text>.
        </Text>

        <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
          <Text className="text-amber-900 text-sm">
            Este reporte será revisado por moderadores. Evita incluir datos sensibles innecesarios.
          </Text>
        </View>

        <Text className="text-gray-900 font-semibold mb-2">Motivo</Text>
        <View className="gap-2 mb-5">
          {REASONS.map((item) => {
            const selected = reason === item.value;
            return (
              <Pressable
                key={item.value}
                className={`rounded-xl border px-3 py-3 ${selected ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                onPress={() => setReason(item.value)}
              >
                <Text className={`font-semibold ${selected ? 'text-red-700' : 'text-gray-900'}`}>{item.label}</Text>
                <Text className={`text-xs mt-1 ${selected ? 'text-red-600' : 'text-gray-600'}`}>{item.description}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="text-gray-900 font-semibold mb-2">Detalles (opcional)</Text>
        <TextInput
          className="border border-gray-300 rounded-xl p-3 text-gray-900 min-h-[120px]"
          multiline
          maxLength={1000}
          placeholder="Explica brevemente qué ocurrió..."
          placeholderTextColor="#9ca3af"
          value={details}
          onChangeText={setDetails}
          textAlignVertical="top"
        />

        <Pressable
          className={`mt-6 rounded-xl py-3.5 items-center ${submitting ? 'bg-red-300' : 'bg-red-600'}`}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text className="text-white font-semibold">
            {submitting ? 'Enviando denuncia...' : 'Enviar denuncia'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
