import * as FileSystem from "expo-file-system/legacy";
import type { Playlist, Song } from "./types";

/** Selects an eligible next track while avoiding recently played tracks. */
export function getRandomQueueSong(
  queue: Song[],
  history: string[],
  currentSongId: string | null | undefined,
): Song | null {
  if (queue.length < 2) return null;

  const recentLimit = Math.max(1, Math.floor(queue.length * 0.3));
  const queueIds = new Set(queue.map((song) => song.id));
  const recentlyPlayedIds = new Set<string>();
  for (
    let index = history.length - 1;
    index >= 0 && recentlyPlayedIds.size < recentLimit;
    index -= 1
  ) {
    if (queueIds.has(history[index])) {
      recentlyPlayedIds.add(history[index]);
    }
  }

  let candidates = queue.filter(
    (song) =>
      song.id !== currentSongId && !recentlyPlayedIds.has(song.id),
  );
  if (!candidates.length) {
    candidates = queue.filter((song) => song.id !== currentSongId);
  }
  if (!candidates.length) return null;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Returns whether a URI belongs to the app's private document directory. */
export function isAppOwnedFile(uri: string): boolean {
  const directory = FileSystem.documentDirectory;
  return directory ? uri.startsWith(directory) : false;
}

function isValidId(value: unknown): value is string | number {
  return (
    (typeof value === "string" && value.length > 0) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/** Validates and migrates persisted song records into the current shape. */
export function normalizeSongs(value: unknown): Song[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (song): song is Record<string, unknown> =>
        Boolean(song) &&
        typeof song === "object" &&
        isValidId((song as Record<string, unknown>).id) &&
        typeof (song as Record<string, unknown>).uri === "string" &&
        ((song as Record<string, unknown>).uri as string).length > 0 &&
        typeof (song as Record<string, unknown>).name === "string" &&
        ((song as Record<string, unknown>).name as string).length > 0,
    )
    .map((song) => ({
      ...song,
      id: String(song.id),
      name: song.name as string,
      uri: song.uri as string,
      displayName:
        typeof song.displayName === "string"
          ? song.displayName
          : (song.name as string).replace(/\.mp3$/i, ""),
      addedAt:
        typeof song.addedAt === "number" && Number.isFinite(song.addedAt)
          ? song.addedAt
          : 0,
      ...(typeof song.durationMillis === "number"
        ? { durationMillis: song.durationMillis }
        : {}),
    }));
}

/** Validates and migrates persisted playlist records into the current shape. */
export function normalizePlaylists(value: unknown): Playlist[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (playlist): playlist is Record<string, unknown> =>
        Boolean(playlist) &&
        typeof playlist === "object" &&
        isValidId((playlist as Record<string, unknown>).id) &&
        typeof (playlist as Record<string, unknown>).name === "string" &&
        ((playlist as Record<string, unknown>).name as string).trim().length > 0,
    )
    .map((playlist) => ({
      ...playlist,
      id: String(playlist.id),
      name: playlist.name as string,
      songIds: Array.isArray(playlist.songIds)
        ? playlist.songIds.filter(isValidId).map(String)
        : [],
    }));
}

/** Formats a millisecond duration as m:ss. */
export function formatTime(milliseconds = 0): string {
  const totalSeconds = Math.floor(Math.max(milliseconds, 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Converts unknown thrown values into a user-facing error message. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Normalizes text so searches ignore accents, punctuation, and file suffixes. */
export function normalizeSearchText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.mp3$/i, "")
    .replace(/[\s_\-.,;:!?'"()[\]{}\\/|&+*#@~`^=<>%$]+/g, " ")
    .trim();
}
