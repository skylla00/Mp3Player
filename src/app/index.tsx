import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  StatusBar,
  useColorScheme,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer, AudioStatus } from "expo-audio";
import { SafeAreaView } from "react-native-safe-area-context";
import SongPickerSheet from "@/components/song-picker-sheet";
import { AppHeader } from "@/features/app/AppHeader";
import { StatusBanner } from "@/features/app/StatusBanner";
import { PlaylistLibrary } from "../features/library/PlaylistLibrary";
import { usePlaylistActions } from "@/features/library/usePlaylistActions";
import { usePlaylistData } from "@/features/library/usePlaylistData";
import { useSongLibraryActions } from "@/features/library/useSongLibraryActions";
import { PlayerBar } from "@/features/player/PlayerBar";
import { createStyles } from "@/features/player/styles";
import { NameDialog } from "@/features/settings/components/NameDialog";
import { SettingsDialog } from "@/features/settings/components/SettingsDialog";
import {
  DARK,
  DEFAULT_SETTINGS,
  LIGHT,
  PLAYER_UPDATE_INTERVAL_MS,
  STORAGE_KEY,
} from "@/features/music/constants";
import {
  getErrorMessage,
  getRandomQueueSong,
  normalizePlaylists,
  normalizeSongs,
} from "@/features/music/utils";
import type {
  NameDialog as NameDialogState,
  PlaybackState,
  PlayerSettings,
  Playlist,
  Song,
} from "@/features/music/types";
import { useDeviceMp3s } from "@/hooks/use-device-mp3s";

