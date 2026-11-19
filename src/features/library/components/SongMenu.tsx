import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { MENU_HEIGHT } from "../styles";
import type { SongMenuAnchor, ThemeColors } from "@/features/music/types";
import type { SongListStyles } from "../styles";

function MenuItem({
  icon,
  label,
  color,
  styles,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  color: string;
  styles: SongListStyles;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
    >
      <Ionicons name={icon} size={19} color={color} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

// Menu flutuante ao lado do botão de 3 pontinhos, limitado à área visível.
export function SongMenu({
  anchor,
  colors,
  styles,
  onClose,
  onRename,
  onDelete,
}: {
  anchor: SongMenuAnchor;
  colors: ThemeColors;
  styles: SongListStyles;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(
      withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.9 + progress.value * 0.1 }],
  }));

  const maxTop = Math.max(8, anchor.containerHeight - MENU_HEIGHT - 8);
  const top = Math.min(
    maxTop,
    Math.max(
      8,
      anchor.top + (anchor.height - MENU_HEIGHT) / 2,
    ),
  );

  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(90)}
      style={styles.menuLayer}
    >
      <Pressable
        accessibilityLabel="Fechar menu"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.menuCard,
          {
            top,
            right: anchor.right,
            transformOrigin: "right center",
          },
          cardStyle,
        ]}
      >
        <MenuItem
          icon="pencil-outline"
          label="Renomear"
          color={colors.text}
          styles={styles}
          onPress={onRename}
        />
        <MenuItem
          icon="trash-outline"
          label="Deletar"
          color={colors.danger}
          styles={styles}
          onPress={onDelete}
        />
      </Animated.View>
    </Animated.View>
  );
}


