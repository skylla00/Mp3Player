import React, { useCallback, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import type { DeviceSong, ThemeColors } from "@/features/music/types";
import type { PickerStyles } from "./styles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function formatDuration(milliseconds = 0): string {
  const totalSeconds = Math.floor(Math.max(milliseconds, 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export const PickerRow = React.memo(function PickerRow({
  song,
  selected,
  added,
  addedLabel,
  colors,
  styles,
  onToggle,
}: {
  song: DeviceSong;
  selected: boolean;
  added: boolean;
  addedLabel: string;
  colors: ThemeColors;
  styles: PickerStyles;
  onToggle: (id: string) => void;
}) {
  const selection = useSharedValue(selected ? 1 : 0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    selection.set(
      withTiming(selected ? 1 : 0, {
        duration: 190,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [selected, selection]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.get() }],
    borderColor: interpolateColor(
      selection.get(),
      [0, 1],
      [colors.border, colors.accent],
    ),
    backgroundColor: interpolateColor(
      selection.get(),
      [0, 1],
      [colors.surface, colors.surfaceRaised],
    ),
  }));
  const boxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      selection.get(),
      [0, 1],
      [colors.muted, colors.accent],
    ),
    backgroundColor: interpolateColor(
      selection.get(),
      [0, 1],
      [colors.surface, colors.accent],
    ),
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: selection.get(),
    transform: [{ scale: interpolate(selection.get(), [0, 1], [0.4, 1]) }],
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

  return (
    <AnimatedPressable
      accessibilityRole="checkbox"
      accessibilityLabel={song.displayName}
      accessibilityState={{ checked: selected, disabled: added }}
      disabled={added}
      onPress={() => onToggle(song.id)}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[styles.row, added && styles.rowAdded, cardStyle]}
    >
      <View style={styles.rowArtwork}>
        <Ionicons name="musical-note" size={20} color={colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={styles.rowName}>
          {song.displayName}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {added
            ? addedLabel
            : song.durationMillis
              ? `MP3 · ${formatDuration(song.durationMillis)}`
              : "Arquivo MP3"}
        </Text>
      </View>
      {added ? (
        <Ionicons name="checkmark-circle" size={24} color={colors.muted} />
      ) : (
        <Animated.View style={[styles.checkbox, boxStyle]}>
          <Animated.View style={checkStyle}>
            <Ionicons name="checkmark" size={16} color={colors.buttonForeground} />
          </Animated.View>
        </Animated.View>
      )}
    </AnimatedPressable>
  );
});


