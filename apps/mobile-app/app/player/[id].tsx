import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StatusBar,
  Animated,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { IClass, VideoStatus } from '@inti/shared-types';
import { apiClient } from '@/services/apiClient';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const CONTROLS_HIDE_MS = 3500;
const DOUBLE_TAP_MS = 300;
const SKIP_SECS = 10;

const fmt = (ms: number) => {
  const t = Math.floor(ms / 1000);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ── Seek bar ─────────────────────────────────────────────────────────────────
interface SeekBarProps {
  progressRatio: number;
  durationMs: number;
  isScrubbing: React.MutableRefObject<boolean>;
  suppressVideoTapUntil: React.MutableRefObject<number>;
  scrubPositionMs: number | null;
  positionMs: number;
  setScrubPositionMs: (v: number | null) => void;
  seekToPosition: (ms: number) => Promise<void>;
}

function SeekBar({
  progressRatio,
  durationMs,
  isScrubbing,
  suppressVideoTapUntil,
  scrubPositionMs,
  positionMs,
  setScrubPositionMs,
  seekToPosition,
}: SeekBarProps) {
  const widthRef = useRef(0);
  const scrubbing = isScrubbing?.current ?? false;
  const barHeight = 44;
  const trackHeight = 4;
  const thumbSize = scrubbing ? 18 : 14;
  const thumbOffset = scrubbing ? -9 : -7;
  const thumbTop = (barHeight - thumbSize) / 2;
  const commitSeek = (targetMs: number) => {
    setScrubPositionMs(targetMs);
    void (async () => {
      try {
        await seekToPosition(targetMs);
      } finally {
        setScrubPositionMs(null);
        isScrubbing.current = false;
      }
    })();
  };

  return (
    <View
      onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
      style={{ width: '100%', height: barHeight, justifyContent: 'center' }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        suppressVideoTapUntil.current = Date.now() + 250;
        if (!durationMs) return;
        const w = widthRef.current;
        if (!w) return;
        isScrubbing.current = true;
        const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
        const posMs = Math.round(ratio * durationMs);
        setScrubPositionMs(posMs);
      }}
      onResponderMove={(e) => {
        if (!durationMs) return;
        const w = widthRef.current;
        if (!w) return;
        const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
        setScrubPositionMs(Math.round(ratio * durationMs));
      }}
      onResponderRelease={(e) => {
        suppressVideoTapUntil.current = Date.now() + 250;
        if (!durationMs) {
          setScrubPositionMs(null);
          isScrubbing.current = false;
          return;
        }
        const w = widthRef.current;
        if (!w) {
          setScrubPositionMs(null);
          isScrubbing.current = false;
          return;
        }
        const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
        const newPos = Math.round(ratio * durationMs);
        commitSeek(newPos);
      }}
      onResponderTerminate={() => {
        suppressVideoTapUntil.current = Date.now() + 250;
        if (!durationMs) {
          setScrubPositionMs(null);
          isScrubbing.current = false;
          return;
        }
        const fallbackPos = scrubPositionMs ?? positionMs;
        commitSeek(fallbackPos);
      }}
    >
      <View
        pointerEvents="none"
        style={{
          height: trackHeight,
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: trackHeight / 2,
        }}
      >
        <View style={{ height: '100%', width: `${progressRatio * 100}%`, backgroundColor: '#f59e0b', borderRadius: 2 }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: `${progressRatio * 100}%` as any,
          width: thumbSize,
          height: thumbSize,
          borderRadius: thumbSize / 2,
          backgroundColor: '#f59e0b',
          marginLeft: thumbOffset,
          top: thumbTop,
          shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, elevation: 5,
        }}
      />
    </View>
  );
}

