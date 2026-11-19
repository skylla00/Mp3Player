import type { Playlist, PlayerSettings, ThemeColors } from "./types";

/** Persistent key retained for compatibility with existing user data. */
export const STORAGE_KEY = "player-de-musica-native";

/** Player polling interval, also used to animate normal progress updates. */
export const PLAYER_UPDATE_INTERVAL_MS = 500;
/** Seek step exposed to screen readers. */
export const ACCESSIBILITY_SEEK_STEP_MS = 10000;
export const PLAY_BUTTON_SIZE = 64;
export const PROGRESS_TOUCH_HEIGHT = 32;
export const PROGRESS_THUMB_SIZE = 14;
export const MARQUEE_GAP = 44;
export const MARQUEE_START_PAUSE_MS = 1600;
export const MARQUEE_SPEED_PX_PER_MS = 0.04;
export const MARQUEE_FADE_STEPS = 8;

export const DEFAULT_SETTINGS: PlayerSettings = {
  autoAdvance: true,
  shuffle: false,
  themeMode: "system",
};

export const DARK: ThemeColors = {
  background: "#090b12",
  surface: "#15141d",
  surfaceRaised: "#201e2b",
  border: "#343144",
  text: "#f7f5ff",
  muted: "#aaa6b8",
  accent: "#a98cff",
  accentStrong: "#c5b4ff",
  buttonForeground: "#171323",
  header: "#11121a",
  danger: "#ee8292",
};

export const LIGHT: ThemeColors = {
  background: "#ffffff",
  surface: "#ffffff",
  surfaceRaised: "#f4f0ff",
  border: "#e5ddf6",
  text: "#292638",
  muted: "#706d78",
  accent: "#a98cff",
  accentStrong: "#c5b4ff",
  buttonForeground: "#ffffff",
  header: "#ffffff",
  danger: "#bd4258",
};

export const BUILT_IN_PLAYLISTS: Playlist[] = [
  {
    id: "all",
    name: "Todas as músicas",
    description: "Sua biblioteca completa em ordem alfabética.",
  },
  {
    id: "recent",
    name: "Adicionadas recentemente",
    description: "Ouça primeiro as músicas que você adicionou por último.",
  },
];

export const MP3_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/x-mpeg",
  "audio/x-mp3",
  "audio/mpeg3",
  "audio/x-mpeg-3",
]);
