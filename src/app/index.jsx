import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  ZoomIn,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import SongPickerSheet from "@/components/song-picker-sheet";
import { DEVICE_SCAN_SUPPORTED, useDeviceMp3s } from "@/hooks/use-device-mp3s";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Intervalo (ms) entre as atualizações de status do player. Também é usado
// para suavizar o avanço da barra de progresso entre uma atualização e outra.
const PLAYER_UPDATE_INTERVAL_MS = 500;

// Passo (ms) usado pelos leitores de tela para avançar/voltar na barra de progresso.
const ACCESSIBILITY_SEEK_STEP_MS = 10000;

// Medidas visuais da barra do player.
const PLAY_BUTTON_SIZE = 64;
const PROGRESS_TOUCH_HEIGHT = 32;
const PROGRESS_THUMB_SIZE = 14;

// Efeito de letreiro (marquee) do título da música.
const MARQUEE_GAP = 44;
const MARQUEE_START_PAUSE_MS = 1600;
const MARQUEE_SPEED_PX_PER_MS = 0.04;
const MARQUEE_FADE_STEPS = 8;

const STORAGE_KEY = "player-de-musica-native";

const DEFAULT_SETTINGS = {
  autoAdvance: true,
  shuffle: false,
  lightMode: false,
};

const DARK = {
  background: "#090b12",
  surface: "#15141d",
  surfaceRaised: "#201e2b",
  border: "#343144",
  text: "#f7f5ff",
  muted: "#aaa6b8",
  accent: "#a98cff",
  accentStrong: "#c5b4ff",
  buttonForeground: "#171323",
  header: "#11121a",
  danger: "#ee8292",
};

const LIGHT = {
  background: "#ffffff",
  surface: "#ffffff",
  surfaceRaised: "#f4f0ff",
  border: "#e5ddf6",
  text: "#292638",
  muted: "#706d78",
  accent: "#a98cff",
  accentStrong: "#c5b4ff",
  buttonForeground: "#ffffff",
  header: "#ffffff",
  danger: "#bd4258",
};

const BUILT_IN_PLAYLISTS = [
  {
    id: "all",
    name: "Todas as músicas",
    description: "Sua biblioteca completa em ordem alfabética.",
  },
  {
    id: "recent",
    name: "Adicionadas recentemente",
    description: "Ouça primeiro as músicas que você adicionou por último.",
  },
];

const MP3_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/x-mpeg",
  "audio/x-mp3",
  "audio/mpeg3",
  "audio/x-mpeg-3",
]);

// Músicas importadas pelo seletor de arquivos são cópias guardadas dentro do app.
// Músicas encontradas no aparelho apontam para o arquivo original e nunca
// devem ser apagadas por nós.
function isAppOwnedFile(uri) {
  const directory = FileSystem.documentDirectory;
  return Boolean(directory) && typeof uri === "string" && uri.startsWith(directory);
}

function isValidId(value) {
  return (
    (typeof value === "string" && value.length > 0) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function normalizeSongs(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (song) =>
        song &&
        typeof song === "object" &&
        isValidId(song.id) &&
        typeof song.uri === "string" &&
        song.uri.length > 0 &&
        typeof song.name === "string" &&
        song.name.length > 0,
    )
    .map((song) => ({
      ...song,
      id: String(song.id),
      displayName:
        typeof song.displayName === "string"
          ? song.displayName
          : song.name.replace(/\.mp3$/i, ""),
      addedAt: Number.isFinite(song.addedAt) ? song.addedAt : 0,
    }));
}

function normalizePlaylists(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (playlist) =>
        playlist &&
        typeof playlist === "object" &&
        isValidId(playlist.id) &&
        typeof playlist.name === "string" &&
        playlist.name.trim().length > 0,
    )
    .map((playlist) => ({
      ...playlist,
      id: String(playlist.id),
      songIds: Array.isArray(playlist.songIds)
        ? playlist.songIds.filter(isValidId).map(String)
        : [],
    }));
}

function formatTime(milliseconds = 0) {
  const totalSeconds = Math.floor(Math.max(milliseconds, 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Título da música com efeito de letreiro: quando o nome é maior que o espaço
// disponível, ele corre para a esquerda até o fim e o início volta a aparecer
// logo atrás, em loop contínuo. Nomes curtos ficam parados.
//
// O texto fica dentro de um ScrollView horizontal (sem rolagem) porque, nele, o
// texto é medido sem limite de largura. Em uma View comum o Android corta o
// texto com "..." e a largura real nunca é descoberta.
function PlayerTitle({ title, colors, styles }) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const offset = useSharedValue(0);
  const isOverflowing = viewportWidth > 0 && textWidth - viewportWidth > 1;
  const distance = textWidth + MARQUEE_GAP;

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() }],
  }));
  // A sombra da esquerda só aparece enquanto o texto está em movimento.
  const leftFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      offset.get(),
      [-distance, -(distance - 16), -16, 0],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  useEffect(() => {
    cancelAnimation(offset);
    offset.set(0);

    if (!isOverflowing) return undefined;

    offset.set(
      withRepeat(
        withSequence(
          withDelay(
            MARQUEE_START_PAUSE_MS,
            withTiming(-distance, {
              duration: distance / MARQUEE_SPEED_PX_PER_MS,
              easing: Easing.linear,
            }),
          ),
          // A segunda cópia do texto está exatamente onde a primeira começou,
          // então voltar a zero não é perceptível.
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );

    return () => cancelAnimation(offset);
  }, [distance, isOverflowing, offset, title]);

  const fadeSteps = useMemo(
    () => Array.from({ length: MARQUEE_FADE_STEPS }, (_, index) => index),
    [],
  );

  return (
    <View
      style={styles.playerTitleViewport}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        bounces={false}
        horizontal
        overScrollMode="never"
        pointerEvents="none"
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.playerTitleScroll}
      >
        <Animated.View style={[styles.playerTitleTrack, trackStyle]}>
          <View
            onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
            style={styles.playerTitleCopy}
          >
            <Text numberOfLines={1} style={styles.nowPlayingName}>
              {title}
            </Text>
          </View>
          {isOverflowing && (
            <View style={[styles.playerTitleCopy, { marginLeft: MARQUEE_GAP }]}>
              <Text numberOfLines={1} style={styles.nowPlayingName}>
                {title}
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
      {isOverflowing && (
        <>
          <View
            pointerEvents="none"
            style={[styles.playerTitleFade, styles.playerTitleFadeRight]}
          >
            {fadeSteps.map((step) => (
              <View
                key={step}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  opacity: Math.pow((step + 1) / MARQUEE_FADE_STEPS, 1.6),
                }}
              />
            ))}
          </View>
          <Animated.View
            pointerEvents="none"
            style={[styles.playerTitleFade, styles.playerTitleFadeLeft, leftFadeStyle]}
          >
            {fadeSteps.map((step) => (
              <View
                key={step}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  opacity: Math.pow((MARQUEE_FADE_STEPS - step) / MARQUEE_FADE_STEPS, 1.6),
                }}
              />
            ))}
          </Animated.View>
        </>
      )}
    </View>
  );
}

// Ícone dentro de uma caixa quadrada fixa, sem o espaçamento extra de fonte que
// o Android adiciona e que deixava o glifo deslocado do centro.
function CenteredIcon({ color, name, size }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Ionicons
        color={color}
        name={name}
        size={size}
        style={{
          width: size,
          height: size,
          lineHeight: size,
          textAlign: "center",
          textAlignVertical: "center",
          includeFontPadding: false,
        }}
      />
    </View>
  );
}