/** Composes the music library, playback controls, and app-level dialogs. */
export default function App() {
  const colorScheme = useColorScheme();
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [nameInput, setNameInput] = useState("");
  // true enquanto o teclado da busca de músicas está aberto (esconde o player).
  const [searchTyping, setSearchTyping] = useState(false);
  const [status, setStatus] = useState("");
  const [finishedPlayback, setFinishedPlayback] = useState<{ songId: string } | null>(null);
  const volumeRef = useRef(1);
  const soundRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const playbackStatusSubscriptionRef = useRef<
    ReturnType<AudioPlayer["addListener"]> | null
  >(null);
  const currentSongRef = useRef<Song | null>(currentSong);
  const currentQueueRef = useRef<Song[]>([]);
  const playbackHistoryRef = useRef<string[]>([]);
  const settingsRef = useRef<PlayerSettings>(settings);
  const lightMode =
    settings.themeMode === "light" ||
    (settings.themeMode === "system" && colorScheme === "light");
  const styles = useMemo(
    () => createStyles(lightMode ? LIGHT : DARK),
    [lightMode],
  );
  const colors = lightMode ? LIGHT : DARK;

  useEffect(() => {
    if (!status) return undefined;
    const timeoutId = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(timeoutId);
  }, [status]);

  // Lista de MP3 do aparelho, carregada em segundo plano e só exibida na janela
  // de "Adicionar música".
  const deviceMp3s = useDeviceMp3s();
  const scanDeviceMp3s = deviceMp3s.scan;
  const { customPlaylist, pickerAddedIds, playlistSongs } = usePlaylistData({
    songs,
    playlists,
    activePlaylistId,
    deviceSongs: deviceMp3s.songs,
  });

  useEffect(() => {
    currentQueueRef.current = playlistSongs;
  }, [activePlaylistId, playlistSongs]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: "doNotMix",
        });
      } catch (error) {
        if (mounted) {
          setStatus(`Não foi possível configurar o áudio: ${getErrorMessage(error)}`);
        }
      }
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && mounted) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.songs)) {
              const normalizedSongs = normalizeSongs(parsed.songs);
              setSongs(normalizedSongs);
              if (normalizedSongs.length !== parsed.songs.length) {
                setStatus("Algumas músicas salvas estavam inválidas e foram ignoradas.");
              }
            }
            if (Array.isArray(parsed.playlists)) {
              const normalizedPlaylists = normalizePlaylists(parsed.playlists);
              setPlaylists(normalizedPlaylists);
              if (normalizedPlaylists.length !== parsed.playlists.length) {
                setStatus("Algumas playlists salvas estavam inválidas e foram ignoradas.");
              }
            }
            if (parsed.settings && typeof parsed.settings === "object") {
              const savedSettings = parsed.settings;
              const autoAdvance =
                typeof savedSettings.autoAdvance === "boolean"
                  ? savedSettings.autoAdvance
                  : DEFAULT_SETTINGS.autoAdvance;
              const themeMode =
                savedSettings.themeMode === "light" ||
                savedSettings.themeMode === "dark" ||
                savedSettings.themeMode === "system"
                  ? savedSettings.themeMode
                  : typeof savedSettings.lightMode === "boolean"
                    ? savedSettings.lightMode
                      ? "light"
                      : "dark"
                    : DEFAULT_SETTINGS.themeMode;
              setSettings({
                ...DEFAULT_SETTINGS,
                autoAdvance,
                shuffle: savedSettings.shuffle === true && !autoAdvance,
                themeMode,
              });
            }
          }
        }
      } catch (error) {
        if (mounted) {
          setStatus(`Não foi possível carregar os dados salvos: ${getErrorMessage(error)}`);
        }
      } finally {
        if (mounted) setIsReady(true);
      }
    }

    loadData();
    return () => {
      mounted = false;
      playbackStatusSubscriptionRef.current?.remove();
      playbackStatusSubscriptionRef.current = null;
      if (soundRef.current) {
        try {
          soundRef.current.setActiveForLockScreen(false);
          soundRef.current.pause();
          soundRef.current.remove();
        } catch (error) {
          console.warn("Não foi possível liberar o áudio:", error);
        }
        soundRef.current = null;
      }
    };
  }, []);

  // Varredura silenciosa ao abrir o app: só roda se a permissão já foi concedida
  // e não mostra nada na tela.
  useEffect(() => {
    if (isReady) scanDeviceMp3s();
  }, [isReady, scanDeviceMp3s]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ songs, playlists, settings }),
    ).catch((error) => {
      setStatus(`Não foi possível salvar os dados: ${getErrorMessage(error)}`);
    });
  }, [isReady, songs, playlists, settings]);

  const handlePlaybackStatus = useCallback((playbackStatus: AudioStatus) => {
    if (!playbackStatus.isLoaded) return;
    setPlayback({
      isPlaying: playbackStatus.playing,
      positionMillis: (playbackStatus.currentTime || 0) * 1000,
      durationMillis: (playbackStatus.duration || 0) * 1000,
    });
    if (playbackStatus.didJustFinish) {
      const finishedSong = currentSongRef.current;
      if (finishedSong) setFinishedPlayback({ songId: finishedSong.id });
    }
  }, []);

  const playSong = useCallback(
    async (song: Song, rememberHistory = true) => {
      try {
        if (rememberHistory && song) {
          const history = playbackHistoryRef.current;
          if (history[history.length - 1] !== song.id) {
            history.push(song.id);
            const historyLimit = Math.max(100, currentQueueRef.current.length);
            if (history.length > historyLimit) {
              history.splice(0, history.length - historyLimit);
            }
          }
        }
        let player = soundRef.current;
        if (player) {
          player.pause();
          player.replace({ uri: song.uri });
        } else {
          player = createAudioPlayer(
            { uri: song.uri },
            {
              updateInterval: PLAYER_UPDATE_INTERVAL_MS,
            },
          );
          player.volume = volumeRef.current;
          soundRef.current = player;
          playbackStatusSubscriptionRef.current = player.addListener(
            "playbackStatusUpdate",
            (playbackStatus) => {
              if (soundRef.current === player) {
                handlePlaybackStatus(playbackStatus);
              }
            },
          );
        }
        currentSongRef.current = song;
        setCurrentSong(song);
        setPlayback({ isPlaying: false, positionMillis: 0, durationMillis: 0 });
        player.setActiveForLockScreen(true, {
          title: song.displayName || song.name,
        });
        player.play();
        setStatus("");
      } catch (error) {
        setStatus(`Não foi possível reproduzir "${song.displayName || song.name}": ${getErrorMessage(error)}`);
      }
    },
    [handlePlaybackStatus],
  );

  useEffect(() => {
    if (!finishedPlayback) return;
    const finishedSongId = finishedPlayback.songId;
    const currentSettings = settingsRef.current;
    if (!currentSettings.autoAdvance && !currentSettings.shuffle) return;
    const queue = currentQueueRef.current;
    const currentIndex = queue.findIndex(
      (song) => song.id === finishedSongId,
    );
    if (queue.length > 1) {
      const nextSong = currentSettings.shuffle
        ? getRandomQueueSong(
            queue,
            playbackHistoryRef.current,
            finishedSongId,
          )
        : queue[(Math.max(currentIndex, 0) + 1) % queue.length];
      if (nextSong && nextSong.id !== finishedSongId) {
        playSong(nextSong);
      }
    }
  }, [finishedPlayback, playSong]);

  const togglePlayback = useCallback(async () => {
    if (!currentSong) return;
    try {
      if (!soundRef.current) {
        await playSong(currentSong);
      } else if (playback.isPlaying) {
        soundRef.current.pause();
      } else {
        soundRef.current.play();
      }
    } catch (error) {
      setStatus(`Não foi possível controlar a reprodução: ${getErrorMessage(error)}`);
    }
  }, [currentSong, playback.isPlaying, playSong]);

  const skipSong = useCallback(
    async (direction: -1 | 1) => {
      const queue = currentQueueRef.current;
      if (!queue.length) return;
      const index = queue.findIndex((song) => song.id === currentSong?.id);
      let nextIndex;
      if (direction < 0 && settingsRef.current.shuffle && queue.length > 1) {
        const history = playbackHistoryRef.current;
        if (history.length > 1 && history[history.length - 1] === currentSong?.id) {
          history.pop();
        }
        const previousId = history[history.length - 1];
        const previousSong = queue.find((song) => song.id === previousId);
        if (previousSong) {
          await playSong(previousSong, false);
          return;
        }
      }
      if (settingsRef.current.shuffle && queue.length > 1 && direction > 0) {
        const nextSong = getRandomQueueSong(
          queue,
          playbackHistoryRef.current,
          currentSong?.id,
        );
        if (nextSong) await playSong(nextSong);
        return;
      } else {
        nextIndex = (Math.max(index, 0) + direction + queue.length) % queue.length;
      }
      const target = queue[nextIndex];
      if (target) await playSong(target);
    },
    [currentSong, playSong],
  );

  useEffect(() => {
    if (!NativeModules.ExpoAudio) return undefined;
    const emitter = new NativeEventEmitter(NativeModules.ExpoAudio);
    const subscription = emitter.addListener("onAudioControl", ({ direction }: { direction: string }) => {
      skipSong(direction === "previous" ? -1 : 1);
    });
    return () => subscription.remove();
  }, [skipSong]);

  const setPlayerSetting = useCallback(<Key extends keyof PlayerSettings>(
    key: Key,
    value: PlayerSettings[Key],
  ) => {
    setSettings((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "autoAdvance" && value) next.shuffle = false;
      if (key === "shuffle" && value) next.autoAdvance = false;
      return next;
    });
  }, []);

  const {
    openPlaylist,
    onBackToPlaylists,
    onRenamePlaylist,
    savePlaylistName,
    createPlaylist,
    removePlaylist,
  } = usePlaylistActions({
    playlists,
    setPlaylists,
    activePlaylistId,
    setActivePlaylistId,
    setStatus,
    nameDialog,
    setNameDialog,
    nameInput,
    setNameInput,
  });

  const {
    openSongPicker,
    closeSongPicker,
    requestDeviceAccess,
    openAppSettings,
    addDeviceSongs,
    removeSong,
    renameSong,
    saveSongName,
  } = useSongLibraryActions({
    setSongs,
    setPlaylists,
    customPlaylist,
    currentSong,
    setCurrentSong,
    currentSongRef,
    soundRef,
    playbackStatusSubscriptionRef,
    setPlayback,
    setStatus,
    nameDialog,
    setNameDialog,
    nameInput,
    setNameInput,
    scanDeviceMp3s,
    setPickerOpen,
  });

  const seekToProgress = useCallback(async (ratio: number, durationMillis: number) => {
    const sound = soundRef.current;
    if (!sound || !durationMillis) return;
    try {
      await sound.seekTo((ratio * durationMillis) / 1000);
    } catch (error) {
      setStatus(`Não foi possível alterar a posição da música: ${getErrorMessage(error)}`);
    }
  }, []);

  const currentTitle = currentSong
    ? currentSong.displayName || currentSong.name
    : "Selecione uma música";
  const progress = playback.durationMillis
    ? playback.positionMillis / playback.durationMillis
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={lightMode ? "dark-content" : "light-content"}
        backgroundColor={colors.header}
      />
      <View style={[styles.screen, Platform.OS === "web" && styles.webShell]}>
        <AppHeader
          colors={colors}
          styles={styles}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <PlaylistLibrary
          activePlaylistId={activePlaylistId}
          playlistSongs={playlistSongs}
          playlists={playlists}
          songs={songs}
          customPlaylist={customPlaylist}
          currentSongId={currentSong?.id}
          isPlaying={playback.isPlaying}
          colors={colors}
          styles={styles}
          onBack={onBackToPlaylists}
          onOpenPlaylist={openPlaylist}
          onCreatePlaylist={createPlaylist}
          onImportSongs={openSongPicker}
          onPlaySong={playSong}
          onTogglePlayback={togglePlayback}
          onRenameSong={renameSong}
          onRemoveSong={removeSong}
          onRenamePlaylist={onRenamePlaylist}
          onRemovePlaylist={removePlaylist}
          onSearchTypingChange={setSearchTyping}
        />

        <PlayerBar
          colors={colors}
          styles={styles}
          hidden={searchTyping}
          playback={playback}
          currentSong={currentSong}
          currentTitle={currentTitle}
          progress={progress}
          onSeek={seekToProgress}
          onSkip={skipSong}
          onTogglePlayback={togglePlayback}
        />

        <StatusBanner message={status} searchTyping={searchTyping} styles={styles} />
      </View>

      <SongPickerSheet
        visible={pickerOpen}
        onClose={closeSongPicker}
        colors={colors}
        scan={deviceMp3s}
        addedIds={pickerAddedIds}
        addedLabel={customPlaylist ? "Já está na playlist" : "Já está na biblioteca"}
        targetLabel={customPlaylist ? customPlaylist.name : "Biblioteca"}
        onConfirm={addDeviceSongs}
        onRequestAccess={requestDeviceAccess}
        onOpenSettings={openAppSettings}
      />

      <SettingsDialog
        visible={settingsOpen}
        settings={settings}
        colors={colors}
        lightMode={lightMode}
        styles={styles}
        onClose={() => setSettingsOpen(false)}
        onSettingChange={setPlayerSetting}
        onThemeChange={(theme) => setPlayerSetting("themeMode", theme)}
      />

      <NameDialog
        dialog={nameDialog}
        name={nameInput}
        colors={colors}
        styles={styles}
        onChangeName={setNameInput}
        onSavePlaylist={savePlaylistName}
        onSaveSong={saveSongName}
        onClose={() => {
          setNameDialog(null);
          setNameInput("");
        }}
      />
    </SafeAreaView>
  );
}