// ── Skip feedback pill ────────────────────────────────────────────────────────
function SkipFeedback({
  side,
  count,
  opacity,
}: {
  side: 'left' | 'right';
  count: number;
  opacity: Animated.Value;
}) {
  const secs = count * SKIP_SECS;
  const chevrons = Math.min(count, 3);
  const isLeft = side === 'left';

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [isLeft ? 'left' : 'right']: 0,
        width: '42%',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 60,
      }}
    >
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {Array.from({ length: chevrons }).map((_, i) => (
          <Ionicons
            key={i}
            name={isLeft ? 'play-back' : 'play-forward'}
            size={22}
            color="white"
            style={{ marginHorizontal: -3 }}
          />
        ))}
      </View>
      <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>
        {secs} segundos
      </Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function PlayerScreen() {
  const { id, courseId } = useLocalSearchParams<{ id: string; courseId?: string }>();
  const normalizedClassId = Array.isArray(id) ? id[0] : id;
  const normalizedCourseId = Array.isArray(courseId) ? courseId[0] : courseId;
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const videoRef = useRef<Video>(null);

  // Hide the stack header immediately and on every render
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [classItem, setClassItem] = useState<IClass | null>(null);
  const [courseClasses, setCourseClasses] = useState<IClass[]>([]);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  // ── Playback ──────────────────────────────────────────────────────────────
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [rate, setRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [skipFeedback, setSkipFeedback] = useState<{ side: 'left' | 'right'; count: number } | null>(null);
  const [hasEnded, setHasEnded] = useState(false);
  const [isMarkedComplete, setIsMarkedComplete] = useState(false);
  const [scrubPositionMs, setScrubPositionMs] = useState<number | null>(null);
  const isScrubbing = useRef(false);

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const skipOpacity = useRef(new Animated.Value(0)).current;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef(0);
  const lastTapSide = useRef<'left' | 'right' | null>(null);
  const doubleTapCount = useRef(0);
  const suppressVideoTapUntil = useRef(0);

  // ── Navigation ────────────────────────────────────────────────────────────
  const currentIndex = courseClasses.findIndex((c) => c._id === normalizedClassId);
  const prevClass = currentIndex > 0 ? courseClasses[currentIndex - 1] : null;
  const nextClass =
    currentIndex >= 0 && currentIndex < courseClasses.length - 1
      ? courseClasses[currentIndex + 1]
      : null;

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (classId: string) => {
    setIsLoading(true);
    setStreamUrl(null);
    setStreamError(null);
    setIsVideoReady(false);
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(0);
    setHasEnded(false);

    // Hard timeout: if API doesn't respond in 12s, stop waiting
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('No se pudo conectar al servidor. Verifica tu conexión.')), 12000),
    );

    try {
      const [classData, streamData] = await Promise.race([
        Promise.all([apiClient.getClassById(classId), apiClient.getStreamUrl(classId)]),
        timeout,
      ]) as [any, any];
      setClassItem(classData);
      const directUrl = classData?.videoUrl;
      const fallbackUrl = streamData?.success ? streamData?.url : null;

      if (directUrl) {
        setStreamUrl(directUrl);
      } else if (fallbackUrl) {
        setStreamUrl(fallbackUrl);
      } else {
        setStreamError(streamData?.message || 'Video no disponible');
      }
    } catch (e: any) {
      setStreamError(e?.message || 'Error al cargar el video');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!normalizedCourseId) {
      setCourseClasses([]);
      return;
    }

    apiClient
      .getClassesByCourse(normalizedCourseId)
      .then((value) => {
        if (Array.isArray(value)) {
          setCourseClasses(value);
          return;
        }
        const fallback = (value as any)?.classes;
        setCourseClasses(Array.isArray(fallback) ? fallback : []);
      })
      .catch(() => setCourseClasses([]));
  }, [normalizedCourseId]);

  useEffect(() => {
    if (!normalizedClassId) {
      setClassItem(null);
      setStreamUrl(null);
      setStreamError('No se pudo identificar la clase.');
      setIsLoading(false);
      return;
    }
    load(normalizedClassId);
  }, [normalizedClassId, load]);

  useEffect(() => {
    setIsMarkedComplete(false);
  }, [normalizedClassId]);

  // ── Controls visibility ───────────────────────────────────────────────────
  const revealControls = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(controlsOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    setShowControls(true);
  }, [controlsOpacity]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(
        () => setShowControls(false),
      );
    }, CONTROLS_HIDE_MS);
  }, [controlsOpacity]);

  const showControlsTemporarily = useCallback(() => {
    revealControls();
    scheduleHide();
  }, [revealControls, scheduleHide]);

  const toggleControls = useCallback(() => {
    if (showControls) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.timing(controlsOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(
        () => setShowControls(false),
      );
    } else {
      showControlsTemporarily();
    }
  }, [showControls, controlsOpacity, showControlsTemporarily]);

  useEffect(() => {
    if (!isPlaying) {
      revealControls();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else {
      scheduleHide();
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [isPlaying, revealControls, scheduleHide]);

  // ── Playback status ───────────────────────────────────────────────────────
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (isScrubbing.current) return;
    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis ?? 0);
    if (status.durationMillis) setDurationMs(status.durationMillis);
    if (status.didJustFinish) {
      setHasEnded(true);
      setIsPlaying(false);
      revealControls();
    }
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    isPlaying ? await videoRef.current.pauseAsync() : await videoRef.current.playAsync();
    showControlsTemporarily();
  };

  const handleReplay = async () => {
    if (!videoRef.current) return;
    setHasEnded(false);
    await videoRef.current.setPositionAsync(0);
    await videoRef.current.playAsync();
    scheduleHide();
  };

  // ── Seek ──────────────────────────────────────────────────────────────────
  const seekToPosition = async (targetMs: number) => {
    const player = videoRef.current;
    if (!player || !Number.isFinite(targetMs)) return;

    const bounded = Math.max(0, Math.min(Math.round(targetMs), durationMs || targetMs));
    const shouldResume = isPlaying;
    setPositionMs(bounded);

    try {
      const status = shouldResume
        ? await player.playFromPositionAsync(bounded, {
            toleranceMillisBefore: 0,
            toleranceMillisAfter: 0,
          })
        : await player.setPositionAsync(bounded, {
            toleranceMillisBefore: 0,
            toleranceMillisAfter: 0,
          });
      if (status.isLoaded && typeof status.positionMillis === 'number') {
        setPositionMs(status.positionMillis);
      }
    } catch {
      try {
        const status = await player.setStatusAsync({
          shouldPlay: shouldResume,
          positionMillis: bounded,
          seekMillisToleranceBefore: 0,
          seekMillisToleranceAfter: 0,
        });
        if (status.isLoaded && typeof status.positionMillis === 'number') {
          setPositionMs(status.positionMillis);
        }
      } catch {
        // Keep UI stable even if native seek fails.
      }
    }
  };

  const skip = async (seconds: number) => {
    const newPos = Math.max(0, Math.min(positionMs + seconds * 1000, durationMs));
    await seekToPosition(newPos);
  };

  // ── Skip feedback animation ───────────────────────────────────────────────
  const triggerSkipFeedback = (side: 'left' | 'right', count: number) => {
    setSkipFeedback({ side, count });
    skipOpacity.setValue(1);
    if (skipTimer.current) clearTimeout(skipTimer.current);
    skipTimer.current = setTimeout(() => {
      Animated.timing(skipOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() =>
        setSkipFeedback(null),
      );
    }, 700);
  };

  // ── Double-tap gesture (YouTube style) ────────────────────────────────────
  const handleVideoPress = (evt: { nativeEvent: { locationX: number } }) => {
    if (Date.now() < suppressVideoTapUntil.current) return;
    if (showSpeedMenu) {
      setShowSpeedMenu(false);
      return;
    }
    const { locationX } = evt.nativeEvent;
    const side: 'left' | 'right' = locationX < screenWidth / 2 ? 'left' : 'right';
    const now = Date.now();
    const isDoubleTap = now - lastTapTime.current < DOUBLE_TAP_MS && lastTapSide.current === side;

    if (isDoubleTap) {
      doubleTapCount.current += 1;
      skip(side === 'left' ? -SKIP_SECS : SKIP_SECS);
      triggerSkipFeedback(side, doubleTapCount.current);
      revealControls();
      scheduleHide();
      lastTapTime.current = now;
    } else {
      doubleTapCount.current = 0;
      lastTapTime.current = now;
      lastTapSide.current = side;
      toggleControls();
    }
  };

  // ── Speed ─────────────────────────────────────────────────────────────────
  const setSpeed = async (newRate: number) => {
    const wasPlaying = isPlaying;
    suppressVideoTapUntil.current = Date.now() + 300;
    setRate(newRate);
    setShowSpeedMenu(false);
    try {
      await videoRef.current?.setRateAsync(newRate, true);
      if (wasPlaying) {
        await videoRef.current?.playAsync();
      }
    } catch {
      // Ignore rate errors on unsupported devices.
    }
    showControlsTemporarily();
  };

  // ── Mute ──────────────────────────────────────────────────────────────────
  const toggleMute = async () => {
    suppressVideoTapUntil.current = Date.now() + 200;
    const next = !isMuted;
    setIsMuted(next);
    await videoRef.current?.setStatusAsync({ isMuted: next });
  };

  // ── Navigate ──────────────────────────────────────────────────────────────
  const navigateTo = (classId: string) =>
    router.replace(`/player/${classId}?courseId=${normalizedCourseId ?? ''}`);

  const handleReportContent = () => {
    router.push({
      pathname: '/report-content',
      params: {
        contentType: 'class',
        contentId: normalizedClassId ?? '',
        contentTitle: classItem?.title ?? 'Clase',
      },
    });
  };

  const teacherId = (() => {
    const teacher = (classItem as any)?.teacher;
    if (!teacher) return '';
    if (typeof teacher === 'string') return teacher;
    if (typeof teacher === 'object' && teacher._id) return String(teacher._id);
    return '';
  })();

  const teacherName = (() => {
    const teacher = (classItem as any)?.teacher;
    if (!teacher) return 'docente';
    if (typeof teacher === 'object' && teacher.name) return String(teacher.name);
    return 'docente';
  })();

  const handleReportUser = () => {
    if (!teacherId) return;
    router.push({
      pathname: '/report-user',
      params: {
        userId: teacherId,
        userName: teacherName,
      },
    });
  };

  const openMoreOptions = () => {
    const buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }> = [
      { text: 'Reportar contenido', onPress: handleReportContent },
    ];

    if (teacherId) {
      buttons.push({ text: 'Reportar usuario', onPress: handleReportUser });
    }

    buttons.push({ text: 'Cancelar', style: 'cancel' });

    Alert.alert('Opciones', 'Selecciona una acción', buttons);
  };

  const handleMarkAsCompleted = async () => {
    if (isMarkedComplete) return;

    if (!normalizedClassId) {
      Alert.alert('Error', 'No se pudo identificar la clase.');
      return;
    }

    try {
      await apiClient.markClassCompleted(normalizedClassId);
      setIsMarkedComplete(true);
      Alert.alert(
        'Clase completada',
        nextClass
          ? 'Buen trabajo. Puedes continuar con la siguiente clase.'
          : 'Buen trabajo. Has completado esta clase.',
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo registrar el progreso.';
      Alert.alert('Error', Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  // ── Layout values ─────────────────────────────────────────────────────────
  const videoHeight = isFullscreen ? screenHeight : screenWidth * (9 / 16);
  const fullscreenSeekBottomOffset = Math.max(insets.bottom, 12) + 10;
  const displayPositionMs = scrubPositionMs ?? positionMs;
  const progressRatio = durationMs > 0 ? displayPositionMs / durationMs : 0;

  // ── Seek bar props ───────────────────────────────────────────────────────
  const seekBarProps: SeekBarProps = {
    progressRatio,
    durationMs,
    isScrubbing,
    suppressVideoTapUntil,
    scrubPositionMs,
    positionMs,
    setScrubPositionMs,
    seekToPosition,
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <StatusBar barStyle="light-content" hidden />
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={{ color: '#9ca3af', marginTop: 12, fontSize: 14 }}>Cargando clase...</Text>
      </View>
    );
  }

  if (!classItem) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', paddingHorizontal: 32 }}>
        <StatusBar barStyle="light-content" hidden />
        <Ionicons name="alert-circle-outline" size={56} color="#ef4444" />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
          {streamError || 'No se pudo cargar la clase'}
        </Text>
        <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
          Verifica tu conexión e intenta de nuevo
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 28 }}>
          <TouchableOpacity
            onPress={() => normalizedClassId && load(normalizedClassId)}
            style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#f59e0b', borderRadius: 24 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#374151', borderRadius: 24 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Unified layout (single player instance) ───────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" hidden={isFullscreen} />

      {/* ══════════════════════════════════════════════════════════════════════
          TOP BAR — plain View, OUTSIDE video container, zero touch conflicts
      ══════════════════════════════════════════════════════════════════════ */}
      {!isFullscreen && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#000',
          paddingTop: insets.top + 4,
          paddingBottom: 10,
          paddingHorizontal: 8,
          gap: 4,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 10 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>

          <View style={{ flex: 1, paddingLeft: 2 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
              {classItem.title}
            </Text>
            {courseClasses.length > 0 && currentIndex >= 0 && (
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>
                Clase {currentIndex + 1} de {courseClasses.length}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleReportContent}
            style={{ padding: 10 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="flag-outline" size={18} color="#fca5a5" />
          </TouchableOpacity>
        </View>
      )}

      {/* Speed menu dropdown — absolutely positioned relative to root */}
      {showSpeedMenu && (
        <>
          <TouchableWithoutFeedback onPress={() => setShowSpeedMenu(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 }} />
          </TouchableWithoutFeedback>
          <View style={{
            position: 'absolute',
            top: insets.top + (isFullscreen ? 56 : 44),
            right: 12,
            zIndex: 31,
            backgroundColor: 'rgba(15,15,15,0.97)', borderRadius: 14, overflow: 'hidden', minWidth: 130,
            shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, elevation: 12,
          }}>
            <View style={{ paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Velocidad</Text>
            </View>
            {SPEEDS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSpeed(s)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: rate === s ? 'rgba(245,158,11,0.15)' : 'transparent' }}
              >
                <Text style={{ color: rate === s ? '#f59e0b' : '#fff', fontWeight: rate === s ? '700' : '400', fontSize: 14 }}>{s === 1 ? 'Normal' : `${s}×`}</Text>
                {rate === s && <Ionicons name="checkmark" size={16} color="#f59e0b" />}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIDEO CONTAINER — gesture layer only handles double-tap + center
      ══════════════════════════════════════════════════════════════════════ */}
      <View
        style={{
          width: screenWidth,
          height: videoHeight,
          backgroundColor: '#000',
          ...(isFullscreen
            ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }
            : {}),
        }}
      >

        {streamUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: streamUrl }}
            style={{
              width: screenWidth,
              height: videoHeight,
              ...(isFullscreen ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } : {}),
            }}
            resizeMode={ResizeMode.CONTAIN}
            isMuted={isMuted}
            rate={rate}
            progressUpdateIntervalMillis={100}
            onReadyForDisplay={() => setIsVideoReady(true)}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            onError={() => setStreamError('Error al reproducir el video')}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
            <Ionicons
              name={classItem.videoStatus === VideoStatus.PROCESSING ? 'time-outline' : 'videocam-off-outline'}
              size={56} color="#4b5563"
            />
            <Text style={{ color: '#9ca3af', marginTop: 16, textAlign: 'center', fontSize: 15 }}>
              {streamError || (classItem.videoStatus === VideoStatus.PROCESSING ? 'Video en procesamiento...' : 'Video no disponible')}
            </Text>
          </View>
        )}

        {/* Skip feedback */}
        {skipFeedback && (
          <SkipFeedback side={skipFeedback.side} count={skipFeedback.count} opacity={skipOpacity} />
        )}

        {/* Gesture layer — only for double-tap detection + center overlay */}
        {streamUrl && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: screenWidth,
              height: videoHeight,
              zIndex: 10,
            }}
            onStartShouldSetResponder={() => true}
            onResponderRelease={handleVideoPress}
          >
            <Animated.View
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: controlsOpacity }}
              pointerEvents={showControls ? 'box-none' : 'none'}
            >
              {/* Bottom gradient */}
              {!isFullscreen && (
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.3)' }} pointerEvents="none" />
              )}

              {/* Center: play/pause or replay + prev/next */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                {hasEnded ? (
                  <View style={{ alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={handleReplay}
                      style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(245,158,11,0.9)', justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Ionicons name="reload" size={30} color="white" />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 10 }}>Repetir</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={togglePlay}
                    style={{
                      width: isFullscreen ? 66 : 62,
                      height: isFullscreen ? 66 : 62,
                      borderRadius: isFullscreen ? 33 : 31,
                      backgroundColor: 'rgba(0,0,0,0.55)',
                      borderWidth: 2,
                      borderColor: 'rgba(255,255,255,0.85)',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {!isVideoReady
                      ? <ActivityIndicator color="white" size="small" />
                      : <Ionicons name={isPlaying ? 'pause' : 'play'} size={isFullscreen ? 28 : 26} color="white" style={{ marginLeft: isPlaying ? 0 : 3 }} />
                    }
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => prevClass && navigateTo(prevClass._id!)}
                  disabled={!prevClass}
                  style={{ position: 'absolute', left: 20, padding: isFullscreen ? 12 : 10, opacity: prevClass ? 0.85 : 0.2 }}
                  hitSlop={{ top: isFullscreen ? 16 : 14, bottom: isFullscreen ? 16 : 14, left: isFullscreen ? 16 : 14, right: isFullscreen ? 16 : 14 }}
                >
                  <Ionicons name="play-skip-back" size={isFullscreen ? 30 : 28} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => nextClass && navigateTo(nextClass._id!)}
                  disabled={!nextClass}
                  style={{ position: 'absolute', right: 20, padding: isFullscreen ? 12 : 10, opacity: nextClass ? 0.85 : 0.2 }}
                  hitSlop={{ top: isFullscreen ? 16 : 14, bottom: isFullscreen ? 16 : 14, left: isFullscreen ? 16 : 14, right: isFullscreen ? 16 : 14 }}
                >
                  <Ionicons name="play-skip-forward" size={isFullscreen ? 30 : 28} color="white" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Fullscreen top controls */}
        {isFullscreen && (
          <Animated.View
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              flexDirection: 'row', alignItems: 'center',
              paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 12,
              backgroundColor: 'rgba(0,0,0,0.55)', gap: 6,
              opacity: controlsOpacity,
              zIndex: 20,
            }}
            pointerEvents={showControls ? 'box-none' : 'none'}
          >
            <TouchableOpacity
              onPress={() => setIsFullscreen(false)}
              style={{ padding: 8 }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="contract" size={22} color="white" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{classItem.title}</Text>
            {courseClasses.length > 0 && currentIndex >= 0 && (
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Clase {currentIndex + 1} de {courseClasses.length}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={handleReportContent}
              style={{ padding: 8 }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="flag-outline" size={20} color="#fca5a5" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Fullscreen seek controls */}
        {isFullscreen && streamUrl && (
          <Animated.View
            style={{
              position: 'absolute',
              bottom: fullscreenSeekBottomOffset,
              left: 10,
              right: 10,
              borderRadius: 14,
              backgroundColor: 'rgba(0,0,0,0.68)',
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 10,
              opacity: controlsOpacity,
              zIndex: 21,
            }}
            pointerEvents={showControls ? 'auto' : 'none'}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: '#d1d5db', fontSize: 11, fontWeight: '500', minWidth: 38 }}>
                {fmt(displayPositionMs)}
              </Text>
              <View style={{ flex: 1 }}>
                <SeekBar {...seekBarProps} />
              </View>
              <Text style={{ color: '#6b7280', fontSize: 11, minWidth: 38, textAlign: 'right' }}>
                {fmt(durationMs)}
              </Text>
              <TouchableOpacity onPress={toggleMute} style={{ padding: 6 }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowSpeedMenu((p) => !p)}
                style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: rate !== 1 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.15)', borderRadius: 10 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={{ color: rate !== 1 ? '#f59e0b' : '#fff', fontWeight: '700', fontSize: 12 }}>{rate === 1 ? '1×' : `${rate}×`}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsFullscreen(false)} style={{ padding: 6 }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="contract" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          SEEK BAR — own View, zero nesting conflicts
      ══════════════════════════════════════════════════════════════════════ */}
      {!isFullscreen && streamUrl && (
        <View style={{ backgroundColor: '#111', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: '#d1d5db', fontSize: 11, fontWeight: '500', minWidth: 38 }}>
              {fmt(displayPositionMs)}
            </Text>
            <View style={{ flex: 1 }}>
              <SeekBar {...seekBarProps} />
            </View>
            <Text style={{ color: '#6b7280', fontSize: 11, minWidth: 38, textAlign: 'right' }}>
              {fmt(durationMs)}
            </Text>
            <TouchableOpacity onPress={toggleMute} style={{ padding: 6 }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSpeedMenu((p) => !p)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                backgroundColor: rate !== 1 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.15)',
                borderRadius: 10,
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={{ color: rate !== 1 ? '#f59e0b' : '#fff', fontWeight: '700', fontSize: 12 }}>
                {rate === 1 ? '1×' : `${rate}×`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsFullscreen(true)} style={{ padding: 6 }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="expand" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          INFO PANEL
      ══════════════════════════════════════════════════════════════════════ */}
      {!isFullscreen && (
        <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 20 }}>
          <Text style={{ color: '#111827', fontSize: 20, fontWeight: '700' }}>{classItem.title}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginBottom: 16, gap: 8 }}>
            {durationMs > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                <Ionicons name="time-outline" size={13} color="#d97706" />
                <Text style={{ color: '#b45309', fontSize: 12, marginLeft: 4, fontWeight: '500' }}>{fmt(durationMs)}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: classItem.videoStatus === VideoStatus.READY ? '#f0fdf4' : '#f3f4f6' }}>
              <Ionicons
                name={classItem.videoStatus === VideoStatus.READY ? 'checkmark-circle' : 'time-outline'}
                size={13}
                color={classItem.videoStatus === VideoStatus.READY ? '#16a34a' : '#6b7280'}
              />
              <Text style={{ fontSize: 12, marginLeft: 4, fontWeight: '500', color: classItem.videoStatus === VideoStatus.READY ? '#15803d' : '#4b5563' }}>
                {classItem.videoStatus === VideoStatus.READY ? 'Disponible' : classItem.videoStatus?.toLowerCase()}
              </Text>
            </View>
            {rate !== 1 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                <Ionicons name="speedometer-outline" size={13} color="#d97706" />
                <Text style={{ color: '#b45309', fontSize: 12, marginLeft: 4, fontWeight: '500' }}>{rate}× velocidad</Text>
              </View>
            )}
          </View>

          {classItem.description ? (
            <Text style={{ color: '#4b5563', lineHeight: 22, fontSize: 14 }}>{classItem.description}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleMarkAsCompleted}
            disabled={isMarkedComplete}
            style={{
              marginTop: 24,
              backgroundColor: isMarkedComplete ? '#16a34a' : '#f59e0b',
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              opacity: isMarkedComplete ? 0.9 : 1,
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="white" />
            <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 15 }}>
              {isMarkedComplete ? 'Clase completada' : 'Marcar como completado'}
            </Text>
          </TouchableOpacity>

          {courseClasses.length > 1 && (
            <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
              <TouchableOpacity
                onPress={() => prevClass && navigateTo(prevClass._id!)}
                disabled={!prevClass}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, opacity: prevClass ? 1 : 0.3 }}
              >
                <Ionicons name="chevron-back" size={16} color="#374151" />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 11 }}>Anterior</Text>
                  <Text style={{ color: '#1f2937', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{prevClass?.title ?? '—'}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => nextClass && navigateTo(nextClass._id!)}
                disabled={!nextClass}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, opacity: nextClass ? 1 : 0.3 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#d97706', fontSize: 11 }}>Siguiente</Text>
                  <Text style={{ color: '#78350f', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{nextClass?.title ?? '—'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#d97706" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={openMoreOptions}
            style={{ marginTop: 18, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', opacity: 0.65, paddingVertical: 6, paddingHorizontal: 8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal-circle-outline" size={16} color="#9ca3af" />
            <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '500', marginLeft: 6 }}>
              Más opciones
            </Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