// Miniatura da música: ícone estático, sem animação.
function PlayerArtwork({ colors, styles }) {
  return (
    <View style={styles.miniArtwork}>
      <Ionicons name="musical-notes" size={20} color={colors.accent} />
    </View>
  );
}

// Pontinho do rótulo "TOCANDO AGORA": pulsa enquanto a música toca.
function LiveDot({ isPlaying, styles }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(pulse);
    if (isPlaying) {
      pulse.set(
        withRepeat(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          -1,
          true,
        ),
      );
    } else {
      pulse.set(withTiming(0, { duration: 240 }));
    }
    return () => cancelAnimation(pulse);
  }, [isPlaying, pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + pulse.get() * 0.6,
  }));

  return <Animated.View style={[styles.liveDot, dotStyle]} />;
}

// Botão de controle (anterior / próxima). Ao tocar, o botão encolhe um pouco e o
// ícone dá um pequeno empurrão na direção `nudge`, voltando com um quique.
function PlayerControlButton({
  accessibilityLabel,
  children,
  disabled,
  nudge = 0,
  onPress,
  style,
}) {
  const scale = useSharedValue(1);
  const nudgeX = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudgeX.get() }],
  }));
  const handlePressIn = useCallback(() => {
    scale.set(withSpring(0.9, { damping: 18, stiffness: 380 }));
    nudgeX.set(withSpring(nudge, { damping: 12, stiffness: 320 }));
  }, [nudge, nudgeX, scale]);
  const handlePressOut = useCallback(() => {
    scale.set(withSpring(1, { damping: 10, stiffness: 260 }));
    nudgeX.set(withSpring(0, { damping: 8, stiffness: 240 }));
  }, [nudgeX, scale]);

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      <Animated.View style={iconStyle}>{children}</Animated.View>
    </AnimatedPressable>
  );
}

// Triângulo do play com cantos arredondados, desenhado só com Views: um
// triângulo reto preenchido por dentro e três barras de pontas redondas sobre
// as arestas (como um traço com "round join"). A caixa tem o tamanho exato do
// desenho, então o centralizador do botão o deixa no centro de verdade.
const PLAY_ROUND = 6; // espessura do traço = diâmetro dos cantos
const PLAY_HEIGHT = 20; // altura do triângulo (linha central do traço)
const PLAY_WIDTH = 18; // largura do triângulo (linha central do traço)
const PLAY_BOX_WIDTH = PLAY_WIDTH + PLAY_ROUND;
const PLAY_BOX_HEIGHT = PLAY_HEIGHT + PLAY_ROUND;
const PLAY_EDGE_LENGTH = Math.hypot(PLAY_WIDTH, PLAY_HEIGHT / 2);
const PLAY_EDGE_ANGLE = (Math.atan2(PLAY_HEIGHT / 2, PLAY_WIDTH) * 180) / Math.PI;

function PlayTriangle({ color }) {
  const half = PLAY_ROUND / 2;
  const edgeWidth = PLAY_EDGE_LENGTH + PLAY_ROUND;
  const edgeCenterX = half + PLAY_WIDTH / 2;
  const bar = {
    position: "absolute",
    height: PLAY_ROUND,
    borderRadius: half,
    backgroundColor: color,
  };
  return (
    // O peso visual do triângulo fica na base; 2 px à direita o centraliza ao olhar.
    <View
      style={{
        width: PLAY_BOX_WIDTH,
        height: PLAY_BOX_HEIGHT,
        transform: [{ translateX: 2 }],
      }}
    >
      <View
        style={{
          position: "absolute",
          left: half,
          top: half,
          width: 0,
          height: 0,
          borderTopWidth: PLAY_HEIGHT / 2,
          borderBottomWidth: PLAY_HEIGHT / 2,
          borderLeftWidth: PLAY_WIDTH,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          borderLeftColor: color,
        }}
      />
      <View
        style={{
          ...bar,
          left: 0,
          top: 0,
          width: PLAY_ROUND,
          height: PLAY_BOX_HEIGHT,
        }}
      />
      <View
        style={{
          ...bar,
          left: edgeCenterX - edgeWidth / 2,
          top: half + PLAY_HEIGHT / 4 - half,
          width: edgeWidth,
          transform: [{ rotate: `${PLAY_EDGE_ANGLE}deg` }],
        }}
      />
      <View
        style={{
          ...bar,
          left: edgeCenterX - edgeWidth / 2,
          top: half + (PLAY_HEIGHT * 3) / 4 - half,
          width: edgeWidth,
          transform: [{ rotate: `${-PLAY_EDGE_ANGLE}deg` }],
        }}
      />
    </View>
  );
}

