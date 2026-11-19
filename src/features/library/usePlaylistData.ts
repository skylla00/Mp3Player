import { useMemo } from "react";
import type {
  DeviceSong,
  Playlist,
  Song,
} from "@/features/music/types";

interface UsePlaylistDataOptions {
  songs: Song[];
  playlists: Playlist[];
  activePlaylistId: string | null;
  deviceSongs: DeviceSong[];
}

/**
 * Derives the active playlist, picker state, and visible queue from library data.
 */
export function usePlaylistData({
  songs,
  playlists,
  activePlaylistId,
  deviceSongs,
}: UsePlaylistDataOptions) {
  const customPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) || null,
    [playlists, activePlaylistId],
  );

  const pickerAddedIds = useMemo(
    () =>
      new Set(
        customPlaylist
          ? (customPlaylist.songIds || []).map(String)
          : songs.map((song) => String(song.id)),
      ),
    [customPlaylist, songs],
  );

  const deviceSongDurations = useMemo(
    () =>
      new Map(
        deviceSongs
          .filter((song) => song.durationMillis > 0)
          .map((song) => [String(song.id), song.durationMillis]),
      ),
    [deviceSongs],
  );

  const playlistSongs = useMemo(() => {
    let visibleSongs: Song[];
    if (activePlaylistId === "recent") {
      visibleSongs = [...songs].sort(
        (a, b) =>
          b.addedAt - a.addedAt ||
          (a.displayName || a.name).localeCompare(
            b.displayName || b.name,
            "pt-BR",
          ),
      );
    } else if (customPlaylist) {
      const songsById = new Map(songs.map((song) => [String(song.id), song]));
      visibleSongs = (customPlaylist.songIds || [])
        .map((id) => songsById.get(String(id)))
        .filter((song): song is Song => Boolean(song));
    } else {
      visibleSongs = [...songs].sort((a, b) =>
        (a.displayName || a.name).localeCompare(
          b.displayName || b.name,
          "pt-BR",
        ),
      );
    }

    return visibleSongs.map((song) => {
      const durationMillis = deviceSongDurations.get(String(song.id));
      return (song.durationMillis || 0) > 0 || !durationMillis
        ? song
        : { ...song, durationMillis };
    });
  }, [activePlaylistId, customPlaylist, deviceSongDurations, songs]);

  return { customPlaylist, pickerAddedIds, playlistSongs };
}
