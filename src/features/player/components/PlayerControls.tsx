import React, { useCallback, useEffect } from "react";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, useAnimatedStyle, ZoomIn, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import type { AppStyles } from "../styles";
import { PLAY_BUTTON_SIZE } from "@/features/music/constants";
import type { ThemeColors } from "@/features/music/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CenteredIcon({
  color,
  name,
  size,
}: {
  color: string;
  name: ComponentProps<typeof Ionicons>["name"];
  size: number;
}) {
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
/** Static artwork used by the compact player bar. */
export function PlayerArtwork({
  colors,
  styles,
}: {
  colors: ThemeColors;
  styles: AppStyles;
}) {
  return (
    <View style={styles.miniArtwork}>
      <Ionicons name="musical-notes" size={20} color={colors.accent} />
    </View>
  );
}

// Pontinho do rótulo "TOCANDO AGORA": pulsa enquanto a música toca.
/** Indicates active playback with a subtle pulse animation. */
export function LiveDot({
  isPlaying,
  styles,
}: {
  isPlaying: boolean;
  styles: AppStyles;
}) {
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

// Botão de controle (anterior / próxima) com um feedback sutil ao toque.
/** Shared animated wrapper for previous/next player controls. */
export function PlayerControlButton({
  accessibilityLabel,
  children,
  disabled,
  nudge = 0,
  onPress,
  style,
}: {
  accessibilityLabel: string;
  children: ReactNode;
  disabled?: boolean;
  nudge?: number;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
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
    scale.set(withSpring(0.96, { damping: 22, stiffness: 300 }));
    nudgeX.set(withSpring(nudge * 0.5, { damping: 22, stiffness: 280 }));
  }, [nudge, nudgeX, scale]);
  const handlePressOut = useCallback(() => {
    scale.set(withSpring(1, { damping: 22, stiffness: 300 }));
    nudgeX.set(withSpring(0, { damping: 22, stiffness: 280 }));
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

function PlayTriangle({ color }: { color: string }) {
  const half = PLAY_ROUND / 2;
  const edgeWidth = PLAY_EDGE_LENGTH + PLAY_ROUND;
  const edgeCenterX = half + PLAY_WIDTH / 2;
  const bar: ViewStyle = {
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
/** Main playback button with an animated play/pause state. */
export function PlayPauseButton({
  accessibilityLabel,
  buttonForeground,
  disabled,
  isPlaying,
  onPress,
  styles,
}: {
  accessibilityLabel: string;
  buttonForeground: string;
  disabled: boolean;
  isPlaying: boolean;
  onPress: () => void;
  styles: AppStyles;
}) {
  const scale = useSharedValue(1);
  const playing = useSharedValue(isPlaying ? 1 : 0);

  useEffect(() => {
    playing.set(
      withTiming(isPlaying ? 1 : 0, {
        duration: 160,
        easing: Easing.out(Easing.quad),
      }),
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
    scale.set(withTiming(0.96, { duration: 80 }));
  }, [scale]);
  const handlePressOut = useCallback(() => {
    scale.set(withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }));
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


// Barra de progresso controlada por gestos nativos (react-native-gesture-handler).
// Os callbacks dos gestos rodam na thread de UI: a bolinha acompanha o dedo sem
// passar pelo JS a cada movimento. O JS só é acionado uma vez, ao soltar, para
// chamar o seekTo do player.
/** Gesture-driven progress control with screen-reader seeking actions. */

