import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
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
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import {
  IClass,
  IClassSubmission,
  ISubmissionAnnotation,
  SubmissionReviewStatus,
  VideoStatus,
} from '@inti/shared-types';
import { apiClient } from '@/services/apiClient';
import { pickVideoFromDevice } from '@/services/mediaPicker';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const CONTROLS_HIDE_MS = 3500;
const DOUBLE_TAP_MS = 300;
const SKIP_SECS = 10;
const REVIEW_FILTER_STORAGE_PREFIX = 'class_review_filter';
const REVIEWER_ROLES = new Set([
  'teacher',
  'admin',
  'super_admin',
  'school_owner',
  'administrative',
]);
const REVIEW_FILTERS = [
  { key: 'ALL', label: 'Todas' },
  { key: 'PENDING', label: 'Sin revisar' },
  { key: 'NEEDS_RESUBMISSION', label: 'Reenvío' },
  { key: 'REVIEWED', label: 'Revisadas' },
  { key: 'PROCESSING', label: 'Procesando' },
] as const;

type ReviewFilterKey = (typeof REVIEW_FILTERS)[number]['key'];

const fmt = (ms: number) => {
  const t = Math.floor(ms / 1000);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatSeconds = (value: number): string => {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getSubmissionStatusConfig = (
  submission?: IClassSubmission | null,
): { label: string; color: string; backgroundColor: string; icon: keyof typeof Ionicons.glyphMap } => {
  if (!submission) {
    return {
      label: 'Sin entrega',
      color: '#6b7280',
      backgroundColor: '#f3f4f6',
      icon: 'cloud-upload-outline',
    };
  }

  if (submission.videoStatus === VideoStatus.ERROR) {
    return {
      label: 'Error al procesar',
      color: '#b91c1c',
      backgroundColor: '#fef2f2',
      icon: 'alert-circle-outline',
    };
  }

  if (submission.videoStatus === VideoStatus.PROCESSING) {
    return {
      label: 'Procesando práctica',
      color: '#b45309',
      backgroundColor: '#fffbeb',
      icon: 'time-outline',
    };
  }

  if (submission.videoStatus === VideoStatus.UPLOADING) {
    return {
      label: 'Subiendo práctica',
      color: '#374151',
      backgroundColor: '#f3f4f6',
      icon: 'cloud-upload-outline',
    };
  }

  if (submission.reviewStatus === SubmissionReviewStatus.REVIEWED) {
    return {
      label: 'Feedback listo',
      color: '#166534',
      backgroundColor: '#f0fdf4',
      icon: 'checkmark-done-outline',
    };
  }

  if (submission.reviewStatus === SubmissionReviewStatus.NEEDS_RESUBMISSION) {
    return {
      label: 'Requiere reenvío',
      color: '#9a3412',
      backgroundColor: '#fff7ed',
      icon: 'refresh-outline',
    };
  }

  return {
    label: 'Enviada para revisión',
    color: '#1d4ed8',
    backgroundColor: '#eff6ff',
    icon: 'videocam-outline',
  };
};

const getSubmissionActionCopy = (
  submission?: IClassSubmission | null,
): {
  title: string;
  body: string;
  buttonLabel: string;
  accentColor: string;
  accentBackground: string;
  accentBorder: string;
} => {
  if (!submission) {
    return {
      title: 'Aun no has enviado tu práctica',
      body: 'Cuando subas tu video, el profesor podrá revisarlo y dejarte observaciones por momento específico.',
      buttonLabel: 'Subir práctica',
      accentColor: '#1f2937',
      accentBackground: '#f9fafb',
      accentBorder: '#e5e7eb',
    };
  }

  if (submission.videoStatus === VideoStatus.ERROR) {
    return {
      title: 'Hubo un problema con tu video',
      body: 'Vuelve a subir tu práctica para que podamos procesarla correctamente.',
      buttonLabel: 'Intentar de nuevo',
      accentColor: '#b91c1c',
      accentBackground: '#fef2f2',
      accentBorder: '#fecaca',
    };
  }

  if (
    submission.videoStatus === VideoStatus.UPLOADING ||
    submission.videoStatus === VideoStatus.PROCESSING
  ) {
    return {
      title: 'Tu práctica se está preparando',
      body: 'Espera un momento mientras terminamos la subida y el procesamiento del video.',
      buttonLabel: 'Reemplazar práctica',
      accentColor: '#92400e',
      accentBackground: '#fffbeb',
      accentBorder: '#fde68a',
    };
  }

  if (submission.reviewStatus === SubmissionReviewStatus.NEEDS_RESUBMISSION) {
    return {
      title: 'El profesor pidió un nuevo envío',
      body: 'Revisa las anotaciones y sube una nueva versión de tu práctica con los ajustes solicitados.',
      buttonLabel: 'Subir nueva versión',
      accentColor: '#9a3412',
      accentBackground: '#fff7ed',
      accentBorder: '#fdba74',
    };
  }

  if (submission.reviewStatus === SubmissionReviewStatus.REVIEWED) {
    return {
      title: 'Tu práctica ya fue revisada',
      body: 'Consulta las anotaciones del profesor y, si quieres mejorarla, puedes enviar una nueva versión.',
      buttonLabel: 'Enviar nueva versión',
      accentColor: '#166534',
      accentBackground: '#f0fdf4',
      accentBorder: '#86efac',
    };
  }

  return {
    title: 'Tu práctica está en revisión',
    body: 'El profesor ya recibió tu video. Aquí aparecerán sus comentarios en cuanto los agregue.',
    buttonLabel: 'Reemplazar práctica',
    accentColor: '#1d4ed8',
    accentBackground: '#eff6ff',
    accentBorder: '#93c5fd',
  };
};

const getSubmissionStudentLabel = (submission?: IClassSubmission | null): string => {
  if (!submission) {
    return 'Alumno';
  }

  const student = (submission as any)?.student;
  if (!student) {
    return 'Alumno';
  }
  if (typeof student === 'string') {
    return 'Alumno';
  }
  if (typeof student.name === 'string' && student.name.trim()) {
    return student.name.trim();
  }
  if (typeof student.email === 'string' && student.email.trim()) {
    return student.email.trim();
  }

  return 'Alumno';
};

const getSubmissionReviewMeta = (submission?: IClassSubmission | null): string => {
  if (!submission) {
    return 'Pendiente';
  }

  if (submission.reviewStatus === SubmissionReviewStatus.REVIEWED) {
    return 'Revisada';
  }

  if (submission.reviewStatus === SubmissionReviewStatus.NEEDS_RESUBMISSION) {
    return 'Reenvío solicitado';
  }

  if (submission.videoStatus === VideoStatus.PROCESSING) {
    return 'Procesando';
  }

  if (submission.videoStatus === VideoStatus.ERROR) {
    return 'Error';
  }

  return 'Pendiente';
};

const matchesReviewFilter = (
  submission: IClassSubmission,
  filter: ReviewFilterKey,
): boolean => {
  if (filter === 'ALL') {
    return true;
  }

  if (filter === 'PENDING') {
    return submission.reviewStatus === SubmissionReviewStatus.SUBMITTED;
  }

  if (filter === 'NEEDS_RESUBMISSION') {
    return (
      submission.reviewStatus === SubmissionReviewStatus.NEEDS_RESUBMISSION
    );
  }

  if (filter === 'REVIEWED') {
    return submission.reviewStatus === SubmissionReviewStatus.REVIEWED;
  }

  if (filter === 'PROCESSING') {
    return (
      submission.videoStatus === VideoStatus.PROCESSING ||
      submission.videoStatus === VideoStatus.UPLOADING
    );
  }

  return true;
};

const getReviewSortWeight = (submission: IClassSubmission): number => {
  if (
    submission.reviewStatus === SubmissionReviewStatus.SUBMITTED &&
    submission.videoStatus === VideoStatus.READY
  ) {
    return 0;
  }

  if (submission.reviewStatus === SubmissionReviewStatus.NEEDS_RESUBMISSION) {
    return 1;
  }

  if (
    submission.videoStatus === VideoStatus.PROCESSING ||
    submission.videoStatus === VideoStatus.UPLOADING
  ) {
    return 2;
  }

  if (submission.videoStatus === VideoStatus.ERROR) {
    return 3;
  }

  return 4;
};

const isReviewFilterKey = (value: string): value is ReviewFilterKey =>
  REVIEW_FILTERS.some((filterOption) => filterOption.key === value);

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

interface PracticeVideoPlayerProps {
  uri: string;
  videoRef: RefObject<Video | null>;
  height?: number;
  onPositionChange?: (positionMs: number, durationMs: number) => void;
}

function PracticeVideoPlayer({
  uri,
  videoRef,
  height = 220,
  onPositionChange,
}: PracticeVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [rate, setRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [scrubPositionMs, setScrubPositionMs] = useState<number | null>(null);
  const [hasEnded, setHasEnded] = useState(false);
  const [skipFeedback, setSkipFeedback] = useState<{
    side: 'left' | 'right';
    count: number;
  } | null>(null);
  const isScrubbing = useRef(false);
  const suppressVideoTapUntil = useRef(0);
  const skipOpacity = useRef(new Animated.Value(0)).current;
  const skipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef(0);
  const lastTapSide = useRef<'left' | 'right' | null>(null);
  const doubleTapCount = useRef(0);
  const widthRef = useRef(0);

  useEffect(() => {
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(0);
    setRate(1);
    setIsMuted(false);
    setShowSpeedMenu(false);
    setScrubPositionMs(null);
    setHasEnded(false);
    setSkipFeedback(null);
    onPositionChange?.(0, 0);
  }, [uri, onPositionChange]);

  useEffect(() => {
    return () => {
      if (skipTimer.current) {
        clearTimeout(skipTimer.current);
      }
    };
  }, []);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return;
    }
    if (isScrubbing.current) {
      return;
    }

    const nextPositionMs = status.positionMillis ?? 0;
    const nextDurationMs = status.durationMillis ?? durationMs;
    setIsPlaying(status.isPlaying);
    setPositionMs(nextPositionMs);
    if (status.durationMillis) {
      setDurationMs(status.durationMillis);
    }
    if (status.didJustFinish) {
      setHasEnded(true);
      setIsPlaying(false);
    }
    onPositionChange?.(nextPositionMs, nextDurationMs);
  };

  const togglePlay = async () => {
    if (!videoRef.current) {
      return;
    }

    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      setHasEnded(false);
      await videoRef.current.playAsync();
    }
  };

  const skip = async (seconds: number) => {
    const nextPositionMs = Math.max(
      0,
      Math.min(positionMs + seconds * 1000, durationMs || positionMs + seconds * 1000),
    );
    await seekToPosition(nextPositionMs);
  };

  const seekToPosition = async (targetMs: number) => {
    const player = videoRef.current;
    if (!player || !Number.isFinite(targetMs)) {
      return;
    }

    const bounded = Math.max(0, Math.min(Math.round(targetMs), durationMs || targetMs));
    const shouldResume = isPlaying;
    setPositionMs(bounded);
    onPositionChange?.(bounded, durationMs);

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
        onPositionChange?.(
          status.positionMillis,
          status.durationMillis ?? durationMs,
        );
      }
    } catch {
      // Keep inline player stable even if native seek fails.
    } finally {
      setScrubPositionMs(null);
      isScrubbing.current = false;
    }
  };

  const toggleMute = async () => {
    suppressVideoTapUntil.current = Date.now() + 200;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    await videoRef.current?.setStatusAsync({ isMuted: nextMuted });
  };

  const applySpeed = async (newRate: number) => {
    suppressVideoTapUntil.current = Date.now() + 200;
    const wasPlaying = isPlaying;
    setRate(newRate);
    setShowSpeedMenu(false);
    try {
      await videoRef.current?.setRateAsync(newRate, true);
      if (wasPlaying) {
        await videoRef.current?.playAsync();
      }
    } catch {
      // Ignore unsupported playback-rate updates.
    }
  };

  const openFullscreen = async () => {
    suppressVideoTapUntil.current = Date.now() + 250;
    try {
      await videoRef.current?.presentFullscreenPlayer();
    } catch {
      // Fullscreen is best-effort on supported platforms.
    }
  };

  const replay = async () => {
    setHasEnded(false);
    await seekToPosition(0);
    await videoRef.current?.playAsync();
  };

  const triggerSkipFeedback = (side: 'left' | 'right', count: number) => {
    setSkipFeedback({ side, count });
    skipOpacity.setValue(1);
    if (skipTimer.current) {
      clearTimeout(skipTimer.current);
    }
    skipTimer.current = setTimeout(() => {
      Animated.timing(skipOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => setSkipFeedback(null));
    }, 700);
  };

  const handleVideoPress = (evt: { nativeEvent: { locationX: number } }) => {
    if (Date.now() < suppressVideoTapUntil.current) {
      return;
    }
    if (showSpeedMenu) {
      setShowSpeedMenu(false);
      return;
    }

    const width = widthRef.current;
    const side: 'left' | 'right' =
      width > 0 && evt.nativeEvent.locationX < width / 2 ? 'left' : 'right';
    const now = Date.now();
    const isDoubleTap =
      now - lastTapTime.current < DOUBLE_TAP_MS &&
      lastTapSide.current === side;

    if (isDoubleTap) {
      doubleTapCount.current += 1;
      void skip(side === 'left' ? -SKIP_SECS : SKIP_SECS);
      triggerSkipFeedback(side, doubleTapCount.current);
      lastTapTime.current = now;
      return;
    }

    doubleTapCount.current = 0;
    lastTapTime.current = now;
    lastTapSide.current = side;
  };

  const displayPositionMs = scrubPositionMs ?? positionMs;
  const progressRatio = durationMs > 0 ? displayPositionMs / durationMs : 0;
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

  return (
    <View
      style={{
        marginTop: 16,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      <View style={{ width: '100%', height, backgroundColor: '#000' }}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={{ width: '100%', height, backgroundColor: '#000' }}
          resizeMode={ResizeMode.CONTAIN}
          isMuted={isMuted}
          rate={rate}
          progressUpdateIntervalMillis={100}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />

        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onLayout={(event) => {
            widthRef.current = event.nativeEvent.layout.width;
          }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleVideoPress}
        >
          {skipFeedback ? (
            <SkipFeedback
              side={skipFeedback.side}
              count={skipFeedback.count}
              opacity={skipOpacity}
            />
          ) : null}

          {hasEnded ? (
            <TouchableOpacity
              onPress={() => void replay()}
              style={{
                width: 62,
                height: 62,
                borderRadius: 31,
                backgroundColor: 'rgba(245,158,11,0.92)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="reload" size={28} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => void togglePlay()}
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.85)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="white"
                style={{ marginLeft: isPlaying ? 0 : 3 }}
              />
            </TouchableOpacity>
          )}
        </View>

        {showSpeedMenu ? (
          <View
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 10,
              backgroundColor: 'rgba(15,15,15,0.96)',
              borderRadius: 12,
              overflow: 'hidden',
              minWidth: 112,
            }}
          >
            {SPEEDS.map((speed) => (
              <TouchableOpacity
                key={speed}
                onPress={() => void applySpeed(speed)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  backgroundColor:
                    rate === speed ? 'rgba(245,158,11,0.18)' : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: rate === speed ? '#f59e0b' : '#fff',
                    fontSize: 13,
                    fontWeight: rate === speed ? '700' : '500',
                  }}
                >
                  {speed === 1 ? 'Normal' : `${speed}×`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      <View
        style={{
          backgroundColor: '#111',
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text
            style={{
              color: '#d1d5db',
              fontSize: 11,
              fontWeight: '500',
              minWidth: 38,
            }}
          >
            {fmt(displayPositionMs)}
          </Text>
          <View style={{ flex: 1 }}>
            <SeekBar {...seekBarProps} />
          </View>
          <Text
            style={{
              color: '#6b7280',
              fontSize: 11,
              minWidth: 38,
              textAlign: 'right',
            }}
          >
            {fmt(durationMs)}
          </Text>
          <TouchableOpacity onPress={() => void toggleMute()} style={{ padding: 6 }}>
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-high'}
              size={20}
              color="white"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSpeedMenu((previous) => !previous)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor:
                rate !== 1 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.15)',
              borderRadius: 10,
            }}
          >
            <Text
              style={{
                color: rate !== 1 ? '#f59e0b' : '#fff',
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              {rate === 1 ? '1×' : `${rate}×`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void openFullscreen()} style={{ padding: 6 }}>
            <Ionicons name="expand" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
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
  const submissionVideoRef = useRef<Video>(null);

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
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [submission, setSubmission] = useState<IClassSubmission | null>(null);
  const [submissionAnnotations, setSubmissionAnnotations] = useState<
    ISubmissionAnnotation[]
  >([]);
  const [isSubmissionLoading, setIsSubmissionLoading] = useState(false);
  const [isSubmittingPractice, setIsSubmittingPractice] = useState(false);
  const [reviewSubmissions, setReviewSubmissions] = useState<IClassSubmission[]>([]);
  const [selectedReviewSubmissionId, setSelectedReviewSubmissionId] = useState<
    string | null
  >(null);
  const [reviewAnnotations, setReviewAnnotations] = useState<
    ISubmissionAnnotation[]
  >([]);
  const [isReviewSubmissionsLoading, setIsReviewSubmissionsLoading] =
    useState(false);
  const [isReviewAnnotationsLoading, setIsReviewAnnotationsLoading] =
    useState(false);
  const [reviewAnnotationText, setReviewAnnotationText] = useState('');
  const [selectedReviewTimestamp, setSelectedReviewTimestamp] = useState(0);
  const [editingReviewAnnotationId, setEditingReviewAnnotationId] = useState<
    string | null
  >(null);
  const [isSavingReviewAnnotation, setIsSavingReviewAnnotation] = useState(false);
  const [reviewPlayerPositionMs, setReviewPlayerPositionMs] = useState(0);
  const [reviewPlayerDurationMs, setReviewPlayerDurationMs] = useState(0);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilterKey>('ALL');

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
  const hasLoadedPersistedReviewFilter = useRef(false);

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
    apiClient
      .getCurrentUser()
      .then((user) =>
        setCurrentUserRole(String((user as any)?.role || '').toLowerCase()),
      )
      .catch(() => setCurrentUserRole(null));
  }, []);

  const loadSubmission = useCallback(async (classId: string) => {
    setIsSubmissionLoading(true);
    try {
      const mine = await apiClient.getMyClassSubmissions(classId);
      const currentSubmission = Array.isArray(mine) && mine.length > 0 ? mine[0] : null;

      setSubmission(currentSubmission);

      if (currentSubmission?._id) {
        const annotations = await apiClient.getSubmissionAnnotations(
          currentSubmission._id,
        );
        setSubmissionAnnotations(Array.isArray(annotations) ? annotations : []);
      } else {
        setSubmissionAnnotations([]);
      }
    } catch {
      setSubmission(null);
      setSubmissionAnnotations([]);
    } finally {
      setIsSubmissionLoading(false);
    }
  }, []);

  const loadReviewSubmissions = useCallback(async (classId: string) => {
    setIsReviewSubmissionsLoading(true);
    try {
      const items = await apiClient.getClassSubmissionsByClass(classId);
      const safeItems = Array.isArray(items) ? items : [];
      setReviewSubmissions(safeItems);
      setSelectedReviewSubmissionId((current) => {
        if (current && safeItems.some((item) => item._id === current)) {
          return current;
        }
        return safeItems[0]?._id ?? null;
      });
    } catch (error: any) {
      setReviewSubmissions([]);
      setSelectedReviewSubmissionId(null);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudieron cargar las prácticas de esta clase.';
      Alert.alert(
        'No se pudieron cargar las prácticas',
        Array.isArray(message) ? message.join('\n') : String(message),
      );
    } finally {
      setIsReviewSubmissionsLoading(false);
    }
  }, []);

  const loadReviewAnnotations = useCallback(async (submissionId: string) => {
    setIsReviewAnnotationsLoading(true);
    try {
      const items = await apiClient.getSubmissionAnnotations(submissionId);
      setReviewAnnotations(Array.isArray(items) ? items : []);
    } catch {
      setReviewAnnotations([]);
    } finally {
      setIsReviewAnnotationsLoading(false);
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
    if (!normalizedClassId || currentUserRole !== 'student') {
      setSubmission(null);
      setSubmissionAnnotations([]);
      return;
    }

    loadSubmission(normalizedClassId);
  }, [normalizedClassId, currentUserRole, loadSubmission]);

  useEffect(() => {
    if (!normalizedClassId || !REVIEWER_ROLES.has(String(currentUserRole || ''))) {
      setReviewSubmissions([]);
      setSelectedReviewSubmissionId(null);
      setReviewAnnotations([]);
      return;
    }

    loadReviewSubmissions(normalizedClassId);
  }, [normalizedClassId, currentUserRole, loadReviewSubmissions]);

  useEffect(() => {
    const isReviewerRole = REVIEWER_ROLES.has(String(currentUserRole || ''));
    if (!normalizedClassId || !isReviewerRole) {
      hasLoadedPersistedReviewFilter.current = false;
      setReviewFilter('ALL');
      return;
    }

    const storageKey = `${REVIEW_FILTER_STORAGE_PREFIX}:${normalizedClassId}`;
    hasLoadedPersistedReviewFilter.current = false;

    void (async () => {
      try {
        const storedFilter = await SecureStore.getItemAsync(storageKey);
        if (storedFilter && isReviewFilterKey(storedFilter)) {
          setReviewFilter(storedFilter);
        } else {
          setReviewFilter('ALL');
        }
      } catch {
        setReviewFilter('ALL');
      } finally {
        hasLoadedPersistedReviewFilter.current = true;
      }
    })();
  }, [normalizedClassId, currentUserRole]);

  useEffect(() => {
    const isReviewerRole = REVIEWER_ROLES.has(String(currentUserRole || ''));
    if (
      !normalizedClassId ||
      !isReviewerRole ||
      !hasLoadedPersistedReviewFilter.current
    ) {
      return;
    }

    const storageKey = `${REVIEW_FILTER_STORAGE_PREFIX}:${normalizedClassId}`;
    void SecureStore.setItemAsync(storageKey, reviewFilter).catch(() => undefined);
  }, [normalizedClassId, currentUserRole, reviewFilter]);

  useEffect(() => {
    if (!selectedReviewSubmissionId) {
      setReviewAnnotations([]);
      setReviewAnnotationText('');
      setEditingReviewAnnotationId(null);
      setSelectedReviewTimestamp(0);
      setReviewPlayerPositionMs(0);
      setReviewPlayerDurationMs(0);
      return;
    }

    setReviewAnnotationText('');
    setEditingReviewAnnotationId(null);
    setSelectedReviewTimestamp(0);
    setReviewPlayerPositionMs(0);
    setReviewPlayerDurationMs(0);
    loadReviewAnnotations(selectedReviewSubmissionId);
  }, [selectedReviewSubmissionId, loadReviewAnnotations]);

  useEffect(() => {
    if (reviewSubmissions.length === 0) {
      return;
    }

    const normalizedSearch = reviewSearch.trim().toLowerCase();
    const visibleIds = reviewSubmissions
      .filter((submissionItem) => {
        if (!matchesReviewFilter(submissionItem, reviewFilter)) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const studentLabel = getSubmissionStudentLabel(submissionItem).toLowerCase();
        return studentLabel.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const weightDiff =
          getReviewSortWeight(left) - getReviewSortWeight(right);
        if (weightDiff !== 0) {
          return weightDiff;
        }

        const leftDate = new Date(
          left.submittedAt || left.createdAt || 0,
        ).getTime();
        const rightDate = new Date(
          right.submittedAt || right.createdAt || 0,
        ).getTime();
        return rightDate - leftDate;
      })
      .map((submissionItem) => submissionItem._id)
      .filter((value): value is string => Boolean(value));

    if (visibleIds.length === 0) {
      setSelectedReviewSubmissionId(null);
      return;
    }

    if (
      !selectedReviewSubmissionId ||
      !visibleIds.includes(selectedReviewSubmissionId)
    ) {
      setSelectedReviewSubmissionId(visibleIds[0]);
    }
  }, [reviewSubmissions, reviewSearch, reviewFilter, selectedReviewSubmissionId]);

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

  const handlePickAndUploadPractice = async () => {
    if (!normalizedClassId) {
      Alert.alert('Error', 'No se pudo identificar la clase.');
      return;
    }

    try {
      setIsSubmittingPractice(true);
      const pickedVideo = await pickVideoFromDevice();
      if (!pickedVideo) {
        return;
      }

      await apiClient.submitClassSubmission(normalizedClassId, pickedVideo);
      await loadSubmission(normalizedClassId);
      Alert.alert(
        'Práctica enviada',
        'Tu video quedó cargado y será revisado por el profesor.',
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo subir la práctica.';
      Alert.alert(
        'Error',
        Array.isArray(message) ? message.join('\n') : String(message),
      );
    } finally {
      setIsSubmittingPractice(false);
    }
  };

  const seekToAnnotation = async (timestampSeconds: number) => {
    if (!submissionVideoRef.current) {
      return;
    }

    try {
      await submissionVideoRef.current.setPositionAsync(timestampSeconds * 1000);
    } catch {
      // Keep annotation jump best-effort for native video.
    }
  };

  const handleCaptureReviewTimestamp = () => {
    setSelectedReviewTimestamp(Math.max(0, Math.floor(reviewPlayerPositionMs / 1000)));
  };

  const handleSaveReviewAnnotation = async () => {
    if (!selectedReviewSubmissionId || !reviewAnnotationText.trim()) {
      Alert.alert(
        'Falta información',
        'Selecciona una práctica y escribe una anotación para guardarla.',
      );
      return;
    }

    try {
      setIsSavingReviewAnnotation(true);
      if (editingReviewAnnotationId) {
        await apiClient.updateSubmissionAnnotation(
          selectedReviewSubmissionId,
          editingReviewAnnotationId,
          {
            timestampSeconds: selectedReviewTimestamp,
            text: reviewAnnotationText.trim(),
          },
        );
      } else {
        await apiClient.createSubmissionAnnotation(selectedReviewSubmissionId, {
          timestampSeconds: selectedReviewTimestamp,
          text: reviewAnnotationText.trim(),
        });
      }

      setReviewAnnotationText('');
      setEditingReviewAnnotationId(null);
      await loadReviewAnnotations(selectedReviewSubmissionId);
      if (normalizedClassId) {
        await loadReviewSubmissions(normalizedClassId);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo guardar la anotación.';
      Alert.alert(
        'Error',
        Array.isArray(message) ? message.join('\n') : String(message),
      );
    } finally {
      setIsSavingReviewAnnotation(false);
    }
  };

  const handleDeleteReviewAnnotation = async (annotationId?: string) => {
    if (!selectedReviewSubmissionId || !annotationId) {
      return;
    }

    Alert.alert('Eliminar anotación', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.deleteSubmissionAnnotation(
              selectedReviewSubmissionId,
              annotationId,
            );
            if (editingReviewAnnotationId === annotationId) {
              setEditingReviewAnnotationId(null);
              setReviewAnnotationText('');
            }
            await loadReviewAnnotations(selectedReviewSubmissionId);
            if (normalizedClassId) {
              await loadReviewSubmissions(normalizedClassId);
            }
          } catch (error: any) {
            const message =
              error?.response?.data?.message ||
              error?.message ||
              'No se pudo eliminar la anotación.';
            Alert.alert(
              'Error',
              Array.isArray(message) ? message.join('\n') : String(message),
            );
          }
        },
      },
    ]);
  };

  const handleUpdateReviewStatus = async (reviewStatus: SubmissionReviewStatus) => {
    if (!selectedReviewSubmissionId) {
      return;
    }

    try {
      await apiClient.updateClassSubmissionReviewStatus(
        selectedReviewSubmissionId,
        reviewStatus,
      );
      if (normalizedClassId) {
        await loadReviewSubmissions(normalizedClassId);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo actualizar el estado de la práctica.';
      Alert.alert(
        'Error',
        Array.isArray(message) ? message.join('\n') : String(message),
      );
    }
  };

  // ── Layout values ─────────────────────────────────────────────────────────
  const videoHeight = isFullscreen ? screenHeight : screenWidth * (9 / 16);
  // Keep controls well above iOS home indicator so seek interactions are reliable.
  const fullscreenSeekBottomOffset = Math.max(insets.bottom + 14, 64);
  const displayPositionMs = scrubPositionMs ?? positionMs;
  const progressRatio = durationMs > 0 ? displayPositionMs / durationMs : 0;
  const isStudent = currentUserRole === 'student';
  const isReviewer = REVIEWER_ROLES.has(String(currentUserRole || ''));
  const submissionStatusConfig = getSubmissionStatusConfig(submission);
  const submissionActionCopy = getSubmissionActionCopy(submission);
  const normalizedReviewSearch = reviewSearch.trim().toLowerCase();
  const reviewFilterCounts = REVIEW_FILTERS.reduce<Record<ReviewFilterKey, number>>(
    (accumulator, filterOption) => {
      accumulator[filterOption.key] = reviewSubmissions.filter((reviewSubmission) =>
        matchesReviewFilter(reviewSubmission, filterOption.key),
      ).length;
      return accumulator;
    },
    {
      ALL: 0,
      PENDING: 0,
      NEEDS_RESUBMISSION: 0,
      REVIEWED: 0,
      PROCESSING: 0,
    },
  );
  const reviewSummaryItems = [
    {
      key: 'ALL' as ReviewFilterKey,
      label: 'Entregas',
      value: reviewSubmissions.length,
      color: '#111827',
      backgroundColor: '#f3f4f6',
    },
    {
      key: 'PENDING' as ReviewFilterKey,
      label: 'Sin revisar',
      value: reviewFilterCounts.PENDING,
      color: '#1d4ed8',
      backgroundColor: '#eff6ff',
    },
    {
      key: 'NEEDS_RESUBMISSION' as ReviewFilterKey,
      label: 'Reenvíos',
      value: reviewFilterCounts.NEEDS_RESUBMISSION,
      color: '#9a3412',
      backgroundColor: '#fff7ed',
    },
    {
      key: 'REVIEWED' as ReviewFilterKey,
      label: 'Revisadas',
      value: reviewFilterCounts.REVIEWED,
      color: '#166534',
      backgroundColor: '#f0fdf4',
    },
  ];
  const visibleReviewSubmissions = reviewSubmissions
    .filter((reviewSubmission) => {
      if (!matchesReviewFilter(reviewSubmission, reviewFilter)) {
        return false;
      }

      if (!normalizedReviewSearch) {
        return true;
      }

      return getSubmissionStudentLabel(reviewSubmission)
        .toLowerCase()
        .includes(normalizedReviewSearch);
    })
    .sort((left, right) => {
      const weightDiff = getReviewSortWeight(left) - getReviewSortWeight(right);
      if (weightDiff !== 0) {
        return weightDiff;
      }

      const leftDate = new Date(left.submittedAt || left.createdAt || 0).getTime();
      const rightDate = new Date(
        right.submittedAt || right.createdAt || 0,
      ).getTime();
      return rightDate - leftDate;
    });
  const selectedReviewSubmission =
    visibleReviewSubmissions.find(
      (reviewSubmission) => reviewSubmission._id === selectedReviewSubmissionId,
    ) ?? null;
  const selectedReviewStatusConfig = getSubmissionStatusConfig(
    selectedReviewSubmission,
  );
  const selectedReviewStudentName =
    getSubmissionStudentLabel(selectedReviewSubmission);

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
              left: 12,
              right: 12,
              borderRadius: 14,
              backgroundColor: 'rgba(0,0,0,0.68)',
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 12,
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

          {isStudent && (
            <View
              style={{
                marginTop: 24,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                backgroundColor: '#fafaf9',
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700' }}>
                    Tu práctica
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 4, lineHeight: 19 }}>
                    Sube un video de esta clase para recibir feedback puntual del profesor.
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: submissionStatusConfig.backgroundColor,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Ionicons
                    name={submissionStatusConfig.icon}
                    size={13}
                    color={submissionStatusConfig.color}
                  />
                  <Text
                    style={{
                      color: submissionStatusConfig.color,
                      fontSize: 12,
                      fontWeight: '600',
                      marginLeft: 6,
                    }}
                  >
                    {submissionStatusConfig.label}
                  </Text>
                </View>
              </View>

              {submission?.submittedAt ? (
                <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 10 }}>
                  Enviado: {new Date(submission.submittedAt).toLocaleString()}
                </Text>
              ) : null}

              {submission?.reviewedAt ? (
                <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                  Revisado: {new Date(submission.reviewedAt).toLocaleString()}
                </Text>
              ) : null}

              {submission?.videoProcessingError ? (
                <Text style={{ color: '#b91c1c', fontSize: 12, marginTop: 8 }}>
                  {submission.videoProcessingError}
                </Text>
              ) : null}

              <View
                style={{
                  marginTop: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: submissionActionCopy.accentBorder,
                  backgroundColor: submissionActionCopy.accentBackground,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Ionicons
                    name={
                      submission?.reviewStatus === SubmissionReviewStatus.NEEDS_RESUBMISSION
                        ? 'refresh-circle-outline'
                        : submission?.reviewStatus === SubmissionReviewStatus.REVIEWED
                          ? 'checkmark-circle-outline'
                          : 'information-circle-outline'
                    }
                    size={18}
                    color={submissionActionCopy.accentColor}
                    style={{ marginTop: 1 }}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text
                      style={{
                        color: submissionActionCopy.accentColor,
                        fontSize: 14,
                        fontWeight: '700',
                      }}
                    >
                      {submissionActionCopy.title}
                    </Text>
                    <Text
                      style={{
                        color: submissionActionCopy.accentColor,
                        fontSize: 13,
                        lineHeight: 19,
                        marginTop: 4,
                        opacity: 0.9,
                      }}
                    >
                      {submissionActionCopy.body}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={handlePickAndUploadPractice}
                disabled={isSubmittingPractice}
                style={{
                  marginTop: 14,
                  backgroundColor: isSubmittingPractice ? '#d1d5db' : '#111827',
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                {isSubmittingPractice ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                )}
                <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 14 }}>
                  {submissionActionCopy.buttonLabel}
                </Text>
              </TouchableOpacity>

              <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 10 }}>
                1 video por clase. Si vuelves a subir uno, reemplaza la entrega anterior.
              </Text>

              {submission?.videoUrl && submission.videoStatus === VideoStatus.READY ? (
                <PracticeVideoPlayer
                  uri={submission.videoUrl}
                  videoRef={submissionVideoRef}
                />
              ) : null}

              <View style={{ marginTop: 18 }}>
                <Text style={{ color: '#111827', fontSize: 15, fontWeight: '700' }}>
                  Feedback del profesor
                </Text>
                {isSubmissionLoading ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ActivityIndicator color="#f59e0b" />
                  </View>
                ) : submissionAnnotations.length > 0 ? (
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {submissionAnnotations.map((annotation) => (
                      <TouchableOpacity
                        key={annotation._id}
                        onPress={() => seekToAnnotation(annotation.timestampSeconds)}
                        style={{
                          borderRadius: 14,
                          backgroundColor: '#fff',
                          borderWidth: 1,
                          borderColor: '#e5e7eb',
                          padding: 12,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: '#92400e', fontWeight: '700', fontSize: 12 }}>
                            {formatSeconds(annotation.timestampSeconds)}
                          </Text>
                          <Ionicons name="play-forward-outline" size={16} color="#9ca3af" />
                        </View>
                        <Text style={{ color: '#1f2937', fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                          {annotation.text}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 8, lineHeight: 20 }}>
                    {submission
                      ? 'Todavía no hay anotaciones para esta práctica.'
                      : 'Cuando envíes tu práctica, aquí verás las anotaciones por minuto del profesor.'}
                  </Text>
                )}
              </View>
            </View>
          )}

          {isReviewer && (
            <View
              style={{
                marginTop: 24,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                backgroundColor: '#f8fafc',
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700' }}>
                    Prácticas para feedback
                  </Text>
                  <Text
                    style={{
                      color: '#6b7280',
                      fontSize: 13,
                      marginTop: 4,
                      lineHeight: 19,
                    }}
                  >
                    Cuando varios alumnos suben su video, aquí aparecen como tarjetas.
                    Toca una para abrir su práctica, revisar el video y dejar anotaciones.
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: '#111827',
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                    {reviewSubmissions.length} entrega{reviewSubmissions.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>

              {isReviewSubmissionsLoading ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator color="#f59e0b" />
                </View>
              ) : reviewSubmissions.length > 0 ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingTop: 14 }}
                  >
                    {reviewSummaryItems.map((summaryItem) => (
                      <TouchableOpacity
                        key={summaryItem.label}
                        onPress={() => setReviewFilter(summaryItem.key)}
                        style={{
                          minWidth: 112,
                          borderRadius: 16,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          backgroundColor: summaryItem.backgroundColor,
                          borderWidth: 1.5,
                          borderColor:
                            reviewFilter === summaryItem.key
                              ? summaryItem.color
                              : '#e5e7eb',
                          opacity: reviewFilter === summaryItem.key ? 1 : 0.92,
                        }}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={{
                            color: summaryItem.color,
                            fontSize: 20,
                            fontWeight: '800',
                          }}
                        >
                          {summaryItem.value}
                        </Text>
                        <Text
                          style={{
                            color: summaryItem.color,
                            fontSize: 12,
                            fontWeight: '600',
                            marginTop: 4,
                          }}
                        >
                          {summaryItem.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View
                    style={{
                      marginTop: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                      backgroundColor: '#fff',
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                    }}
                  >
                    <Ionicons name="search-outline" size={16} color="#9ca3af" />
                    <TextInput
                      value={reviewSearch}
                      onChangeText={setReviewSearch}
                      placeholder="Buscar alumno"
                      placeholderTextColor="#9ca3af"
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        paddingLeft: 8,
                        color: '#111827',
                        fontSize: 14,
                      }}
                    />
                    {reviewSearch.trim().length > 0 ? (
                      <TouchableOpacity onPress={() => setReviewSearch('')}>
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#9ca3af"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingTop: 12 }}
                  >
                    {REVIEW_FILTERS.map((filterOption) => {
                      const isActive = reviewFilter === filterOption.key;
                      const count = reviewFilterCounts[filterOption.key] || 0;
                      return (
                        <TouchableOpacity
                          key={filterOption.key}
                          onPress={() => setReviewFilter(filterOption.key)}
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            backgroundColor: isActive ? '#111827' : '#fff',
                            borderWidth: 1,
                            borderColor: isActive ? '#111827' : '#e5e7eb',
                          }}
                        >
                          <Text
                            style={{
                              color: isActive ? '#fff' : '#374151',
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {filterOption.label} ({count})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View
                    style={{
                      marginTop: 10,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#6b7280', fontSize: 12 }}>
                      {visibleReviewSubmissions.length} resultado
                      {visibleReviewSubmissions.length === 1 ? '' : 's'}
                    </Text>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                      Orden: sin revisar primero
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingTop: 14, paddingBottom: 4 }}
                  >
                    {visibleReviewSubmissions.map((reviewSubmission) => {
                      const cardStatus = getSubmissionStatusConfig(reviewSubmission);
                      const isActive =
                        selectedReviewSubmissionId === reviewSubmission._id;
                      return (
                        <TouchableOpacity
                          key={reviewSubmission._id}
                          onPress={() =>
                            setSelectedReviewSubmissionId(reviewSubmission._id ?? null)
                          }
                          style={{
                            width: 220,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: isActive ? '#111827' : '#e5e7eb',
                            backgroundColor: isActive ? '#fff' : '#f9fafb',
                            padding: 14,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: 8,
                            }}
                          >
                            <Text
                              style={{
                                color: '#111827',
                                fontSize: 14,
                                fontWeight: '700',
                                flex: 1,
                              }}
                              numberOfLines={2}
                            >
                              {getSubmissionStudentLabel(reviewSubmission)}
                            </Text>
                            <View
                              style={{
                                backgroundColor: cardStatus.backgroundColor,
                                borderRadius: 999,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                              }}
                            >
                              <Text
                                style={{
                                  color: cardStatus.color,
                                  fontSize: 11,
                                  fontWeight: '700',
                                }}
                              >
                                {getSubmissionReviewMeta(reviewSubmission)}
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={{
                              color: '#6b7280',
                              fontSize: 12,
                              marginTop: 8,
                            }}
                          >
                            {reviewSubmission.submittedAt
                              ? `Enviado ${new Date(
                                  reviewSubmission.submittedAt,
                                ).toLocaleDateString()}`
                              : 'Sin fecha de envío'}
                          </Text>

                          <Text
                            style={{
                              color: '#374151',
                              fontSize: 12,
                              marginTop: 6,
                            }}
                          >
                            {reviewSubmission.annotationsCount || 0} anotación
                            {(reviewSubmission.annotationsCount || 0) === 1 ? '' : 'es'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {visibleReviewSubmissions.length === 0 ? (
                    <View
                      style={{
                        marginTop: 14,
                        borderRadius: 14,
                        backgroundColor: '#fff',
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        padding: 16,
                      }}
                    >
                      <Text style={{ color: '#374151', fontSize: 13, lineHeight: 20 }}>
                        No encontramos entregas que coincidan con la búsqueda o el
                        filtro seleccionado.
                      </Text>
                    </View>
                  ) : null}

                  {selectedReviewSubmission ? (
                    <View
                      style={{
                        marginTop: 16,
                        borderRadius: 18,
                        backgroundColor: '#fff',
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        padding: 14,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 10,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: '#111827',
                              fontSize: 16,
                              fontWeight: '700',
                            }}
                          >
                            {selectedReviewStudentName}
                          </Text>
                          <Text
                            style={{
                              color: '#6b7280',
                              fontSize: 13,
                              marginTop: 4,
                            }}
                          >
                            Selecciona un momento del video y deja una anotación puntual.
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: selectedReviewStatusConfig.backgroundColor,
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          }}
                        >
                          <Ionicons
                            name={selectedReviewStatusConfig.icon}
                            size={13}
                            color={selectedReviewStatusConfig.color}
                          />
                          <Text
                            style={{
                              color: selectedReviewStatusConfig.color,
                              fontSize: 12,
                              fontWeight: '600',
                              marginLeft: 6,
                            }}
                          >
                            {selectedReviewStatusConfig.label}
                          </Text>
                        </View>
                      </View>

                      {selectedReviewSubmission.videoUrl &&
                      selectedReviewSubmission.videoStatus === VideoStatus.READY ? (
                        <PracticeVideoPlayer
                          uri={selectedReviewSubmission.videoUrl}
                          videoRef={submissionVideoRef}
                          height={240}
                          onPositionChange={(nextPositionMs, nextDurationMs) => {
                            setReviewPlayerPositionMs(nextPositionMs);
                            setReviewPlayerDurationMs(nextDurationMs);
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            marginTop: 14,
                            borderRadius: 16,
                            backgroundColor: '#111827',
                            padding: 14,
                          }}
                        >
                          <Text style={{ color: '#f9fafb', fontSize: 13 }}>
                            {selectedReviewSubmission.videoStatus === VideoStatus.PROCESSING
                              ? 'La práctica todavía se está procesando.'
                              : selectedReviewSubmission.videoProcessingError ||
                                'El video todavía no está disponible para revisión.'}
                          </Text>
                        </View>
                      )}

                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginTop: 12,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: '#f3f4f6',
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          }}
                        >
                          <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600' }}>
                            Momento: {formatSeconds(selectedReviewTimestamp)}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: '#eff6ff',
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          }}
                        >
                          <Text style={{ color: '#1d4ed8', fontSize: 12, fontWeight: '600' }}>
                            Reproductor: {formatSeconds(Math.floor(reviewPlayerPositionMs / 1000))}
                          </Text>
                        </View>
                        {reviewPlayerDurationMs > 0 && (
                          <View
                            style={{
                              backgroundColor: '#f9fafb',
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                            }}
                          >
                            <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '600' }}>
                              Duración: {formatSeconds(Math.floor(reviewPlayerDurationMs / 1000))}
                            </Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={handleCaptureReviewTimestamp}
                        style={{
                          marginTop: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#cbd5e1',
                          paddingVertical: 10,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#111827', fontWeight: '700' }}>
                          Usar momento actual del video
                        </Text>
                      </TouchableOpacity>

                      <TextInput
                        value={reviewAnnotationText}
                        onChangeText={setReviewAnnotationText}
                        placeholder="Escribe una observación para este momento del video"
                        placeholderTextColor="#9ca3af"
                        multiline
                        textAlignVertical="top"
                        style={{
                          marginTop: 12,
                          minHeight: 96,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: '#d1d5db',
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          color: '#111827',
                          fontSize: 14,
                          backgroundColor: '#fff',
                        }}
                      />

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <TouchableOpacity
                          onPress={handleSaveReviewAnnotation}
                          disabled={isSavingReviewAnnotation}
                          style={{
                            flex: 1,
                            borderRadius: 14,
                            backgroundColor: isSavingReviewAnnotation
                              ? '#d1d5db'
                              : '#111827',
                            paddingVertical: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isSavingReviewAnnotation ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={{ color: '#fff', fontWeight: '700' }}>
                              {editingReviewAnnotationId
                                ? 'Actualizar anotación'
                                : 'Guardar anotación'}
                            </Text>
                          )}
                        </TouchableOpacity>
                        {editingReviewAnnotationId ? (
                          <TouchableOpacity
                            onPress={() => {
                              setEditingReviewAnnotationId(null);
                              setReviewAnnotationText('');
                            }}
                            style={{
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: '#d1d5db',
                              paddingVertical: 14,
                              paddingHorizontal: 16,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: '#374151', fontWeight: '700' }}>
                              Cancelar
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <TouchableOpacity
                          onPress={() =>
                            handleUpdateReviewStatus(SubmissionReviewStatus.REVIEWED)
                          }
                          style={{
                            flex: 1,
                            borderRadius: 14,
                            backgroundColor: '#166534',
                            paddingVertical: 12,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            Marcar revisada
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            handleUpdateReviewStatus(
                              SubmissionReviewStatus.NEEDS_RESUBMISSION,
                            )
                          }
                          style={{
                            flex: 1,
                            borderRadius: 14,
                            backgroundColor: '#9a3412',
                            paddingVertical: 12,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            Pedir reenvío
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={{ marginTop: 18 }}>
                        <Text
                          style={{
                            color: '#111827',
                            fontSize: 15,
                            fontWeight: '700',
                          }}
                        >
                          Anotaciones guardadas
                        </Text>

                        {isReviewAnnotationsLoading ? (
                          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                            <ActivityIndicator color="#f59e0b" />
                          </View>
                        ) : reviewAnnotations.length > 0 ? (
                          <View style={{ marginTop: 10, gap: 10 }}>
                            {reviewAnnotations.map((annotation) => (
                              <View
                                key={annotation._id}
                                style={{
                                  borderRadius: 14,
                                  backgroundColor: '#f9fafb',
                                  borderWidth: 1,
                                  borderColor: '#e5e7eb',
                                  padding: 12,
                                }}
                              >
                                <TouchableOpacity
                                  onPress={() =>
                                    seekToAnnotation(annotation.timestampSeconds)
                                  }
                                >
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: '#92400e',
                                        fontWeight: '700',
                                        fontSize: 12,
                                      }}
                                    >
                                      {formatSeconds(annotation.timestampSeconds)}
                                    </Text>
                                    <Ionicons
                                      name="play-forward-outline"
                                      size={16}
                                      color="#9ca3af"
                                    />
                                  </View>
                                  <Text
                                    style={{
                                      color: '#1f2937',
                                      fontSize: 13,
                                      lineHeight: 19,
                                      marginTop: 6,
                                    }}
                                  >
                                    {annotation.text}
                                  </Text>
                                </TouchableOpacity>

                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setEditingReviewAnnotationId(annotation._id ?? null);
                                      setSelectedReviewTimestamp(
                                        annotation.timestampSeconds,
                                      );
                                      setReviewAnnotationText(annotation.text);
                                    }}
                                    style={{
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: '#d1d5db',
                                      paddingVertical: 8,
                                      paddingHorizontal: 12,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: '#374151',
                                        fontSize: 12,
                                        fontWeight: '700',
                                      }}
                                    >
                                      Editar
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() =>
                                      handleDeleteReviewAnnotation(annotation._id)
                                    }
                                    style={{
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: '#fecaca',
                                      paddingVertical: 8,
                                      paddingHorizontal: 12,
                                      backgroundColor: '#fef2f2',
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: '#b91c1c',
                                        fontSize: 12,
                                        fontWeight: '700',
                                      }}
                                    >
                                      Eliminar
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text
                            style={{
                              color: '#6b7280',
                              fontSize: 13,
                              marginTop: 8,
                              lineHeight: 20,
                            }}
                          >
                            Todavía no hay anotaciones para esta práctica.
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 12, lineHeight: 20 }}>
                  Aún no hay prácticas enviadas para esta clase.
                </Text>
              )}
            </View>
          )}

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
