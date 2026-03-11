import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/services/apiClient';
import { IClass } from '@inti/shared-types';

export default function EditPlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const playlistId = Array.isArray(id) ? id[0] : id;

  const [playlist, setPlaylist] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!playlistId) {
        Alert.alert('Error', 'No se pudo identificar la lista.');
        router.back();
        setIsLoading(false);
        return;
      }
      try {
        const data = await apiClient.getPlaylistById(playlistId);
        setPlaylist(data);
        setName(data.name ?? '');
        setDescription(data.description ?? '');
        setIsPublic(data.isPublic ?? true);
      } catch {
        Alert.alert('Error', 'No se pudo cargar la lista');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [playlistId, router]);

  const handleSave = async () => {
    if (!playlistId) { Alert.alert('Error', 'No se pudo identificar la lista.'); return; }
    if (!name.trim()) { Alert.alert('Error', 'El nombre es requerido'); return; }
    setIsSaving(true);
    try {
      await apiClient.updatePlaylist(playlistId, { name: name.trim(), description: description.trim() || undefined, isPublic });
      Alert.alert('Guardado', 'Lista actualizada', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!playlistId) {
      Alert.alert('Error', 'No se pudo identificar la lista.');
      return;
    }
    Alert.alert('Eliminar Lista', `¿Eliminar "${name}"? Las clases no se eliminarán.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            await apiClient.deletePlaylist(playlistId);
            router.back();
          } catch {
            Alert.alert('Error', 'No se pudo eliminar');
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  const handleRemoveClass = (classItem: IClass) => {
    if (!playlistId) {
      Alert.alert('Error', 'No se pudo identificar la lista.');
      return;
    }
    Alert.alert('Quitar Clase', `¿Quitar "${classItem.title}" de esta lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        onPress: async () => {
          try {
            await apiClient.removeClassFromPlaylist(playlistId, classItem._id!);
            setPlaylist((prev: any) => ({
              ...prev,
              classes: Array.isArray(prev?.classes)
                ? prev.classes.filter((c: IClass) => c._id !== classItem._id)
                : [],
            }));
          } catch {
            Alert.alert('Error', 'No se pudo quitar la clase');
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return <View className="flex-1 bg-amber-50 justify-center items-center"><ActivityIndicator size="large" color="#f59e0b" /></View>;
  }

  const classes: IClass[] = playlist?.classes ?? [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 bg-amber-50" showsVerticalScrollIndicator={false}>
        <View className="bg-amber-500 px-5 pt-5 pb-8 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xs opacity-80 mb-1">Listas de Reproducción</Text>
            <Text className="text-white text-xl font-bold" numberOfLines={1}>{playlist?.name ?? 'Editar Lista'}</Text>
          </View>
          <TouchableOpacity onPress={handleDelete} disabled={isDeleting} className="bg-white/20 p-2 rounded-xl">
            {isDeleting ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="trash-outline" size={20} color="white" />}
          </TouchableOpacity>
        </View>

        <View className="px-4 -mt-4">
          {/* Edit form */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
            <Text className="text-gray-900 font-bold text-base mb-4">Información</Text>
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">Nombre *</Text>
              <TextInput value={name} onChangeText={setName} placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base" />
            </View>
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">Descripción</Text>
              <TextInput value={description} onChangeText={setDescription} placeholder="Descripción opcional"
                placeholderTextColor="#9ca3af" multiline numberOfLines={3}
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                style={{ minHeight: 80, textAlignVertical: 'top' }} />
            </View>
            <View className="flex-row items-center justify-between py-3 border-t border-gray-100">
              <View>
                <Text className="text-gray-800 font-semibold text-base">Lista pública</Text>
                <Text className="text-gray-500 text-xs mt-0.5">Visible para los estudiantes</Text>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic}
                trackColor={{ false: '#e5e7eb', true: '#fbbf24' }} thumbColor={isPublic ? '#f59e0b' : '#f3f4f6'} />
            </View>
          </View>

          <TouchableOpacity onPress={handleSave} disabled={isSaving}
            className="bg-amber-500 rounded-2xl py-4 items-center mb-4" style={{ opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Guardar Cambios</Text>}
          </TouchableOpacity>

          {/* Classes in this playlist */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-gray-900 font-bold text-base">Clases en esta Lista</Text>
              <View className="bg-amber-100 px-2.5 py-1 rounded-full">
                <Text className="text-amber-700 text-xs font-semibold">{classes.length}</Text>
              </View>
            </View>
            {classes.length === 0 ? (
              <View className="py-6 items-center">
                <Ionicons name="videocam-outline" size={32} color="#d1d5db" />
                <Text className="text-gray-400 text-sm mt-2">No hay clases en esta lista</Text>
                <Text className="text-gray-400 text-xs mt-1 text-center">Agrega clases desde el panel web</Text>
              </View>
            ) : (
              classes.map((classItem) => (
                <View key={classItem._id} className="flex-row items-center py-3 border-b border-gray-50">
                  <View className="w-8 h-8 bg-green-50 rounded-lg justify-center items-center mr-3">
                    <Ionicons name="play-circle" size={18} color="#16a34a" />
                  </View>
                  <Text className="flex-1 text-gray-800 text-sm font-medium" numberOfLines={1}>{classItem.title}</Text>
                  <TouchableOpacity onPress={() => handleRemoveClass(classItem)}
                    className="p-1.5 bg-red-50 rounded-lg ml-2" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="remove-circle-outline" size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
          <View className="h-4" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
