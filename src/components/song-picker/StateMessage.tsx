import React from "react";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import type { ThemeColors } from "@/features/music/types";
import type { PickerStyles } from "./styles";

export function StateMessage({
  styles,
  colors,
  icon,
  title,
  text,
  actionLabel,
  onAction,
  loading,
}: {
  styles: PickerStyles;
  colors: ThemeColors;
  icon?: ComponentProps<typeof Ionicons>["name"];
  title: string;
  text?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
}) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.stateBox}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} />
      ) : (
        <View style={styles.stateIcon}>
          <Ionicons name={icon} size={28} color={colors.accent} />
        </View>
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      {!!text && <Text style={styles.stateText}>{text}</Text>}
      {!!actionLabel && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={styles.stateButton}
        >
          <Text style={styles.confirmText}>{actionLabel}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// O conteúdo só existe enquanto a janela está montada: ao fechar ele é
// descartado, então a próxima abertura sempre começa com tudo desmarcado.

