import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { Alert, Linking } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import type { AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { MP3_MIME_TYPES } from "@/features/music/constants";
import { getErrorMessage, isAppOwnedFile } from "@/features/music/utils";
import type {
  DeviceScanOptions,
  DeviceSong,
  NameDialog,
  PlaybackState,
  Playlist,
  Song,
} from "@/features/music/types";
import { DEVICE_SCAN_SUPPORTED } from "@/hooks/use-device-mp3s";

type AudioStatusSubscription = ReturnType<AudioPlayer["addListener"]>;

interface UseSongLibraryActionsOptions {
  setSongs: Dispatch<SetStateAction<Song[]>>;
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  customPlaylist: Playlist | null;
  currentSong: Song | null;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  currentSongRef: MutableRefObject<Song | null>;
  soundRef: MutableRefObject<AudioPlayer | null>;
  playbackStatusSubscriptionRef: MutableRefObject<AudioStatusSubscription | null>;
  setPlayback: Dispatch<SetStateAction<PlaybackState>>;
  setStatus: Dispatch<SetStateAction<string>>;
  nameDialog: NameDialog | null;
  setNameDialog: Dispatch<SetStateAction<NameDialog | null>>;
  nameInput: string;
  setNameInput: Dispatch<SetStateAction<string>>;
  scanDeviceMp3s: (options?: DeviceScanOptions) => Promise<void>;
  setPickerOpen: Dispatch<SetStateAction<boolean>>;
}

/** Owns song import, selection, and library item actions for the app screen. */
export function useSongLibraryActions({
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
}: UseSongLibraryActionsOptions) {
  const importSongsFromFiles = useCallback(async () => {
    const copiedUris: string[] = [];
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const selectedFiles = result.assets.filter((file) => {
        const mimeType = file.mimeType?.split(";")[0].trim().toLowerCase();
        return (
          /\.mp3$/i.test(file.name || "") ||
          (mimeType ? MP3_MIME_TYPES.has(mimeType) : false)
        );
      });
      if (!selectedFiles.length) {
        setStatus("Selecione arquivos MP3 para adicionar à biblioteca.");
        return;
      }
      if (!FileSystem.documentDirectory) {
        throw new Error("O armazenamento local não está disponível neste dispositivo.");
      }
      const importedSongs: Song[] = [];
      for (const file of selectedFiles) {
        const id = `song-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const localUri = `${FileSystem.documentDirectory}${id}.mp3`;
        const fileName = /\.mp3$/i.test(file.name)
          ? file.name
          : `${file.name}.mp3`;
        await FileSystem.copyAsync({ from: file.uri, to: localUri });
        copiedUris.push(localUri);
        importedSongs.push({
          id,
          name: fileName,
          displayName: fileName.replace(/\.mp3$/i, ""),
          uri: localUri,
          addedAt: Date.now(),
        });
      }
      setSongs((previous) => [...previous, ...importedSongs]);
      if (customPlaylist) {
        const addedIds = importedSongs.map((song) => song.id);
        setPlaylists((previous) =>
          previous.map((playlist) =>
            playlist.id === customPlaylist.id
              ? {
                  ...playlist,
                  songIds: [...new Set([...(playlist.songIds || []), ...addedIds])],
                }
              : playlist,
          ),
        );
      }
      setStatus(
        `${importedSongs.length} ${importedSongs.length === 1 ? "música adicionada" : "músicas adicionadas"}${customPlaylist ? " à playlist." : " à biblioteca."}`,
      );
    } catch (error) {
      const cleanupErrors: string[] = [];
      await Promise.all(
        copiedUris.map((uri) =>
          FileSystem.deleteAsync(uri, { idempotent: true }).catch((cleanupError) => {
            cleanupErrors.push(getErrorMessage(cleanupError));
          }),
        ),
      );
      const cleanupMessage = cleanupErrors.length
        ? ` Arquivos temporários não removidos: ${cleanupErrors.join("; ")}`
        : "";
      setStatus(`Não foi possível importar as músicas: ${getErrorMessage(error)}.${cleanupMessage}`);
    }
  }, [customPlaylist, setPlaylists, setSongs, setStatus]);

  // Clique em "Adicionar músicas": abre a janela com os MP3 encontrados no
  // aparelho (pedindo a permissão na primeira vez e atualizando a lista).
  const openSongPicker = useCallback(() => {
    if (!DEVICE_SCAN_SUPPORTED) {
      importSongsFromFiles();
      return;
    }
    setStatus("");
    setPickerOpen(true);
    scanDeviceMp3s({ requestPermission: true });
  }, [importSongsFromFiles, scanDeviceMp3s, setPickerOpen, setStatus]);

  const closeSongPicker = useCallback(
    () => setPickerOpen(false),
    [setPickerOpen],
  );

  const requestDeviceAccess = useCallback(() => {
    scanDeviceMp3s({ requestPermission: true });
  }, [scanDeviceMp3s]);

  const openAppSettings = useCallback(() => {
    Linking.openSettings().catch((error) => {
      setStatus(`Não foi possível abrir as configurações: ${getErrorMessage(error)}`);
    });
  }, [setStatus]);

  // Botão "Adicionar" da janela: as músicas marcadas entram na biblioteca e,
  // se houver uma playlist aberta, também nela.
  const addDeviceSongs = useCallback(
    (chosen: DeviceSong[]) => {
      if (!chosen.length) return;
      const now = Date.now();
      const chosenIds = chosen.map((song) => song.id);
      setSongs((previous) => {
        const knownIds = new Set(previous.map((song) => String(song.id)));
        const fresh = chosen
          .filter((song) => !knownIds.has(song.id))
          .map((song) => ({
            id: song.id,
            name: song.name,
            displayName: song.displayName,
            uri: song.uri,
            durationMillis: song.durationMillis || 0,
            addedAt: now,
          }));
        return fresh.length ? [...previous, ...fresh] : previous;
      });
      if (customPlaylist) {
        setPlaylists((previous) =>
          previous.map((playlist) =>
            playlist.id === customPlaylist.id
              ? {
                  ...playlist,
                  songIds: [
                    ...new Set([...(playlist.songIds || []), ...chosenIds]),
                  ],
                }
              : playlist,
          ),
        );
      }
      setPickerOpen(false);
      setStatus(
        `${chosen.length} ${chosen.length === 1 ? "música adicionada" : "músicas adicionadas"}${customPlaylist ? " à playlist." : " à biblioteca."}`,
      );
    },
    [customPlaylist, setPickerOpen, setPlaylists, setSongs, setStatus],
  );

  const removeSong = useCallback((song: Song) => {
    if (customPlaylist) {
      Alert.alert(
        "Remover da playlist",
        `Deseja remover "${song.displayName || song.name}" desta playlist?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Remover",
            style: "destructive",
            onPress: () => {
              setPlaylists((previous) =>
                previous.map((playlist) =>
                  playlist.id === customPlaylist.id
                    ? {
                        ...playlist,
                        songIds: (playlist.songIds || []).filter(
                          (id) => String(id) !== String(song.id),
                        ),
                      }
                    : playlist,
                ),
              );
              setStatus("A música foi removida desta playlist.");
            },
          },
        ],
      );
      return;
    }
    Alert.alert(
      "Remover música",
      `Deseja remover "${song.displayName || song.name}" da biblioteca?${isAppOwnedFile(song.uri) ? "" : " O arquivo continuará no seu aparelho."}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              const activeSong = currentSongRef.current;
              const isActiveSong =
                activeSong &&
                (String(activeSong.id) === String(song.id) ||
                  activeSong.uri === song.uri);
              if (isActiveSong && soundRef.current) {
                const player = soundRef.current;
                soundRef.current = null;
                playbackStatusSubscriptionRef.current?.remove();
                playbackStatusSubscriptionRef.current = null;
                player.setActiveForLockScreen(false);
                currentSongRef.current = null;
                setCurrentSong(null);
                setPlayback({ isPlaying: false, positionMillis: 0, durationMillis: 0 });
                try {
                  player.pause();
                } finally {
                  player.remove();
                }
              }
              // Só apaga cópias criadas pelo app; o MP3 original do aparelho fica intacto.
              if (isAppOwnedFile(song.uri)) {
                await FileSystem.deleteAsync(song.uri, { idempotent: true });
              }
            } catch (error) {
              setStatus(`Não foi possível remover o arquivo da música: ${getErrorMessage(error)}`);
              return;
            }
            setSongs((previous) => previous.filter((item) => item.id !== song.id));
            setPlaylists((previous) =>
              previous.map((playlist) => ({
                ...playlist,
                songIds: (playlist.songIds || []).filter(
                  (id) => String(id) !== String(song.id),
                ),
              })),
            );
            setStatus("A música foi removida da biblioteca.");
          },
        },
      ],
    );
  }, [
    customPlaylist,
    currentSongRef,
    playbackStatusSubscriptionRef,
    setCurrentSong,
    setPlayback,
    setPlaylists,
    setSongs,
    setStatus,
    soundRef,
  ]);

  const renameSong = useCallback((song: Song) => {
    setNameInput(song.displayName || song.name.replace(/\.mp3$/i, ""));
    setNameDialog({ mode: "renameSong", songId: song.id });
  }, [setNameDialog, setNameInput]);

  const saveSongName = () => {
    const nextName = nameInput.trim();
    if (!nextName) {
      setStatus("Digite um nome para a música.");
      return;
    }
    const songId =
      nameDialog?.mode === "renameSong" ? nameDialog.songId : undefined;
    setSongs((previous) =>
      previous.map((song) =>
        song.id === songId
          ? { ...song, displayName: nextName }
          : song,
      ),
    );
    if (currentSong?.id === songId) {
      setCurrentSong((previous) => {
        if (!previous) return previous;
        const renamed = { ...previous, displayName: nextName };
        currentSongRef.current = renamed;
        return renamed;
      });
    }
    setNameDialog(null);
    setNameInput("");
  };


  return {
    openSongPicker,
    closeSongPicker,
    requestDeviceAccess,
    openAppSettings,
    addDeviceSongs,
    removeSong,
    renameSong,
    saveSongName,
  };
}
