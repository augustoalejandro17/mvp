import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/services/apiClient';
import { ISchool, IUser } from '@inti/shared-types';
import ManageFormField from '@/components/manage/ManageFormField';
import ManageHeader from '@/components/manage/ManageHeader';
import ManageMediaField from '@/components/manage/ManageMediaField';
import ManageSummaryCard from '@/components/manage/ManageSummaryCard';
import ManageToggleField from '@/components/manage/ManageToggleField';
import { pickImageFromDevice } from '@/services/mediaPicker';
import { useAuth } from '@/contexts/AuthContext';

const normalizeList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const candidates = [
      (value as any).items,
      (value as any).data,
      (value as any).results,
      (value as any).users,
      (value as any).schools,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }
  return [];
};

const getEntityId = (entity: any): string => {
  const raw = entity?._id ?? entity?.id ?? entity;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.toString === 'function') {
    const value = String(raw.toString());
    return value === '[object Object]' ? '' : value;
  }
  return '';
};

export default function EditSchoolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const schoolId = Array.isArray(id) ? id[0] : id;
  const currentRole = String((user as any)?.role || '').toLowerCase();
  const canChangeOwner =
    currentRole === 'super_admin' || currentRole === 'admin';

  const [school, setSchool] = useState<ISchool | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [allUsers, setAllUsers] = useState<IUser[]>([]);
  const [originalOwnerId, setOriginalOwnerId] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!schoolId) {
        Alert.alert('Error', 'No se pudo identificar la escuela.');
        router.back();
        setIsLoading(false);
        return;
      }
      try {
        const [data, usersData] = await Promise.all([
          apiClient.getSchoolById(schoolId),
          canChangeOwner ? apiClient.getUsers().catch(() => [] as IUser[]) : [],
        ]);
        setSchool(data);
        setName(data.name ?? '');
        setDescription(data.description ?? '');
        setLogoUrl(typeof (data as any).logoUrl === 'string' ? (data as any).logoUrl : '');
        setAddress(data.address ?? '');
        setPhone((data as any).phone ?? '');
        setWebsite((data as any).website ?? '');
        setIsPublic((data as any).isPublic ?? true);
        const ownerId = getEntityId((data as any).admin);
        setOriginalOwnerId(ownerId);
        setSelectedOwnerId(ownerId);
        setAllUsers(
          canChangeOwner
            ? normalizeList<IUser>(usersData).filter(
                (entry) => String(entry.role || '').toLowerCase() !== 'unregistered',
              )
            : [],
        );
      } catch {
        Alert.alert('Error', 'No se pudo cargar la escuela');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [canChangeOwner, schoolId, router]);

  const filteredOwnerCandidates = allUsers.filter((entry) => {
    const term = ownerSearch.trim().toLowerCase();
    if (!term) return true;
    const nameValue = String(entry.name || '').toLowerCase();
    const emailValue = String(entry.email || '').toLowerCase();
    return nameValue.includes(term) || emailValue.includes(term);
  });
  const visibleOwnerCandidates = filteredOwnerCandidates.slice(0, 12);
  const selectedOwner =
    allUsers.find((entry) => getEntityId(entry) === selectedOwnerId) || null;

  const handlePickLogo = async () => {
    try {
      const file = await pickImageFromDevice();
      if (!file) return;
      setIsUploadingImage(true);
      const uploadedUrl = await apiClient.uploadImage(file);
      if (!uploadedUrl || typeof uploadedUrl !== 'string') {
        throw new Error('No se pudo obtener la URL de la imagen subida.');
      }
      setLogoUrl(uploadedUrl);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo subir la imagen';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!schoolId) {
      Alert.alert('Error', 'No se pudo identificar la escuela.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    setIsSaving(true);
    try {
      const safeLogoUrl = typeof logoUrl === 'string' ? logoUrl.trim() : '';
      await apiClient.updateSchool(schoolId, {
        name: name.trim(),
        description: description.trim(),
        logoUrl: safeLogoUrl || undefined,
        address: address.trim(),
        phone: phone.trim(),
        website: website.trim(),
        isPublic,
      });
      if (
        canChangeOwner &&
        selectedOwnerId &&
        selectedOwnerId !== originalOwnerId
      ) {
        await apiClient.assignSchoolOwner(schoolId, selectedOwnerId);
      }
      Alert.alert('Guardado', 'Escuela actualizada correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.message ||
        'No se pudo guardar';
      Alert.alert('Error', Array.isArray(message) ? message.join('\n') : String(message));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-amber-50 justify-center items-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-amber-50"
    >
      <ScrollView
        className="flex-1 bg-amber-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <ManageHeader
          sectionLabel="Gestión de Escuelas"
          title="Editar Escuela"
          onBack={() => router.back()}
        />

        <View className="px-4 -mt-3">
          <ManageSummaryCard
            icon="school-outline"
            title={name || school?.name || 'Escuela'}
            subtitle="Actualiza los datos principales"
          />

          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
          >
            <Text className="text-gray-900 font-bold text-base mb-3">Información general</Text>
            <ManageFormField
              label="Nombre *"
              icon="text-outline"
              value={name}
              onChangeText={setName}
              placeholder="Nombre de la escuela"
            />
            <ManageFormField
              label="Descripción"
              icon="chatbubble-ellipses-outline"
              value={description}
              onChangeText={setDescription}
              placeholder="Breve descripción de la escuela"
              multiline
            />
            <ManageMediaField
              label="Logo de la escuela"
              helperText="JPG, PNG, WEBP o GIF (máx. 5MB)"
              mediaType="image"
              previewUrl={logoUrl || undefined}
              selectedFileName={logoUrl ? 'Logo cargado' : undefined}
              isUploading={isUploadingImage}
              onPick={handlePickLogo}
              onClear={() => setLogoUrl('')}
            />

            <Text className="text-gray-900 font-bold text-base mb-3 mt-1">Contacto</Text>
            <ManageFormField
              label="Dirección"
              icon="location-outline"
              value={address}
              onChangeText={setAddress}
              placeholder="Dirección física"
            />
            <ManageFormField
              label="Teléfono"
              icon="call-outline"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (000) 000-0000"
              keyboardType="phone-pad"
            />
            <ManageFormField
              label="Sitio Web"
              icon="globe-outline"
              value={website}
              onChangeText={setWebsite}
              placeholder="https://..."
              keyboardType="url"
            />

            <ManageToggleField
              icon="eye-outline"
              label="Escuela pública"
              description="Visible para todos los usuarios"
              value={isPublic}
              onValueChange={setIsPublic}
            />
          </View>

          {canChangeOwner && (
            <View
              className="bg-white rounded-2xl p-4 mb-4"
              style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
            >
              <Text className="text-gray-900 font-bold text-base mb-2">
                Owner de la escuela
              </Text>
              <Text className="text-gray-500 text-sm mb-3">
                Puedes transferir la propiedad a otro usuario desde esta pantalla.
              </Text>

              {selectedOwner ? (
                <View className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-3">
                  <Text className="text-amber-900 font-semibold text-sm">
                    Owner seleccionado
                  </Text>
                  <Text className="text-gray-900 font-bold text-base mt-1">
                    {selectedOwner.name}
                  </Text>
                  <Text className="text-gray-500 text-sm mt-0.5">
                    {selectedOwner.email}
                  </Text>
                </View>
              ) : null}

              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 mb-3">
                <Ionicons name="search-outline" size={18} color="#9ca3af" />
                <TextInput
                  value={ownerSearch}
                  onChangeText={setOwnerSearch}
                  placeholder="Buscar usuario por nombre o email"
                  placeholderTextColor="#9ca3af"
                  className="flex-1 py-3 ml-2 text-gray-900 text-base"
                />
              </View>

              <View className="rounded-2xl overflow-hidden border border-gray-100">
                {visibleOwnerCandidates.length === 0 ? (
                  <View className="px-4 py-4 bg-gray-50">
                    <Text className="text-gray-500 text-sm">
                      No encontramos usuarios para asignar como owner.
                    </Text>
                  </View>
                ) : (
                  visibleOwnerCandidates.map((entry, index) => {
                    const entryId = getEntityId(entry);
                    const isActive = entryId === selectedOwnerId;

                    return (
                      <TouchableOpacity
                        key={entryId || `${entry.email}-${index}`}
                        onPress={() => setSelectedOwnerId(entryId)}
                        className="px-4 py-3 bg-white"
                        style={{
                          borderBottomWidth:
                            index === visibleOwnerCandidates.length - 1 ? 0 : 1,
                          borderBottomColor: '#f3f4f6',
                        }}
                      >
                        <View className="flex-row items-center">
                          <View
                            className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
                            style={{ backgroundColor: isActive ? '#fef3c7' : '#f3f4f6' }}
                          >
                            <Ionicons
                              name={isActive ? 'checkmark-circle' : 'person-outline'}
                              size={18}
                              color={isActive ? '#d97706' : '#6b7280'}
                            />
                          </View>
                          <View className="flex-1">
                            <Text className="text-gray-900 font-semibold text-sm">
                              {entry.name}
                            </Text>
                            <Text className="text-gray-500 text-xs mt-0.5">
                              {entry.email}
                            </Text>
                          </View>
                          {isActive && (
                            <Text className="text-amber-700 text-xs font-bold">
                              Seleccionado
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="bg-amber-500 rounded-2xl py-4 items-center mb-4"
            style={{ opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="save-outline" size={18} color="white" />
                <Text className="text-white font-bold text-base ml-2">Guardar Cambios</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
