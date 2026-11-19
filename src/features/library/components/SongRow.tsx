import React, { useCallback, useRef } from "react";
import type { ComponentRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { formatTime } from "@/features/music/utils";
import type { Song, SongAnchorRef, ThemeColors } from "@/features/music/types";
import type { SongListStyles } from "../styles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const SongRow = React.memo(function SongRow({
  song,
  isCurrent,
  isPlaying,
  colors,
  styles,
  onPress,
  onOpenMenu,
}: {
  song: Song;
  isCurrent: boolean;
  isPlaying: boolean;
  colors: ThemeColors;
  styles: SongListStyles;
  onPress: (song: Song) => void;
  onOpenMenu: (song: Song, anchorRef: SongAnchorRef) => void;
}) {
  const dotsRef = useRef<ComponentRef<typeof Pressable>>(null);
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const pressIn = useCallback(() => {
    pressScale.set(withTiming(0.985, { duration: 70 }));
  }, [pressScale]);
  const pressOut = useCallback(() => {
    pressScale.set(
      withSpring(1, {
        damping: 18,
        stiffness: 420,
        mass: 0.65,
        overshootClamping: true,
      }),
    );
  }, [pressScale]);

  const title = song.displayName || song.name;
  const duration =
    (song.durationMillis || 0) > 0
      ? formatTime(song.durationMillis)
      : "--:--";

  return (
    <Animated.View style={[styles.row, isCurrent && styles.rowCurrent, pressStyle]}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${duration}`}
        accessibilityState={{ selected: isCurrent }}
        onPress={() => onPress(song)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.rowMain}
      >
        <View style={styles.rowArtwork}>
          <Ionicons
            name={isCurrent && isPlaying ? "volume-high" : "musical-note"}
            size={21}
            color={colors.accent}
          />
        </View>
        <View style={styles.rowText}>
          <Text
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            style={styles.rowTitle}
          >
            {title}
          </Text>
          <Text
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            style={styles.rowDuration}
          >
            {duration}
          </Text>
        </View>
      </AnimatedPressable>
      <Pressable
        ref={dotsRef}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`Mais opções de ${title}`}
        hitSlop={4}
        onPress={() => onOpenMenu(song, dotsRef)}
        style={({ pressed }) => [
          styles.dotsButton,
          pressed && styles.dotsButtonPressed,
        ]}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
});