// Botão principal: o ícone troca entre play e pause com um zoom curto e a forma
// do botão passa de círculo para um quadrado arredondado.
function PlayPauseButton({
  accessibilityLabel,
  buttonForeground,
  disabled,
  isPlaying,
  onPress,
  styles,
}) {
  const scale = useSharedValue(1);
  const playing = useSharedValue(isPlaying ? 1 : 0);

  useEffect(() => {
    playing.set(
      withSpring(isPlaying ? 1 : 0, { damping: 13, stiffness: 190, mass: 0.8 }),
    );
  }, [isPlaying, playing]);

  const buttonStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(
      playing.get(),
      [0, 1],
      [PLAY_BUTTON_SIZE / 2, PLAY_BUTTON_SIZE * 0.36],
      Extrapolation.CLAMP,
    ),
    transform: [{ scale: scale.get() }],
  }));
  const handlePressIn = useCallback(() => {
    scale.set(withSpring(0.9, { damping: 18, stiffness: 380 }));
  }, [scale]);
  const handlePressOut = useCallback(() => {
    scale.set(withSpring(1, { damping: 8, stiffness: 240 }));
  }, [scale]);

  return (
    <View style={styles.playButtonWrap}>
      <AnimatedPressable
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.playButton, disabled && styles.disabledPlayButton, buttonStyle]}
      >
        {/* Só um ícone existe por vez, centralizado pelo próprio botão. A
            troca é um "zoom" curto; o key faz o ícone novo entrar animado. */}
        {disabled ? (
          <CenteredIcon color={buttonForeground} name="play" size={32} />
        ) : isPlaying ? (
          <Animated.View key="pause" entering={ZoomIn.duration(180)} style={styles.pauseBars}>
            <View style={styles.pauseBar} />
            <View style={styles.pauseBar} />
          </Animated.View>
        ) : (
          <Animated.View key="play" entering={ZoomIn.duration(180)}>
            <PlayTriangle color={buttonForeground} />
          </Animated.View>
        )}
      </AnimatedPressable>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    screen: { flex: 1, backgroundColor: colors.background },
    webShell: { width: "100%", maxWidth: 760, alignSelf: "center" },
    headerContainer: { overflow: "hidden" },
    header: {
      minHeight: 51,
      paddingHorizontal: 15,
      paddingVertical: 9,
      backgroundColor: colors.header,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    brand: { flexDirection: "row", alignItems: "center", gap: 9 },
    brandMark: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    brandTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
    headerButton: {
      width: 63,
      height: 63,
      marginVertical: -15,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    content: { padding: 20, paddingBottom: 28, gap: 18 },
    intro: { gap: 6, marginBottom: 2 },
    heading: { color: colors.text, fontSize: 25, fontWeight: "700" },
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 18,
      padding: 16,
      gap: 14,
    },
    playlistCard: { minHeight: 168 },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 13 },
    artwork: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    artworkLarge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accent,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
      marginBottom: 3,
    },
    cardText: { flex: 1, gap: 5 },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
    cardDescription: { color: colors.muted, fontSize: 13, lineHeight: 18 },
    cardCount: { color: colors.muted, fontSize: 12, fontWeight: "600" },
    cardActions: { flexDirection: "row", alignItems: "center", gap: 9 },
    primaryButton: {
      minHeight: 44,
      borderRadius: 13,
      backgroundColor: colors.accent,
      paddingHorizontal: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      flex: 1,
    },
    primaryButtonText: { color: colors.buttonForeground, fontSize: 14, fontWeight: "700" },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
    },
    addCard: {
      minHeight: 104,
      padding: 18,
      borderRadius: 18,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
      backgroundColor: colors.surface,
    },
    addCardText: { color: colors.text, fontWeight: "700", fontSize: 15 },
    songCard: { minHeight: 134 },
    currentSongCard: { borderColor: colors.accent },
    songHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
    songMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    songArtwork: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
    },
    songName: { color: colors.text, fontSize: 15, fontWeight: "700" },
    songSubtext: { color: colors.muted, fontSize: 12, marginTop: 4 },
    emptyState: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 24,
      gap: 10,
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
    emptyText: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    backButton: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingVertical: 5,
    },
    backText: { color: colors.accentStrong, fontWeight: "600", fontSize: 14 },
    status: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      marginHorizontal: 20,
      marginBottom: 8,
    },
    playerBar: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 22,
      paddingTop: 18,
      paddingBottom: Platform.OS === "ios" ? 10 : 16,
      gap: 16,
    },
    playerTrack: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    miniArtwork: {
      width: 56,
      height: 56,
      borderRadius: 20,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    playerInfo: { flex: 1, minWidth: 0, gap: 4 },
    nowPlayingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.accent,
    },
    nowPlayingLabel: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.3,
    },
    nowPlayingName: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 24,
      fontWeight: "700",
      letterSpacing: -0.2,
    },
    playerTitleViewport: { height: 24, minWidth: 0, overflow: "hidden" },
    playerTitleScroll: { flexGrow: 0, height: 24 },
    playerTitleTrack: { flexDirection: "row", alignItems: "center" },
    playerTitleCopy: { flexShrink: 0 },
    playerTitleFade: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: 24,
      flexDirection: "row",
    },
    playerTitleFadeRight: { right: 0 },
    playerTitleFadeLeft: { left: 0 },
    playerControls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
    },
    skipButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
    },
    playButtonWrap: {
      width: PLAY_BUTTON_SIZE,
      height: PLAY_BUTTON_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    playButton: {
      width: PLAY_BUTTON_SIZE,
      height: PLAY_BUTTON_SIZE,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    // Play e pause são desenhados com Views (e não com a fonte de ícones) para
    // ficarem exatamente centralizados.
    pauseBars: { flexDirection: "row", alignItems: "center", gap: 6 },
    pauseBar: {
      width: 7,
      height: 24,
      borderRadius: 3,
      backgroundColor: colors.buttonForeground,
    },
    disabledPlayButton: { opacity: 0.55 },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    progressSliderWrap: { flex: 1 },
    // Área de toque maior que a trilha visual (6 px); as margens negativas
    // mantêm o layout com a mesma altura da trilha.
    progressTouchArea: {
      height: PROGRESS_TOUCH_HEIGHT,
      marginVertical: -13,
      justifyContent: "center",
      position: "relative",
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressFill: {
      width: "100%",
      height: "100%",
      borderRadius: 3,
      backgroundColor: colors.accent,
    },
    progressThumb: {
      position: "absolute",
      left: 0,
      top: (PROGRESS_TOUCH_HEIGHT - PROGRESS_THUMB_SIZE) / 2,
      width: PROGRESS_THUMB_SIZE,
      height: PROGRESS_THUMB_SIZE,
      borderRadius: PROGRESS_THUMB_SIZE / 2,
      borderWidth: 2,
      borderColor: colors.surface,
      backgroundColor: colors.accent,
    },
    timeText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "600",
      minWidth: 36,
      fontVariant: ["tabular-nums"],
    },
    timeTextEnd: { textAlign: "right" },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.62)",
      justifyContent: "center",
      padding: 22,
    },
    modalCard: {
      padding: 20,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 16,
    },
    modalTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
    input: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 13,
      color: colors.text,
      backgroundColor: colors.surfaceRaised,
      fontSize: 15,
    },
    settingRow: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    settingText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    settingDetail: { color: colors.muted, fontSize: 12, marginTop: 4 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
    modalActionButton: {
      minHeight: 44,
      borderRadius: 12,
      paddingHorizontal: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceRaised,
    },
    modalActionPrimary: { backgroundColor: colors.accent },
    modalActionText: { color: colors.text, fontSize: 14, fontWeight: "700" },
    modalActionPrimaryText: { color: colors.buttonForeground },
  });
}

