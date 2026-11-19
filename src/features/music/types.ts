import type { ComponentRef, RefObject } from "react";
import type { Pressable } from "react-native";

/** Audio track stored in the user's local library. */
export interface Song {
  id: string;
  name: string;
  displayName?: string;
  uri: string;
  addedAt: number;
  durationMillis?: number;
}

/** A track found in the device media library before it is added to the app. */
export interface DeviceSong {
  id: string;
  name: string;
  displayName: string;
  uri: string;
  durationMillis: number;
}

export type DeviceScanStatus = "idle" | "loading" | "ready" | "denied" | "error";

export interface DeviceScanState {
  status: DeviceScanStatus;
  songs: DeviceSong[];
  canAskAgain: boolean;
  error: string | null;
}

export interface DeviceScanOptions {
  requestPermission?: boolean;
}

/** Playlist metadata; built-in playlists do not store their song IDs. */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  songIds?: string[];
  createdAt?: number;
}

export interface PlayerSettings {
  autoAdvance: boolean;
  shuffle: boolean;
  themeMode: "system" | "light" | "dark";
}

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentStrong: string;
  buttonForeground: string;
  header: string;
  danger: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
}

export type NameDialog =
  | { mode: "create" }
  | { mode: "rename"; playlistId: string }
  | { mode: "renameSong"; songId: string };

export interface SongMenuAnchor {
  top: number;
  height: number;
  right: number;
  containerHeight: number;
}

export type SongAnchorRef = RefObject<ComponentRef<typeof Pressable> | null>;
