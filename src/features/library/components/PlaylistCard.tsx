import React, { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import type { Playlist, ThemeColors } from "@/features/music/types";
import type { AppStyles } from "@/features/player/styles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PlaylistCard = React.memo(function PlaylistCard({
  playlist,
  songCount,
  colors,
  styles,
  onOpenPlaylist,
  onRenamePlaylist,
  onRemovePlaylist,
}: {
  playlist: Playlist;
  songCount: number;
  colors: ThemeColors;
  styles: AppStyles;
  onOpenPlaylist: (playlistId: string) => void;
  onRenamePlaylist: (playlist: Playlist) => void;
  onRemovePlaylist: (playlist: Playlist) => void;
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

// Altura fixa dos cartões: permite o getItemLayout e uma rolagem fluida.

