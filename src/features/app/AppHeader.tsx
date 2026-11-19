import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "@/features/music/types";
import type { AppStyles } from "@/features/player/styles";

interface AppHeaderProps {
  colors: ThemeColors;
  styles: AppStyles;
  onOpenSettings: () => void;
}

/** Branded application header with the settings entry point. */
export function AppHeader({
  colors,
  styles,
  onOpenSettings,
}: AppHeaderProps) {
  return (
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
          onPress={onOpenSettings}
          style={styles.headerButton}
          hitSlop={0}
        >
          <Ionicons name="settings-outline" size={17} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}
