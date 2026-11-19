import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, cancelAnimation, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import type { AppStyles } from "../styles";
import { MARQUEE_FADE_STEPS, MARQUEE_GAP, MARQUEE_SPEED_PX_PER_MS, MARQUEE_START_PAUSE_MS } from "@/features/music/constants";
import type { ThemeColors } from "@/features/music/types";

export function PlayerTitle({
  title,
  colors,
  styles,
}: {
  title: string;
  colors: ThemeColors;
  styles: AppStyles;
}) {
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

