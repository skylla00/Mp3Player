import React, { useCallback, useMemo } from "react";
import { Platform, Pressable, Text } from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { BUILT_IN_PLAYLISTS } from "@/features/music/constants";
import type { Playlist, Song, ThemeColors } from "@/features/music/types";
import type { AppStyles } from "@/features/player/styles";
import { PlaylistCard } from "./components/PlaylistCard";
import { PlaylistSongsView } from "./components/PlaylistSongsView";

interface PlaylistLibraryProps {
  activePlaylistId: string | null;
  playlistSongs: Song[];
  playlists: Playlist[];
  songs: Song[];
  customPlaylist: Playlist | null;
  currentSongId?: string;
  isPlaying: boolean;
  colors: ThemeColors;
  styles: AppStyles;
  onBack: () => void;
  onOpenPlaylist: (playlistId: string) => void;
  onCreatePlaylist: () => void;
  onImportSongs: () => void;
  onPlaySong: (song: Song) => void;
  onTogglePlayback: () => void;
  onRenameSong: (song: Song) => void;
  onRemoveSong: (song: Song) => void;
  onRenamePlaylist: (playlist: Playlist) => void;
  onRemovePlaylist: (playlist: Playlist) => void;
  onSearchTypingChange: (isTyping: boolean) => void;
}

/** Coordinates the playlist overview and its per-playlist track screen. */
export const PlaylistLibrary = React.memo(function PlaylistLibrary({
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
  onSearchTypingChange,
}: PlaylistLibraryProps) {
  const playlistItems = useMemo(
    () => [...BUILT_IN_PLAYLISTS, ...playlists],
    [playlists],
  );
  const songIds = useMemo(
    () => new Set(songs.map((song) => String(song.id))),
    [songs],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Playlist>) => {
      const songCount =
        item.id === "all" || item.id === "recent"
          ? songs.length
          : (item.songIds || []).filter((id) => songIds.has(String(id))).length;

      return (
        <PlaylistCard
          playlist={item}
          songCount={songCount}
          colors={colors}
          styles={styles}
          onOpenPlaylist={onOpenPlaylist}
          onRenamePlaylist={onRenamePlaylist}
          onRemovePlaylist={onRemovePlaylist}
        />
      );
    },
    [
      colors,
      onOpenPlaylist,
      onRemovePlaylist,
      onRenamePlaylist,
      songIds,
      songs.length,
      styles,
    ],
  );

  const listFooter = useMemo(
    () => (
      <Pressable onPress={onCreatePlaylist} style={styles.addCard}>
        <Ionicons name="add-circle" size={26} color={colors.accent} />
        <Text style={styles.addCardText}>Nova playlist</Text>
      </Pressable>
    ),
    [colors.accent, onCreatePlaylist, styles],
  );

  if (activePlaylistId) {
    return (
      <PlaylistSongsView
        songs={playlistSongs}
        currentSongId={currentSongId}
        isPlaying={isPlaying}
        colors={colors}
        onBack={onBack}
        onImportSongs={onImportSongs}
        onPlaySong={onPlaySong}
        onTogglePlayback={onTogglePlayback}
        onRenameSong={onRenameSong}
        onRemoveSong={onRemoveSong}
        onTypingChange={onSearchTypingChange}
      />
    );
  }

  return (
    <Animated.FlatList
      style={styles.screen}
      data={playlistItems}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.id)}
      ListFooterComponent={listFooter}
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
