import React from "react";
import { Text } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { AppStyles } from "@/features/player/styles";

interface StatusBannerProps {
  message: string;
  searchTyping: boolean;
  styles: AppStyles;
}

/** Temporarily displays app feedback above the current screen. */
export function StatusBanner({
  message,
  searchTyping,
  styles,
}: StatusBannerProps) {
  if (!message) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(320)}
      style={[styles.status, searchTyping && styles.statusAtBottom]}
    >
      <Text style={styles.statusText}>{message}</Text>
    </Animated.View>
  );
}