const PlaylistItem = React.memo(function PlaylistItem({
  playlist,
  songCount,
  colors,
  styles,
  onOpenPlaylist,
  onRenamePlaylist,
  onRemovePlaylist,
}) {
  const isBuiltIn = playlist.id === "all" || playlist.id === "recent";
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const pressIn = useCallback(() => {
    pressScale.set(withTiming(0.985, { duration: 70 }));
  }, [pressScale]);
  const pressOut = useCallback(() => {
    pressScale.set(withSpring(1, {
      damping: 18,
      stiffness: 420,
      mass: 0.65,
      overshootClamping: true,
    }));
  }, [pressScale]);

  return (
    <Animated.View style={[styles.card, styles.playlistCard, pressStyle]}>
      <View style={styles.cardTop}>
        <View style={styles.artwork}>
          <Ionicons
            name={
              playlist.id === "recent"
                ? "time-outline"
                : isBuiltIn
                  ? "musical-notes"
                  : "musical-note"
            }
            size={27}
            color={colors.accent}
          />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{playlist.name}</Text>
          <Text style={styles.cardDescription}>
            {playlist.description || "Sua playlist personalizada."}
          </Text>
          <Text style={styles.cardCount}>
            {songCount} {songCount === 1 ? "música" : "músicas"}
          </Text>
        </View>
      </View>
      {isBuiltIn ? (
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => onOpenPlaylist(playlist.id)}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Abrir playlist</Text>
          <Ionicons name="arrow-forward" size={17} color={colors.buttonForeground} />
        </AnimatedPressable>
      ) : (
        <View style={styles.cardActions}>
          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => onOpenPlaylist(playlist.id)}
            onPressIn={pressIn}
            onPressOut={pressOut}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Abrir playlist</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.buttonForeground} />
          </AnimatedPressable>
          <Pressable
            accessibilityLabel={`Renomear ${playlist.name}`}
            onPress={() => onRenamePlaylist(playlist)}
            style={styles.iconButton}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Remover ${playlist.name}`}
            onPress={() => onRemovePlaylist(playlist)}
            style={styles.iconButton}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
});

const SongItem = React.memo(function SongItem({
  song,
  isCurrent,
  isPlaying,
  colors,
  styles,
  onPlaySong,
  onTogglePlayback,
  onRenameSong,
  onRemoveSong,
}) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const pressIn = useCallback(() => {
    pressScale.set(withTiming(0.985, { duration: 70 }));
  }, [pressScale]);
  const pressOut = useCallback(() => {
    pressScale.set(withSpring(1, {
      damping: 18,
      stiffness: 420,
      mass: 0.65,
      overshootClamping: true,
    }));
  }, [pressScale]);

  return (
    <Animated.View
      style={[
        styles.card,
        styles.songCard,
        isCurrent && styles.currentSongCard,
        pressStyle,
      ]}
    >
      <View style={styles.songHeader}>
        <AnimatedPressable
          onPress={() => onPlaySong(song)}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={styles.songMain}
        >
          <View style={styles.songArtwork}>
            <Ionicons
              name={isCurrent && isPlaying ? "volume-high" : "musical-note"}
              size={23}
              color={colors.accent}
            />
          </View>
          <View style={styles.cardText}>
            <Text numberOfLines={2} style={styles.songName}>
              {song.displayName || song.name}
            </Text>
            <Text numberOfLines={1} style={styles.songSubtext}>
              {isCurrent && isPlaying ? "Tocando agora" : "Arquivo MP3"}
            </Text>
          </View>
        </AnimatedPressable>
        <Pressable
          accessibilityLabel={`Renomear ${song.displayName || song.name}`}
          onPress={() => onRenameSong(song)}
          hitSlop={6}
          style={styles.iconButton}
        >
          <Ionicons name="pencil-outline" size={17} color={colors.muted} />
        </Pressable>
        <Pressable
          accessibilityLabel={`Remover ${song.displayName || song.name}`}
          onPress={() => onRemoveSong(song)}
          hitSlop={6}
          style={styles.iconButton}
        >
          <Ionicons name="trash-outline" size={17} color={colors.danger} />
        </Pressable>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          onPress={() => (isCurrent ? onTogglePlayback() : onPlaySong(song))}
          style={styles.primaryButton}
        >
          <Ionicons
            name={isCurrent && isPlaying ? "pause" : "play"}
            size={17}
            color={colors.buttonForeground}
          />
          <Text style={styles.primaryButtonText}>
            {isCurrent && isPlaying ? "Pausar" : "Reproduzir"}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
});

const PlaylistLibrary = React.memo(function PlaylistLibrary({
  activePlaylistId,
  playlistSongs,
  playlists,
  songs,
  customPlaylist,
  currentSongId,
  isPlaying,
  colors,
  styles,
  onBack,
  onOpenPlaylist,
  onCreatePlaylist,
  onImportSongs,
  onPlaySong,
  onTogglePlayback,
  onRenameSong,
  onRemoveSong,
  onRenamePlaylist,
  onRemovePlaylist,
}) {
  const playlistItems = useMemo(
    () => [...BUILT_IN_PLAYLISTS, ...playlists],
    [playlists],
  );
  const songIds = useMemo(
    () => new Set(songs.map((song) => String(song.id))),
    [songs],
  );
  const listData = activePlaylistId ? playlistSongs : playlistItems;

  const renderItem = useCallback(
    ({ item }) => {
      if (!activePlaylistId) {
        const songCount =
          item.id === "all" || item.id === "recent"
            ? songs.length
            : (item.songIds || []).filter((id) => songIds.has(String(id))).length;

        return (
          <PlaylistItem
            playlist={item}
            songCount={songCount}
            colors={colors}
            styles={styles}
            onOpenPlaylist={onOpenPlaylist}
            onRenamePlaylist={onRenamePlaylist}
            onRemovePlaylist={onRemovePlaylist}
          />
        );
      }

      return (
        <SongItem
          song={item}
          isCurrent={currentSongId === item.id}
          isPlaying={isPlaying}
          colors={colors}
          styles={styles}
          onPlaySong={onPlaySong}
          onTogglePlayback={onTogglePlayback}
          onRenameSong={onRenameSong}
          onRemoveSong={onRemoveSong}
        />
      );
    },
    [
      activePlaylistId,
      colors,
      currentSongId,
      isPlaying,
      onOpenPlaylist,
      onPlaySong,
      onRemovePlaylist,
      onRemoveSong,
      onRenamePlaylist,
      onRenameSong,
      onTogglePlayback,
      songIds,
      songs.length,
      styles,
    ],
  );

  const listHeader = useMemo(
    () =>
      activePlaylistId ? (
        <>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color={colors.accentStrong} />
            <Text style={styles.backText}>Voltar às playlists</Text>
          </Pressable>
          <View style={styles.intro}>
            <Text style={styles.heading}>
              {customPlaylist?.name ||
                BUILT_IN_PLAYLISTS.find(
                  (playlist) => playlist.id === activePlaylistId,
                )?.name ||
                "Suas músicas"}
            </Text>
            <Text style={styles.subtitle}>
              {playlistSongs.length}{" "}
              {playlistSongs.length === 1 ? "música" : "músicas"}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.intro}>
          <Text style={styles.heading}>Suas playlists</Text>
          <Text style={styles.subtitle}>
            Escolha uma playlist para começar a ouvir.
          </Text>
        </View>
      ),
    [
      activePlaylistId,
      colors.accentStrong,
      customPlaylist,
      onBack,
      playlistSongs.length,
      styles,
    ],
  );
  const listFooter = useMemo(
    () => (
      <Pressable
        onPress={activePlaylistId ? onImportSongs : onCreatePlaylist}
        style={styles.addCard}
      >
        <Ionicons name="add-circle" size={26} color={colors.accent} />
        <Text style={styles.addCardText}>
          {activePlaylistId ? "Adicionar músicas MP3" : "Nova playlist"}
        </Text>
      </Pressable>
    ),
    [activePlaylistId, colors.accent, onCreatePlaylist, onImportSongs, styles],
  );
  const listEmpty = useMemo(
    () =>
      activePlaylistId ? (
        <View style={styles.emptyState}>
          <View style={styles.artworkLarge}>
            <Ionicons name="musical-notes" size={34} color="#fff" />
          </View>
          <Text style={styles.emptyTitle}>Sua playlist está vazia</Text>
          <Text style={styles.emptyText}>
            Adicione arquivos MP3 para começar a ouvir suas músicas aqui.
          </Text>
        </View>
      ) : null,
    [activePlaylistId, styles],
  );

  return (
    <Animated.FlatList
      key={activePlaylistId ? "songs" : "playlists"}
      style={styles.screen}
      data={listData}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      ListEmptyComponent={listEmpty}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
      maxToRenderPerBatch={5}
      updateCellsBatchingPeriod={16}
      windowSize={3}
      removeClippedSubviews={Platform.OS === "android"}
      disableVirtualization={false}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      bounces={Platform.OS === "ios"}
      alwaysBounceVertical={Platform.OS === "ios"}
      overScrollMode={Platform.OS === "android" ? "always" : "never"}
      decelerationRate={Platform.OS === "android" ? 0.985 : "normal"}
    />
  );
});

// Barra de progresso controlada por gestos nativos (react-native-gesture-handler).
// Os callbacks dos gestos rodam na thread de UI: a bolinha acompanha o dedo sem
// passar pelo JS a cada movimento. O JS só é acionado uma vez, ao soltar, para
// chamar o seekTo do player.
const ProgressSlider = React.memo(function ProgressSlider({
  progress,
  durationMillis,
  isPlaying,
  onSeek,
  styles,
}) {
  const sliderWidth = useSharedValue(0);
  const animatedProgress = useSharedValue(
    Math.min(Math.max(progress, 0), 1),
  );
  // Verdadeiro enquanto o usuário está com o dedo na barra.
  const isDragging = useSharedValue(false);
  // Evita buscar duas vezes no mesmo toque e reverter uma busca já feita.
  const didCommit = useSharedValue(false);
  // Últimos valores vindos do player, lidos pelos callbacks que rodam no JS.
  const latestRef = useRef({ progress, durationMillis });
  const canSeek = durationMillis > 0;

  const fillStyle = useAnimatedStyle(() => ({
    // A trilha tem overflow hidden: deslocar o preenchimento (largura total)
    // para a esquerda dá o mesmo visual de animar a largura, sem recalcular layout.
    transform: [
      { translateX: (animatedProgress.get() - 1) * sliderWidth.get() },
    ],
  }));
  // A bolinha cresce com um quique enquanto o dedo está na barra.
  const thumbScale = useDerivedValue(() =>
    withSpring(isDragging.get() ? 1.4 : 1, { damping: 13, stiffness: 280 }),
  );
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          animatedProgress.get() * sliderWidth.get() - PROGRESS_THUMB_SIZE / 2,
      },
      { scale: thumbScale.get() },
    ],
  }));

  const commitSeek = useCallback(
    (ratio) => {
      onSeek(ratio, latestRef.current.durationMillis);
    },
    [onSeek],
  );

  // Volta a barra para a posição real da música (toque cancelado pelo sistema).
  const syncToPlayback = useCallback(() => {
    if (didCommit.get()) return;
    animatedProgress.set(Math.min(Math.max(latestRef.current.progress, 0), 1));
  }, [animatedProgress, didCommit]);

  const gesture = useMemo(() => {
    const moveTo = (x) => {
      "worklet";
      const width = sliderWidth.get();
      if (width > 0) {
        animatedProgress.set(Math.min(Math.max(x / width, 0), 1));
      }
    };
    const commit = () => {
      "worklet";
      if (didCommit.get()) return;
      didCommit.set(true);
      scheduleOnRN(commitSeek, animatedProgress.get());
    };

    const pan = Gesture.Pan()
      .enabled(canSeek)
      .minDistance(4)
      .onBegin((event) => {
        isDragging.set(true);
        didCommit.set(false);
        moveTo(event.x);
      })
      .onUpdate((event) => {
        moveTo(event.x);
      })
      .onEnd(() => {
        commit();
      })
      .onFinalize(() => {
        isDragging.set(false);
        if (!didCommit.get()) scheduleOnRN(syncToPlayback);
      });

    // Toque simples em qualquer ponto da barra pula para aquele ponto.
    const tap = Gesture.Tap()
      .enabled(canSeek)
      .maxDuration(10000)
      .onEnd((event) => {
        moveTo(event.x);
        commit();
      });

    return Gesture.Race(pan, tap);
  }, [
    animatedProgress,
    canSeek,
    commitSeek,
    didCommit,
    isDragging,
    sliderWidth,
    syncToPlayback,
  ]);

  useEffect(() => {
    latestRef.current = { progress, durationMillis };
  }, [progress, durationMillis]);

  // Ações dos leitores de tela (TalkBack): avançar ou voltar um passo fixo.
  const adjustBy = useCallback(
    (deltaMillis) => {
      const { progress: current, durationMillis: total } = latestRef.current;
      if (!total) return;
      const ratio = Math.min(Math.max(current + deltaMillis / total, 0), 1);
      animatedProgress.set(ratio);
      onSeek(ratio, total);
    },
    [animatedProgress, onSeek],
  );

  // Valor falado em passos de 5 s, para o leitor de tela não repetir a cada atualização.
  const spokenPosition = Math.floor((progress * durationMillis) / 5000) * 5000;

  useEffect(() => {
    if (isDragging.get()) return;
    const next = Math.min(Math.max(progress, 0), 1);
    const delta = next - animatedProgress.get();
    if (isPlaying && delta > 0 && delta < 0.15) {
      // Avanço normal da música: desliza até a nova posição em vez de dar saltos.
      animatedProgress.set(
        withTiming(next, {
          duration: PLAYER_UPDATE_INTERVAL_MS,
          easing: Easing.linear,
        }),
      );
    } else {
      animatedProgress.set(next);
    }
  }, [animatedProgress, isDragging, isPlaying, progress]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Avançar ou retroceder na música"
        accessibilityValue={{
          text: canSeek
            ? `${formatTime(spokenPosition)} de ${formatTime(durationMillis)}`
            : "Nenhuma música tocando",
        }}
        accessibilityActions={[
          { name: "increment", label: "Avançar 10 segundos" },
          { name: "decrement", label: "Voltar 10 segundos" },
        ]}
        onAccessibilityAction={(event) => {
          const action = event.nativeEvent.actionName;
          if (action === "increment") adjustBy(ACCESSIBILITY_SEEK_STEP_MS);
          if (action === "decrement") adjustBy(-ACCESSIBILITY_SEEK_STEP_MS);
        }}
        onLayout={(event) => {
          sliderWidth.set(event.nativeEvent.layout.width);
        }}
        style={styles.progressTouchArea}
      >
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, fillStyle]} />
        </View>
        <Animated.View style={[styles.progressThumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
});

export default function App() {
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [playback, setPlayback] = useState({
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameDialog, setNameDialog] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [status, setStatus] = useState("");
  const [finishedPlayback, setFinishedPlayback] = useState(null);
  const volumeRef = useRef(1);
  const soundRef = useRef(null);
  const playbackStatusSubscriptionRef = useRef(null);
  const currentSongRef = useRef(currentSong);
  const currentQueueRef = useRef([]);
  const playbackHistoryRef = useRef([]);
  const settingsRef = useRef(settings);
  const styles = useMemo(
    () => createStyles(settings.lightMode ? LIGHT : DARK),
    [settings.lightMode],
  );
  const colors = settings.lightMode ? LIGHT : DARK;

  const customPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) || null,
    [playlists, activePlaylistId],
  );

  // Lista de MP3 do aparelho, carregada em segundo plano e só exibida na janela
  // de "Adicionar música".
  const deviceMp3s = useDeviceMp3s();
  const scanDeviceMp3s = deviceMp3s.scan;

  // Ids que já estão no destino da adição (playlist aberta ou biblioteca).
  const pickerAddedIds = useMemo(
    () =>
      new Set(
        customPlaylist
          ? (customPlaylist.songIds || []).map(String)
          : songs.map((song) => String(song.id)),
      ),
    [customPlaylist, songs],
  );

  const playlistSongs = useMemo(() => {
    if (activePlaylistId === "recent") {
      return [...songs].sort(
        (a, b) =>
          b.addedAt - a.addedAt ||
          (a.displayName || a.name).localeCompare(
            b.displayName || b.name,
            "pt-BR",
          ),
      );
    }
    if (customPlaylist) {
      const songsById = new Map(songs.map((song) => [String(song.id), song]));
      return (customPlaylist.songIds || [])
        .map((id) => songsById.get(String(id)))
        .filter(Boolean);
    }
    return [...songs].sort((a, b) =>
      (a.displayName || a.name).localeCompare(
        b.displayName || b.name,
        "pt-BR",
      ),
    );
  }, [activePlaylistId, customPlaylist, songs]);

  useEffect(() => {
    currentQueueRef.current = playlistSongs;
  }, [activePlaylistId, playlistSongs]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: "doNotMix",
        });
      } catch (error) {
        if (mounted) {
          setStatus(`Não foi possível configurar o áudio: ${error.message}`);
        }
      }
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && mounted) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.songs)) {
              const normalizedSongs = normalizeSongs(parsed.songs);
              setSongs(normalizedSongs);
              if (normalizedSongs.length !== parsed.songs.length) {
                setStatus("Algumas músicas salvas estavam inválidas e foram ignoradas.");
              }
            }
            if (Array.isArray(parsed.playlists)) {
              const normalizedPlaylists = normalizePlaylists(parsed.playlists);
              setPlaylists(normalizedPlaylists);
              if (normalizedPlaylists.length !== parsed.playlists.length) {
                setStatus("Algumas playlists salvas estavam inválidas e foram ignoradas.");
              }
            }
            if (parsed.settings && typeof parsed.settings === "object") {
              const savedSettings = parsed.settings;
              const autoAdvance =
                typeof savedSettings.autoAdvance === "boolean"
                  ? savedSettings.autoAdvance
                  : DEFAULT_SETTINGS.autoAdvance;
              setSettings({
                ...DEFAULT_SETTINGS,
                autoAdvance,
                shuffle: savedSettings.shuffle === true && !autoAdvance,
                lightMode:
                  typeof savedSettings.lightMode === "boolean"
                    ? savedSettings.lightMode
                    : DEFAULT_SETTINGS.lightMode,
              });
            }
          }
        }
      } catch (error) {
        if (mounted) {
          setStatus(`Não foi possível carregar os dados salvos: ${error.message}`);
        }
      } finally {
        if (mounted) setIsReady(true);
      }
    }

    loadData();
    return () => {
      mounted = false;
      playbackStatusSubscriptionRef.current?.remove();
      playbackStatusSubscriptionRef.current = null;
      if (soundRef.current) {
        try {
          soundRef.current.setActiveForLockScreen(false);
          soundRef.current.pause();
          soundRef.current.remove();
        } catch (error) {
          console.warn("Não foi possível liberar o áudio:", error);
        }
        soundRef.current = null;
      }
    };
  }, []);

  // Varredura silenciosa ao abrir o app: só roda se a permissão já foi concedida
  // e não mostra nada na tela.
  useEffect(() => {
    if (isReady) scanDeviceMp3s();
  }, [isReady, scanDeviceMp3s]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ songs, playlists, settings }),
    ).catch((error) => {
      setStatus(`Não foi possível salvar os dados: ${error.message}`);
    });
  }, [isReady, songs, playlists, settings]);

  const handlePlaybackStatus = useCallback((playbackStatus) => {
    if (!playbackStatus.isLoaded) return;
    setPlayback({
      isPlaying: playbackStatus.playing,
      positionMillis: (playbackStatus.currentTime || 0) * 1000,
      durationMillis: (playbackStatus.duration || 0) * 1000,
    });
    if (playbackStatus.didJustFinish) {
      const finishedSong = currentSongRef.current;
      if (finishedSong) setFinishedPlayback({ songId: finishedSong.id });
    }
  }, []);

  const playSong = useCallback(
    async (song, rememberHistory = true) => {
      try {
        if (rememberHistory && song) {
          const history = playbackHistoryRef.current;
          if (history[history.length - 1] !== song.id) {
            history.push(song.id);
            if (history.length > 100) history.shift();
          }
        }
        let player = soundRef.current;
        if (player) {
          player.pause();
          player.replace({ uri: song.uri });
        } else {
          player = createAudioPlayer(
            { uri: song.uri },
            {
              updateInterval: PLAYER_UPDATE_INTERVAL_MS,
              volume: volumeRef.current,
            },
          );
          soundRef.current = player;
          playbackStatusSubscriptionRef.current = player.addListener(
            "playbackStatusUpdate",
            (playbackStatus) => {
              if (soundRef.current === player) {
                handlePlaybackStatus(playbackStatus);
              }
            },
          );
        }
        currentSongRef.current = song;
        setCurrentSong(song);
        setPlayback({ isPlaying: false, positionMillis: 0, durationMillis: 0 });
        player.setActiveForLockScreen(true, {
          title: song.displayName || song.name,
        });
        player.play();
        setStatus("");
      } catch (error) {
        setStatus(`Não foi possível reproduzir "${song.displayName || song.name}": ${error.message}`);
      }
    },
    [handlePlaybackStatus],
  );

  useEffect(() => {
    if (!finishedPlayback) return;
    const finishedSongId = finishedPlayback.songId;
    const currentSettings = settingsRef.current;
    if (!currentSettings.autoAdvance && !currentSettings.shuffle) return;
    const queue = currentQueueRef.current;
    const currentIndex = queue.findIndex(
      (song) => song.id === finishedSongId,
    );
    if (queue.length > 1) {
      const nextIndex = currentSettings.shuffle
        ? Math.floor(Math.random() * queue.length)
        : (Math.max(currentIndex, 0) + 1) % queue.length;
      const nextSong = queue[nextIndex];
      if (nextSong && nextSong.id !== finishedSongId) {
        playSong(nextSong);
      }
    }
  }, [finishedPlayback, playSong]);

  const togglePlayback = useCallback(async () => {
    if (!currentSong) return;
    try {
      if (!soundRef.current) {
        await playSong(currentSong);
      } else if (playback.isPlaying) {
        soundRef.current.pause();
      } else {
        soundRef.current.play();
      }
    } catch (error) {
      setStatus(`Não foi possível controlar a reprodução: ${error.message}`);
    }
  }, [currentSong, playback.isPlaying, playSong]);

  const skipSong = useCallback(
    async (direction) => {
      const queue = currentQueueRef.current;
      if (!queue.length) return;
      const index = queue.findIndex((song) => song.id === currentSong?.id);
      let nextIndex;
      if (direction < 0 && settingsRef.current.shuffle && queue.length > 1) {
        const history = playbackHistoryRef.current;
        if (history.length > 1 && history[history.length - 1] === currentSong?.id) {
          history.pop();
        }
        const previousId = history[history.length - 1];
        const previousSong = queue.find((song) => song.id === previousId);
        if (previousSong) {
          await playSong(previousSong, false);
          return;
        }
      }
      if (settingsRef.current.shuffle && queue.length > 1 && direction > 0) {
        do {
          nextIndex = Math.floor(Math.random() * queue.length);
        } while (nextIndex === index);
      } else {
        nextIndex = (Math.max(index, 0) + direction + queue.length) % queue.length;
      }
      const target = queue[nextIndex];
      if (target) await playSong(target);
    },
    [currentSong, playSong],
  );

  useEffect(() => {
    if (!NativeModules.ExpoAudio) return undefined;
    const emitter = new NativeEventEmitter(NativeModules.ExpoAudio);
    const subscription = emitter.addListener("onAudioControl", ({ direction }) => {
      skipSong(direction === "previous" ? -1 : 1);
    });
    return () => subscription.remove();
  }, [skipSong]);

  const setPlayerSetting = useCallback((key, value) => {
    setSettings((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "autoAdvance" && value) next.shuffle = false;
      if (key === "shuffle" && value) next.autoAdvance = false;
      return next;
    });
  }, []);

  const openPlaylist = useCallback((playlistId) => {
    setActivePlaylistId(playlistId);
    setStatus("");
  }, []);

  const onBackToPlaylists = useCallback(() => {
    setActivePlaylistId(null);
    setStatus("");
  }, []);

  const onRenamePlaylist = useCallback((playlist) => {
    setNameInput(playlist.name);
    setNameDialog({ mode: "rename", playlistId: playlist.id });
  }, []);

  const savePlaylistName = () => {
    const nextName = nameInput.trim();
    if (!nextName) {
      setStatus("Digite um nome para a playlist.");
      return;
    }
    const duplicate = [
      ...BUILT_IN_PLAYLISTS,
      ...playlists.filter(
        (playlist) => playlist.id !== nameDialog?.playlistId,
      ),
    ].some((playlist) => playlist.name.toLocaleLowerCase("pt-BR") === nextName.toLocaleLowerCase("pt-BR"));
    if (duplicate) {
      setStatus("Já existe uma playlist com esse nome.");
      return;
    }

    if (nameDialog?.mode === "rename") {
      setPlaylists((previous) =>
        previous.map((playlist) =>
          playlist.id === nameDialog.playlistId
            ? { ...playlist, name: nextName }
            : playlist,
        ),
      );
    } else {
      const playlist = {
        id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: nextName,
        songIds: [],
        createdAt: Date.now(),
      };
      setPlaylists((previous) => [...previous, playlist]);
      setStatus(`Playlist "${nextName}" criada.`);
    }
    setNameDialog(null);
    setNameInput("");
  };

  const createPlaylist = useCallback(() => {
    let name = "Nova playlist";
    let suffix = 2;
    while (
      [...BUILT_IN_PLAYLISTS, ...playlists].some(
        (playlist) => playlist.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
      )
    ) {
      name = `Nova playlist ${suffix}`;
      suffix += 1;
    }
    setNameInput(name);
    setNameDialog({ mode: "create" });
  }, [playlists]);

  const removePlaylist = useCallback((playlist) => {
    Alert.alert("Remover playlist", `Deseja remover "${playlist.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          setPlaylists((previous) =>
            previous.filter((item) => item.id !== playlist.id),
          );
          if (activePlaylistId === playlist.id) setActivePlaylistId(null);
          setStatus(`A playlist "${playlist.name}" foi removida.`);
        },
      },
    ]);
  }, [activePlaylistId]);

  // Alternativa para plataformas sem varredura do aparelho (iOS e web): abre o
  // seletor de arquivos do sistema e copia os MP3 escolhidos para dentro do app.
  const importSongsFromFiles = useCallback(async () => {
    const copiedUris = [];
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const selectedFiles = result.assets.filter((file) => {
        const mimeType = file.mimeType?.split(";")[0].trim().toLowerCase();
        return (
          /\.mp3$/i.test(file.name || "") ||
          (mimeType ? MP3_MIME_TYPES.has(mimeType) : false)
        );
      });
      if (!selectedFiles.length) {
        setStatus("Selecione arquivos MP3 para adicionar à biblioteca.");
        return;
      }
      if (!FileSystem.documentDirectory) {
        throw new Error("O armazenamento local não está disponível neste dispositivo.");
      }
      const importedSongs = [];
      for (const file of selectedFiles) {
        const id = `song-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const localUri = `${FileSystem.documentDirectory}${id}.mp3`;
        const fileName = /\.mp3$/i.test(file.name)
          ? file.name
          : `${file.name}.mp3`;
        await FileSystem.copyAsync({ from: file.uri, to: localUri });
        copiedUris.push(localUri);
        importedSongs.push({
          id,
          name: fileName,
          displayName: fileName.replace(/\.mp3$/i, ""),
          uri: localUri,
          addedAt: Date.now(),
        });
      }
      setSongs((previous) => [...previous, ...importedSongs]);
      if (customPlaylist) {
        const addedIds = importedSongs.map((song) => song.id);
        setPlaylists((previous) =>
          previous.map((playlist) =>
            playlist.id === customPlaylist.id
              ? {
                  ...playlist,
                  songIds: [...new Set([...(playlist.songIds || []), ...addedIds])],
                }
              : playlist,
          ),
        );
      }
      setStatus(
        `${importedSongs.length} ${importedSongs.length === 1 ? "música adicionada" : "músicas adicionadas"}${customPlaylist ? " à playlist." : " à biblioteca."}`,
      );
    } catch (error) {
      const cleanupErrors = [];
      await Promise.all(
        copiedUris.map((uri) =>
          FileSystem.deleteAsync(uri, { idempotent: true }).catch((cleanupError) => {
            cleanupErrors.push(cleanupError.message);
          }),
        ),
      );
      const cleanupMessage = cleanupErrors.length
        ? ` Arquivos temporários não removidos: ${cleanupErrors.join("; ")}`
        : "";
      setStatus(`Não foi possível importar as músicas: ${error.message}.${cleanupMessage}`);
    }
  }, [customPlaylist]);

  // Clique em "Adicionar músicas": abre a janela com os MP3 encontrados no
  // aparelho (pedindo a permissão na primeira vez e atualizando a lista).
  const openSongPicker = useCallback(() => {
    if (!DEVICE_SCAN_SUPPORTED) {
      importSongsFromFiles();
      return;
    }
    setStatus("");
    setPickerOpen(true);
    scanDeviceMp3s({ requestPermission: true });
  }, [importSongsFromFiles, scanDeviceMp3s]);

  const closeSongPicker = useCallback(() => setPickerOpen(false), []);

  const requestDeviceAccess = useCallback(() => {
    scanDeviceMp3s({ requestPermission: true });
  }, [scanDeviceMp3s]);

  const openAppSettings = useCallback(() => {
    Linking.openSettings().catch((error) => {
      setStatus(`Não foi possível abrir as configurações: ${error.message}`);
    });
  }, []);

  // Botão "Adicionar" da janela: as músicas marcadas entram na biblioteca e,
  // se houver uma playlist aberta, também nela.
  const addDeviceSongs = useCallback(
    (chosen) => {
      if (!chosen.length) return;
      const now = Date.now();
      const chosenIds = chosen.map((song) => song.id);
      setSongs((previous) => {
        const knownIds = new Set(previous.map((song) => String(song.id)));
        const fresh = chosen
          .filter((song) => !knownIds.has(song.id))
          .map((song) => ({
            id: song.id,
            name: song.name,
            displayName: song.displayName,
            uri: song.uri,
            addedAt: now,
          }));
        return fresh.length ? [...previous, ...fresh] : previous;
      });
      if (customPlaylist) {
        setPlaylists((previous) =>
          previous.map((playlist) =>
            playlist.id === customPlaylist.id
              ? {
                  ...playlist,
                  songIds: [
                    ...new Set([...(playlist.songIds || []), ...chosenIds]),
                  ],
                }
              : playlist,
          ),
        );
      }
      setPickerOpen(false);
      setStatus(
        `${chosen.length} ${chosen.length === 1 ? "música adicionada" : "músicas adicionadas"}${customPlaylist ? " à playlist." : " à biblioteca."}`,
      );
    },
    [customPlaylist],
  );

  const removeSong = useCallback((song) => {
    if (customPlaylist) {
      Alert.alert(
        "Remover da playlist",
        `Deseja remover "${song.displayName || song.name}" desta playlist?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Remover",
            style: "destructive",
            onPress: () => {
              setPlaylists((previous) =>
                previous.map((playlist) =>
                  playlist.id === customPlaylist.id
                    ? {
                        ...playlist,
                        songIds: playlist.songIds.filter(
                          (id) => String(id) !== String(song.id),
                        ),
                      }
                    : playlist,
                ),
              );
              setStatus("A música foi removida desta playlist.");
            },
          },
        ],
      );
      return;
    }
    Alert.alert(
      "Remover música",
      `Deseja remover "${song.displayName || song.name}" da biblioteca?${isAppOwnedFile(song.uri) ? "" : " O arquivo continuará no seu aparelho."}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              const activeSong = currentSongRef.current;
              const isActiveSong =
                activeSong &&
                (String(activeSong.id) === String(song.id) ||
                  activeSong.uri === song.uri);
              if (isActiveSong && soundRef.current) {
                const player = soundRef.current;
                soundRef.current = null;
                playbackStatusSubscriptionRef.current?.remove();
                playbackStatusSubscriptionRef.current = null;
                player.setActiveForLockScreen(false);
                currentSongRef.current = null;
                setCurrentSong(null);
                setPlayback({ isPlaying: false, positionMillis: 0, durationMillis: 0 });
                try {
                  player.pause();
                } finally {
                  player.remove();
                }
              }
              // Só apaga cópias criadas pelo app; o MP3 original do aparelho fica intacto.
              if (isAppOwnedFile(song.uri)) {
                await FileSystem.deleteAsync(song.uri, { idempotent: true });
              }
            } catch (error) {
              setStatus(`Não foi possível remover o arquivo da música: ${error.message}`);
              return;
            }
            setSongs((previous) => previous.filter((item) => item.id !== song.id));
            setPlaylists((previous) =>
              previous.map((playlist) => ({
                ...playlist,
                songIds: (playlist.songIds || []).filter(
                  (id) => String(id) !== String(song.id),
                ),
              })),
            );
            setStatus("A música foi removida da biblioteca.");
          },
        },
      ],
    );
  }, [customPlaylist]);

  const renameSong = useCallback((song) => {
    setNameInput(song.displayName || song.name.replace(/\.mp3$/i, ""));
    setNameDialog({ mode: "renameSong", songId: song.id });
  }, []);

  const saveSongName = () => {
    const nextName = nameInput.trim();
    if (!nextName) {
      setStatus("Digite um nome para a música.");
      return;
    }
    setSongs((previous) =>
      previous.map((song) =>
        song.id === nameDialog?.songId
          ? { ...song, displayName: nextName }
          : song,
      ),
    );
    if (currentSong?.id === nameDialog?.songId) {
      setCurrentSong((previous) => {
        const renamed = { ...previous, displayName: nextName };
        currentSongRef.current = renamed;
        return renamed;
      });
    }
    setNameDialog(null);
    setNameInput("");
  };

  const seekToProgress = useCallback(async (ratio, durationMillis) => {
    const sound = soundRef.current;
    if (!sound || !durationMillis) return;
    try {
      await sound.seekTo((ratio * durationMillis) / 1000);
    } catch (error) {
      setStatus(`Não foi possível alterar a posição da música: ${error.message}`);
    }
  }, []);

  const currentTitle = currentSong
    ? currentSong.displayName || currentSong.name
    : "Selecione uma música";
  const progress = playback.durationMillis
    ? playback.positionMillis / playback.durationMillis
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={settings.lightMode ? "dark-content" : "light-content"}
        backgroundColor={colors.header}
      />
      <View style={[styles.screen, Platform.OS === "web" && styles.webShell]}>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Ionicons name="musical-notes" size={17} color="#fff" />
              </View>
              <Text style={styles.brandTitle}>Mp3Player</Text>
            </View>
            <Pressable
              accessibilityLabel="Abrir configurações"
              onPress={() => setSettingsOpen(true)}
              style={styles.headerButton}
              hitSlop={0}
            >
              <Ionicons name="settings-outline" size={17} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <PlaylistLibrary
          activePlaylistId={activePlaylistId}
          playlistSongs={playlistSongs}
          playlists={playlists}
          songs={songs}
          customPlaylist={customPlaylist}
          currentSongId={currentSong?.id}
          isPlaying={playback.isPlaying}
          colors={colors}
          styles={styles}
          onBack={onBackToPlaylists}
          onOpenPlaylist={openPlaylist}
          onCreatePlaylist={createPlaylist}
          onImportSongs={openSongPicker}
          onPlaySong={playSong}
          onTogglePlayback={togglePlayback}
          onRenameSong={renameSong}
          onRemoveSong={removeSong}
          onRenamePlaylist={onRenamePlaylist}
          onRemovePlaylist={removePlaylist}
        />

        {!!status && <Text accessibilityRole="alert" style={styles.status}>{status}</Text>}

        <View style={styles.playerBar}>
          <View style={styles.playerTrack}>
            <PlayerArtwork colors={colors} styles={styles} />
            <View style={styles.playerInfo}>
              <View style={styles.nowPlayingRow}>
                <LiveDot isPlaying={playback.isPlaying} styles={styles} />
                <Text style={styles.nowPlayingLabel}>TOCANDO AGORA</Text>
              </View>
              <PlayerTitle colors={colors} title={currentTitle} styles={styles} />
            </View>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.timeText}>{formatTime(playback.positionMillis)}</Text>
            <View style={styles.progressSliderWrap}>
              <ProgressSlider
                durationMillis={playback.durationMillis}
                isPlaying={playback.isPlaying}
                onSeek={seekToProgress}
                progress={progress}
                styles={styles}
              />
            </View>
            <Text style={[styles.timeText, styles.timeTextEnd]}>
              {formatTime(playback.durationMillis)}
            </Text>
          </View>
          <View style={styles.playerControls}>
            <PlayerControlButton
              accessibilityLabel="Música anterior"
              disabled={!currentSong}
              nudge={-4}
              onPress={() => skipSong(-1)}
              style={styles.skipButton}
            >
              <CenteredIcon
                name="play-skip-back"
                size={22}
                color={currentSong ? colors.text : colors.muted}
              />
            </PlayerControlButton>
            <PlayPauseButton
              accessibilityLabel={playback.isPlaying ? "Pausar música" : "Reproduzir música"}
              buttonForeground={colors.buttonForeground}
              disabled={!currentSong}
              isPlaying={playback.isPlaying}
              onPress={togglePlayback}
              styles={styles}
            />
            <PlayerControlButton
              accessibilityLabel="Próxima música"
              disabled={!currentSong}
              nudge={4}
              onPress={() => skipSong(1)}
              style={styles.skipButton}
            >
              <CenteredIcon
                name="play-skip-forward"
                size={22}
                color={currentSong ? colors.text : colors.muted}
              />
            </PlayerControlButton>
          </View>
        </View>
      </View>

      <SongPickerSheet
        visible={pickerOpen}
        onClose={closeSongPicker}
        colors={colors}
        scan={deviceMp3s}
        addedIds={pickerAddedIds}
        addedLabel={customPlaylist ? "Já está na playlist" : "Já está na biblioteca"}
        targetLabel={customPlaylist ? customPlaylist.name : "Biblioteca"}
        onConfirm={addDeviceSongs}
        onRequestAccess={requestDeviceAccess}
        onOpenSettings={openAppSettings}
      />

      <Modal
        animationType="fade"
        transparent
        visible={settingsOpen}
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Configurações</Text>
            <Text style={styles.cardDescription}>
              Ajuste a reprodução e a aparência do player.
            </Text>
            {[
              {
                key: "autoAdvance",
                title: "Reprodução automática",
                detail: "Tocar outra faixa ao terminar",
              },
              {
                key: "shuffle",
                title: "Ordem aleatória",
                detail: "Escolher outra faixa aleatória",
              },
              {
                key: "lightMode",
                title: "Modo claro",
                detail: "Usar a interface clara",
              },
            ].map((setting, index) => (
              <React.Fragment key={setting.key}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.settingRow}>
                  <View style={styles.cardText}>
                    <Text style={styles.settingText}>{setting.title}</Text>
                    <Text style={styles.settingDetail}>{setting.detail}</Text>
                  </View>
                  <Switch
                    value={settings[setting.key]}
                    onValueChange={(value) => setPlayerSetting(setting.key, value)}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={settings.lightMode ? "#fff" : "#f7f5ff"}
                  />
                </View>
              </React.Fragment>
            ))}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setSettingsOpen(false)}
                style={[styles.modalActionButton, styles.modalActionPrimary]}
              >
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText]}>
                  Concluir
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(nameDialog)}
        onRequestClose={() => {
          setNameDialog(null);
          setNameInput("");
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {nameDialog?.mode === "create"
                ? "Nova playlist"
                : nameDialog?.mode === "rename"
                  ? "Renomear playlist"
                  : "Renomear música"}
            </Text>
            <TextInput
              autoFocus
              onChangeText={setNameInput}
              onSubmitEditing={
                nameDialog?.mode === "renameSong" ? saveSongName : savePlaylistName
              }
              placeholder="Digite um nome"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              selectTextOnFocus
              style={styles.input}
              value={nameInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setNameDialog(null);
                  setNameInput("");
                }}
                style={styles.modalActionButton}
              >
                <Text style={styles.modalActionText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={
                  nameDialog?.mode === "renameSong" ? saveSongName : savePlaylistName
                }
                style={[styles.modalActionButton, styles.modalActionPrimary]}
              >
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText]}>
                  Salvar
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}