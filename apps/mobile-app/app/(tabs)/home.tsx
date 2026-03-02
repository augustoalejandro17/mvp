import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ICourse, IClass, ISchool, UserRole } from '@inti/shared-types';
import { apiClient } from '@/services/apiClient';
import VideoCard from '@/components/VideoCard';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

type ViewLevel = 'schools' | 'courses' | 'classes';

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SCHOOL_OWNER];

// ─── School Card ──────────────────────────────────────────────────────────────
function SchoolCard({
  school,
  onPress,
  isAdmin,
  onEdit,
  onDelete,
}: {
  school: ISchool;
  onPress: () => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="bg-white rounded-xl mb-3 border border-gray-100 overflow-hidden"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 }}
    >
      <View className="h-1.5 bg-amber-400" />
      <View className="p-4">
        <View className="flex-row items-center">
          <View className="w-12 h-12 bg-amber-50 rounded-xl justify-center items-center mr-3">
            {school.logoUrl ? (
              <Image
                source={{ uri: school.logoUrl }}
                style={{ width: 40, height: 40, borderRadius: 8 }}
                resizeMode="contain"
              />
            ) : (
              <Ionicons name="school" size={24} color="#d97706" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
              {school.name}
            </Text>
            {school.address ? (
              <View className="flex-row items-center mt-0.5">
                <Ionicons name="location-outline" size={12} color="#9ca3af" />
                <Text className="text-xs text-gray-400 ml-1" numberOfLines={1}>
                  {school.address}
                </Text>
              </View>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#d97706" />
        </View>
        {school.description ? (
          <Text className="text-gray-500 text-sm mt-3" numberOfLines={2}>
            {school.description}
          </Text>
        ) : null}
        <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50">
          <Ionicons name="book-outline" size={13} color="#d97706" />
          <Text className="text-amber-700 text-xs font-medium ml-1">Ver cursos</Text>
          <View className="flex-1" />
          {isAdmin ? (
            <View className="flex-row items-center">
              <TouchableOpacity onPress={onEdit} className="p-1.5 mr-1 bg-amber-50 rounded-lg" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={16} color="#d97706" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} className="p-1.5 bg-red-50 rounded-lg" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={14} color="#d97706" />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Course Card ──────────────────────────────────────────────────────────────
function CourseCard({
  course,
  isEnrolled,
  isAdmin,
  onPress,
  onEdit,
  onDelete,
}: {
  course: ICourse;
  isEnrolled: boolean;
  isAdmin?: boolean;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="bg-white rounded-xl mb-3 border border-gray-100 overflow-hidden"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 }}
    >
      {/* Cover image */}
      {(course as any).coverImageUrl ? (
        <View style={{ height: 120, backgroundColor: '#f3f4f6' }}>
          <Image
            source={{ uri: (course as any).coverImageUrl }}
            style={{ width: '100%', height: 120 }}
            resizeMode="cover"
          />
          {isEnrolled && (
            <View className="absolute top-2 right-2 bg-green-500 px-2 py-1 rounded-full">
              <Text className="text-white text-xs font-semibold">Inscrito</Text>
            </View>
          )}
          {!(course as any).isPublic && (
            <View className="absolute top-2 left-2 bg-gray-800/70 px-2 py-1 rounded-full flex-row items-center">
              <Ionicons name="lock-closed" size={10} color="white" />
              <Text className="text-white text-xs ml-1">Privado</Text>
            </View>
          )}
        </View>
      ) : null}
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-base font-bold text-gray-900" numberOfLines={2}>
              {course.title}
            </Text>
            {course.description ? (
              <Text className="text-gray-500 text-sm mt-1" numberOfLines={2}>
                {course.description}
              </Text>
            ) : null}
          </View>
          {isEnrolled && !(course as any).coverImageUrl && (
            <View className="bg-green-100 px-2 py-1 rounded-full">
              <Text className="text-green-700 text-xs font-semibold">Inscrito</Text>
            </View>
          )}
        </View>
        <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50">
          {course.classes && course.classes.length > 0 ? (
            <>
              <Ionicons name="videocam-outline" size={13} color="#d97706" />
              <Text className="text-amber-700 text-xs font-medium ml-1">
                {course.classes.length} {course.classes.length === 1 ? 'clase' : 'clases'}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="videocam-outline" size={13} color="#9ca3af" />
              <Text className="text-gray-400 text-xs ml-1">Ver clases</Text>
            </>
          )}
          <View className="flex-1" />
          {isAdmin ? (
            <View className="flex-row items-center">
              <TouchableOpacity onPress={onEdit} className="p-1.5 mr-1 bg-amber-50 rounded-lg" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={16} color="#d97706" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} className="p-1.5 bg-red-50 rounded-lg" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={14} color="#d97706" />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const isAdmin = user?.role && ADMIN_ROLES.includes(user.role as UserRole);

  const [level, setLevel] = useState<ViewLevel>('schools');
  const [schools, setSchools] = useState<ISchool[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<ICourse[]>([]);
  const [courses, setCourses] = useState<ICourse[]>([]);
  const [classes, setClasses] = useState<IClass[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [unorganizedClasses, setUnorganizedClasses] = useState<IClass[]>([]);
  const [expandedPlaylists, setExpandedPlaylists] = useState<Record<string, boolean>>({});
  const [moveModalClass, setMoveModalClass] = useState<IClass | null>(null);
  const [moveModalFromPlaylist, setMoveModalFromPlaylist] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<ISchool | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<ICourse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchools = useCallback(async () => {
    setError(null);
    try {
      const [schoolsData, enrolledData] = await Promise.all([
        isAdmin ? apiClient.getAllSchools() : apiClient.getPublicSchools(),
        apiClient.getEnrolledCourses().catch(() => [] as ICourse[]),
      ]);
      setSchools(schoolsData);
      setEnrolledCourses(enrolledData);
    } catch (e: any) {
      setError(e?.message || 'No se pudo conectar al servidor');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAdmin]);

  const handleDeleteSchool = (school: ISchool) => {
    Alert.alert(
      'Eliminar Escuela',
      `¿Eliminar "${school.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteSchool(school._id!);
              setSchools((prev) => prev.filter((s) => s._id !== school._id));
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la escuela');
            }
          },
        },
      ],
    );
  };

  const handleDeleteCourse = (course: ICourse) => {
    Alert.alert(
      'Eliminar Curso',
      `¿Eliminar "${course.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteCourse(course._id!);
              setCourses((prev) => prev.filter((c) => c._id !== course._id));
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el curso');
            }
          },
        },
      ],
    );
  };

  const handleDeleteClass = (classItem: IClass) => {
    Alert.alert(
      'Eliminar Clase',
      `¿Eliminar "${classItem.title}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteClass(classItem._id!);
              setClasses((prev) => prev.filter((c) => c._id !== classItem._id));
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la clase');
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  const handleSelectSchool = async (school: ISchool) => {
    setSelectedSchool(school);
    setSelectedCourse(null);
    setClasses([]);
    setLevel('courses');
    setIsLoadingCourses(true);
    try {
      const data = await apiClient.getCoursesBySchool(school._id!);
      setCourses(data);
    } catch {
      setCourses([]);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const handleSelectCourse = async (course: ICourse) => {
    setSelectedCourse(course);
    setLevel('classes');
    setIsLoadingClasses(true);
    setPlaylists([]);
    setUnorganizedClasses([]);
    setExpandedPlaylists({});
    try {
      const [playlistData, unorganized] = await Promise.all([
        apiClient.getPlaylists(course._id!),
        apiClient.getUnorganizedClasses(course._id!),
      ]);
      setPlaylists(playlistData);
      setUnorganizedClasses(unorganized);
      // Expand all playlists + unorganized by default
      const expanded: Record<string, boolean> = { '__unorganized__': true };
      playlistData.forEach((p: any) => { expanded[p._id] = true; });
      setExpandedPlaylists(expanded);
      // Still set flat list for backwards compat
      const allClasses = [
        ...playlistData.flatMap((p: any) => p.classes ?? []),
        ...unorganized,
      ];
      setClasses(allClasses);
    } catch {
      // Fallback to flat list
      try {
        const data = await apiClient.getClassesByCourse(course._id!);
        setClasses(data);
      } catch {
        setClasses([]);
      }
    } finally {
      setIsLoadingClasses(false);
    }
  };

  const togglePlaylist = (playlistId: string) => {
    setExpandedPlaylists((prev) => ({ ...prev, [playlistId]: !prev[playlistId] }));
  };

  const movePlaylist = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= playlists.length) return;
    const prev = [...playlists];
    const next = [...playlists];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setPlaylists(next);
    try {
      await apiClient.reorderPlaylistsInCourse(selectedCourse!._id!, next.map((p) => p._id));
    } catch {
      setPlaylists(prev);
      Alert.alert('Error', 'No se pudo reordenar las listas');
    }
  };

  const handleMoveClass = async (targetPlaylistId: string) => {
    if (!moveModalClass) return;
    const classItem = moveModalClass;
    const fromPlaylist = moveModalFromPlaylist;
    setMoveModalClass(null);
    setMoveModalFromPlaylist(null);

    // Optimistic update
    if (fromPlaylist) {
      // Moving from one playlist to another
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p._id === fromPlaylist) return { ...p, classes: (p.classes ?? []).filter((c: IClass) => c._id !== classItem._id) };
          if (p._id === targetPlaylistId) return { ...p, classes: [...(p.classes ?? []), classItem] };
          return p;
        }),
      );
      try {
        await apiClient.removeClassFromPlaylist(fromPlaylist, classItem._id!);
        await apiClient.addClassToPlaylist(targetPlaylistId, classItem._id!);
        const updated = await apiClient.getPlaylists(selectedCourse!._id!);
        setPlaylists(updated);
      } catch {
        Alert.alert('Error', 'No se pudo mover la clase');
        const reverted = await apiClient.getPlaylists(selectedCourse!._id!).catch(() => playlists);
        setPlaylists(reverted);
      }
    } else {
      // Moving from unorganized to a playlist
      setUnorganizedClasses((prev) => prev.filter((c) => c._id !== classItem._id));
      setPlaylists((prev) =>
        prev.map((p) => p._id === targetPlaylistId ? { ...p, classes: [...(p.classes ?? []), classItem] } : p),
      );
      try {
        await apiClient.addClassToPlaylist(targetPlaylistId, classItem._id!);
        const [updated, updatedUnorganized] = await Promise.all([
          apiClient.getPlaylists(selectedCourse!._id!),
          apiClient.getUnorganizedClasses(selectedCourse!._id!),
        ]);
        setPlaylists(updated);
        setUnorganizedClasses(updatedUnorganized);
      } catch {
        Alert.alert('Error', 'No se pudo mover la clase');
        const [reverted, revertedUnorg] = await Promise.all([
          apiClient.getPlaylists(selectedCourse!._id!).catch(() => playlists),
          apiClient.getUnorganizedClasses(selectedCourse!._id!).catch(() => unorganizedClasses),
        ]);
        setPlaylists(reverted);
        setUnorganizedClasses(revertedUnorg);
      }
    }
  };

  const moveClassInPlaylist = async (playlistId: string, classIndex: number, direction: 'up' | 'down') => {
    const playlist = playlists.find((p) => p._id === playlistId);
    if (!playlist) return;
    const prevClasses = [...(playlist.classes ?? [])];
    const nextClasses = [...prevClasses];
    const swapIndex = direction === 'up' ? classIndex - 1 : classIndex + 1;
    if (swapIndex < 0 || swapIndex >= nextClasses.length) return;
    [nextClasses[classIndex], nextClasses[swapIndex]] = [nextClasses[swapIndex], nextClasses[classIndex]];
    const prevPlaylists = [...playlists];
    setPlaylists(playlists.map((p) => p._id === playlistId ? { ...p, classes: nextClasses } : p));
    try {
      await apiClient.reorderClassesInPlaylist(playlistId, nextClasses.map((c: IClass) => c._id!));
    } catch {
      setPlaylists(prevPlaylists);
      Alert.alert('Error', 'No se pudo reordenar las clases');
    }
  };

  const handleBack = () => {
    if (level === 'classes') {
      setLevel('courses');
      setSelectedCourse(null);
    } else if (level === 'courses') {
      setLevel('schools');
      setSelectedSchool(null);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    setLevel('schools');
    setSelectedSchool(null);
    setSelectedCourse(null);
    loadSchools();
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-amber-50">
        <ActivityIndicator size="large" color="#d97706" />
        <Text className="mt-4 text-gray-500">Cargando escuelas...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-amber-50">
      {/* Breadcrumb */}
      {level !== 'schools' && (
        <TouchableOpacity
          onPress={handleBack}
          className="flex-row items-center px-4 py-3 bg-white border-b border-amber-100"
        >
          <Ionicons name="arrow-back" size={18} color="#d97706" />
          <Text className="text-amber-700 font-medium ml-2">
            {level === 'courses' ? 'Escuelas' : selectedSchool?.name ?? 'Cursos'}
          </Text>
          {level === 'classes' && (
            <>
              <Ionicons name="chevron-forward" size={14} color="#9ca3af" style={{ marginHorizontal: 4 }} />
              <Text className="text-gray-500 text-sm flex-1" numberOfLines={1}>
                {selectedCourse?.title}
          </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Schools */}
      {level === 'schools' && (
        <FlatList
          data={schools}
          keyExtractor={(s) => s._id || Math.random().toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#d97706" />
          }
          ListHeaderComponent={
            <>
              <View className="bg-white rounded-xl p-4 mb-4 border border-amber-100">
                <Text className="text-xl font-bold text-gray-900">
                  ¡Hola, {user?.name?.split(' ')[0] || 'Estudiante'}!
                </Text>
                <Text className="text-gray-500 mt-0.5 text-sm">
                  Explora las escuelas disponibles
                </Text>
              </View>

              {enrolledCourses.length > 0 && (
                <View className="mb-4">
                  <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                    Mis cursos inscritos
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {enrolledCourses.map((c) => (
                      <TouchableOpacity
                        key={c._id}
                        onPress={() => handleSelectCourse(c)}
                        className="bg-amber-500 rounded-xl p-3 mr-3"
                        style={{ width: 160 }}
                      >
                        <Ionicons name="play-circle" size={24} color="white" />
                        <Text className="text-white font-semibold text-sm mt-2" numberOfLines={2}>
                          {c.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {error && (
                <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="wifi-outline" size={16} color="#dc2626" />
                    <Text className="text-red-700 font-semibold ml-2 text-sm">Sin conexión</Text>
                  </View>
                  <Text className="text-red-500 text-xs">{error}</Text>
                  <TouchableOpacity
                    onPress={loadSchools}
                    className="mt-2 self-start flex-row items-center bg-red-600 px-3 py-1.5 rounded-lg"
                  >
                    <Ionicons name="refresh" size={14} color="white" />
                    <Text className="text-white text-xs font-semibold ml-1">Reintentar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isAdmin && (
                <TouchableOpacity
                  onPress={() => router.push('/manage/school/new')}
                  className="flex-row items-center justify-center bg-amber-500 rounded-xl py-3 mb-3"
                >
                  <Ionicons name="add-circle-outline" size={18} color="white" />
                  <Text className="text-white font-semibold ml-2">Nueva Escuela</Text>
                </TouchableOpacity>
              )}

              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                {isAdmin ? 'Todas las Escuelas' : 'Escuelas Disponibles'}
              </Text>
            </>
          }
          ListEmptyComponent={
            !error ? (
              <View className="items-center pt-12">
                <Ionicons name="school-outline" size={56} color="#d97706" />
                <Text className="text-lg font-semibold text-gray-700 mt-4">No hay escuelas</Text>
                <Text className="text-gray-500 mt-1 text-center text-sm">
                  Aún no hay escuelas públicas registradas
                </Text>
            </View>
            ) : null
          }
          renderItem={({ item: school }) => (
            <SchoolCard
              school={school}
              isAdmin={!!isAdmin}
              onPress={() => handleSelectSchool(school)}
              onEdit={() => router.push(`/manage/school/${school._id}`)}
              onDelete={() => handleDeleteSchool(school)}
            />
          )}
        />
      )}

      {/* Courses */}
      {level === 'courses' && (
        <View className="flex-1">
          <View className="bg-white px-4 py-4 border-b border-amber-100">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-amber-50 rounded-xl justify-center items-center mr-3">
                <Ionicons name="school" size={20} color="#d97706" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
                  {selectedSchool?.name}
                </Text>
                <Text className="text-xs text-gray-500">Elige un curso para explorar</Text>
              </View>
            </View>
          </View>

          {isLoadingCourses ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#d97706" />
              <Text className="text-gray-500 mt-3">Cargando cursos...</Text>
            </View>
          ) : courses.length === 0 ? (
            <View className="flex-1 justify-center items-center px-8">
              <Ionicons name="book-outline" size={56} color="#d97706" />
              <Text className="text-lg font-semibold text-gray-700 mt-4">Sin cursos</Text>
              <Text className="text-gray-500 mt-1 text-center text-sm">
                Esta escuela aún no tiene cursos publicados
              </Text>
            </View>
          ) : (
            <FlatList
              data={courses}
              keyExtractor={(c) => c._id || Math.random().toString()}
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                isAdmin ? (
                  <TouchableOpacity
                    onPress={() => router.push(`/manage/course/new?schoolId=${selectedSchool?._id}`)}
                    className="flex-row items-center justify-center bg-amber-500 rounded-xl py-3 mb-4"
                  >
                    <Ionicons name="add-circle-outline" size={18} color="white" />
                    <Text className="text-white font-semibold ml-2">Nuevo Curso</Text>
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item: course }) => (
                <CourseCard
                  course={course}
                  isEnrolled={enrolledCourses.some((e) => e._id === course._id)}
                  isAdmin={!!isAdmin}
                  onPress={() => handleSelectCourse(course)}
                  onEdit={() => router.push(`/manage/course/${course._id}`)}
                  onDelete={() => handleDeleteCourse(course)}
                />
              )}
            />
          )}
        </View>
      )}

      {/* Classes */}
      {level === 'classes' && (
        <View className="flex-1">
          <View className="bg-white px-4 py-4 border-b border-amber-100">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
                  {selectedCourse?.title}
                </Text>
                {selectedCourse?.description ? (
                  <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={2}>
                    {selectedCourse.description}
                  </Text>
                ) : null}
              </View>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => router.push(`/manage/class/new?courseId=${selectedCourse?._id}`)}
                  className="flex-row items-center bg-amber-500 px-3 py-2 rounded-xl"
                >
                  <Ionicons name="add" size={16} color="white" />
                  <Text className="text-white text-xs font-semibold ml-1">Nueva Clase</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {isLoadingClasses ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#d97706" />
              <Text className="text-gray-500 mt-3">Cargando clases...</Text>
            </View>
          ) : playlists.length === 0 && unorganizedClasses.length === 0 && classes.length === 0 ? (
            <View className="flex-1 justify-center items-center px-8">
              <Ionicons name="videocam-outline" size={56} color="#d97706" />
              <Text className="text-lg font-semibold text-gray-700 mt-4">Sin clases</Text>
              <Text className="text-gray-500 mt-1 text-center text-sm">
                {isAdmin
                  ? 'Este curso no tiene clases. Toca "Nueva Clase" para agregar.'
                  : 'Este curso aún no tiene clases disponibles'}
              </Text>
            </View>
          ) : playlists.length > 0 ? (
            /* ── Playlist-organized view ── */
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => router.push(`/manage/playlist/new?courseId=${selectedCourse?._id}`)}
                  className="flex-row items-center justify-center border-2 border-dashed border-amber-300 rounded-xl py-3 mb-4"
                >
                  <Ionicons name="list" size={16} color="#d97706" />
                  <Text className="text-amber-700 font-semibold ml-2 text-sm">Nueva Lista de Reproducción</Text>
                </TouchableOpacity>
              )}

              {playlists.map((playlist: any, playlistIndex: number) => (
                <View key={playlist._id} className="mb-3">
                  {/* Playlist header */}
                  <TouchableOpacity
                    onPress={() => togglePlaylist(playlist._id)}
                    className="flex-row items-center bg-white rounded-xl px-4 py-3 border border-gray-100"
                    style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}
                  >
                    <View className="w-1 h-8 rounded-full bg-amber-400 mr-3" />
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text className="text-gray-900 font-bold text-sm flex-1">{playlist.name}</Text>
                        {!playlist.isPublic && (
                          <View className="flex-row items-center bg-gray-100 px-2 py-0.5 rounded-full ml-2">
                            <Ionicons name="lock-closed" size={10} color="#6b7280" />
                            <Text className="text-gray-500 text-xs ml-1">Privada</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-gray-400 text-xs mt-0.5">
                        {(playlist.classes?.length ?? 0)} {playlist.classes?.length === 1 ? 'clase' : 'clases'}
                      </Text>
                    </View>
                    <View className="flex-row items-center ml-2" style={{ gap: 4 }}>
                      {isAdmin && (
                        <>
                          {/* Reorder playlist ↑↓ */}
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation?.(); movePlaylist(playlistIndex, 'up'); }}
                            className="p-1.5 rounded-lg"
                            style={{ backgroundColor: playlistIndex > 0 ? '#f0f9ff' : '#f9fafb' }}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            disabled={playlistIndex === 0}
                          >
                            <Ionicons name="arrow-up" size={14} color={playlistIndex > 0 ? '#0ea5e9' : '#d1d5db'} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation?.(); movePlaylist(playlistIndex, 'down'); }}
                            className="p-1.5 rounded-lg mr-1"
                            style={{ backgroundColor: playlistIndex < playlists.length - 1 ? '#f0f9ff' : '#f9fafb' }}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            disabled={playlistIndex === playlists.length - 1}
                          >
                            <Ionicons name="arrow-down" size={14} color={playlistIndex < playlists.length - 1 ? '#0ea5e9' : '#d1d5db'} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => router.push(`/manage/playlist/${playlist._id}`)}
                            className="p-1.5 bg-amber-50 rounded-lg"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="create-outline" size={15} color="#d97706" />
                          </TouchableOpacity>
                        </>
                      )}
                      <Ionicons
                        name={expandedPlaylists[playlist._id] ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#9ca3af"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Classes in playlist */}
                  {expandedPlaylists[playlist._id] && (playlist.classes ?? []).length > 0 && (
                    <View className="mt-1 ml-4">
                      {(playlist.classes ?? []).map((classItem: IClass, classIndex: number) => (
                        <VideoCard
                          key={classItem._id}
                          classItem={classItem}
                          isAdmin={!!isAdmin}
                          onPress={() => router.push(`/player/${classItem._id}?courseId=${selectedCourse?._id}`)}
                          onEdit={() => router.push(`/manage/class/${classItem._id}`)}
                          onDelete={() => handleDeleteClass(classItem)}
                          onMoveUp={isAdmin && classIndex > 0 ? () => moveClassInPlaylist(playlist._id, classIndex, 'up') : undefined}
                          onMoveDown={isAdmin && classIndex < (playlist.classes?.length ?? 0) - 1 ? () => moveClassInPlaylist(playlist._id, classIndex, 'down') : undefined}
                          onMoveToPlaylist={isAdmin && playlists.length > 1 ? () => { setMoveModalClass(classItem); setMoveModalFromPlaylist(playlist._id); } : undefined}
                        />
                      ))}
                    </View>
                  )}
                  {expandedPlaylists[playlist._id] && (playlist.classes ?? []).length === 0 && (
                    <View className="mt-1 ml-4 bg-gray-50 rounded-xl py-4 items-center">
                      <Text className="text-gray-400 text-sm">Sin clases en esta lista</Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Unorganized classes — collapsible */}
              {unorganizedClasses.length > 0 && (
                <View className="mt-2 mb-3">
                  <TouchableOpacity
                    onPress={() => togglePlaylist('__unorganized__')}
                    className="flex-row items-center bg-white rounded-xl px-4 py-3 border border-gray-100"
                    style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}
                  >
                    <View className="w-1 h-8 rounded-full bg-gray-300 mr-3" />
                    <View className="flex-1">
                      <Text className="text-gray-700 font-bold text-sm">Sin organizar</Text>
                      <Text className="text-gray-400 text-xs mt-0.5">
                        {unorganizedClasses.length} {unorganizedClasses.length === 1 ? 'clase' : 'clases'}
                      </Text>
                    </View>
                    <Ionicons
                      name={expandedPlaylists['__unorganized__'] ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>

                  {expandedPlaylists['__unorganized__'] && (
                    <View className="mt-1 ml-4">
                      {unorganizedClasses.map((classItem) => (
                        <VideoCard
                          key={classItem._id}
                          classItem={classItem}
                          isAdmin={!!isAdmin}
                          onPress={() => router.push(`/player/${classItem._id}?courseId=${selectedCourse?._id}`)}
                          onEdit={() => router.push(`/manage/class/${classItem._id}`)}
                          onDelete={() => handleDeleteClass(classItem)}
                          onMoveToPlaylist={isAdmin && playlists.length > 0 ? () => { setMoveModalClass(classItem); setMoveModalFromPlaylist(null); } : undefined}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          ) : (
            /* ── Flat list fallback (no playlists yet) ── */
            <FlatList
              data={classes}
              keyExtractor={(item) => item._id || Math.random().toString()}
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                isAdmin ? (
                  <TouchableOpacity
                    onPress={() => router.push(`/manage/playlist/new?courseId=${selectedCourse?._id}`)}
                    className="flex-row items-center justify-center border-2 border-dashed border-amber-300 rounded-xl py-3 mb-4"
                  >
                    <Ionicons name="list" size={16} color="#d97706" />
                    <Text className="text-amber-700 font-semibold ml-2 text-sm">Nueva Lista de Reproducción</Text>
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item }) => (
                <VideoCard
                  classItem={item}
                  isAdmin={!!isAdmin}
                  onPress={() => router.push(`/player/${item._id}?courseId=${selectedCourse?._id}`)}
                  onEdit={() => router.push(`/manage/class/${item._id}`)}
                  onDelete={() => handleDeleteClass(item)}
                />
              )}
            />
          )}
        </View>
      )}

      {/* ── Move to playlist modal ── */}
      <Modal
        visible={!!moveModalClass}
        transparent
        animationType="slide"
        onRequestClose={() => { setMoveModalClass(null); setMoveModalFromPlaylist(null); }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={() => { setMoveModalClass(null); setMoveModalFromPlaylist(null); }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10">
              {/* Handle */}
              <View className="w-10 h-1 bg-gray-200 rounded-full self-center mb-4" />
              <Text className="text-base font-bold text-gray-900 mb-1">Mover clase a lista</Text>
              <Text className="text-xs text-gray-500 mb-4" numberOfLines={1}>
                {moveModalClass?.title}
              </Text>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {playlists
                  .filter((p) => p._id !== moveModalFromPlaylist)
                  .map((p) => (
                    <TouchableOpacity
                      key={p._id}
                      onPress={() => handleMoveClass(p._id)}
                      className="flex-row items-center py-3.5 border-b border-gray-50"
                      activeOpacity={0.7}
                    >
                      <View className="w-8 h-8 bg-amber-50 rounded-lg justify-center items-center mr-3">
                        <Ionicons name="list" size={16} color="#d97706" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-gray-900 font-semibold text-sm">{p.name}</Text>
                        <Text className="text-gray-400 text-xs">
                          {p.classes?.length ?? 0} {p.classes?.length === 1 ? 'clase' : 'clases'}
                        </Text>
                      </View>
                      {!p.isPublic && (
                        <View className="flex-row items-center bg-gray-100 px-2 py-0.5 rounded-full ml-2">
                          <Ionicons name="lock-closed" size={9} color="#6b7280" />
                          <Text className="text-gray-500 text-xs ml-1">Privada</Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={16} color="#d97706" className="ml-2" />
                    </TouchableOpacity>
                  ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => { setMoveModalClass(null); setMoveModalFromPlaylist(null); }}
                className="mt-4 py-3 bg-gray-100 rounded-xl items-center"
              >
                <Text className="text-gray-600 font-semibold text-sm">Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
