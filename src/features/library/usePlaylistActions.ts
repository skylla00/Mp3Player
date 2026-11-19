import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Alert } from "react-native";
import { BUILT_IN_PLAYLISTS } from "@/features/music/constants";
import type { NameDialog, Playlist } from "@/features/music/types";

interface UsePlaylistActionsOptions {
  playlists: Playlist[];
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  activePlaylistId: string | null;
  setActivePlaylistId: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  nameDialog: NameDialog | null;
  setNameDialog: Dispatch<SetStateAction<NameDialog | null>>;
  nameInput: string;
  setNameInput: Dispatch<SetStateAction<string>>;
}

/** Owns playlist navigation, creation, renaming, and removal actions. */
export function usePlaylistActions({
  playlists,
  setPlaylists,
  activePlaylistId,
  setActivePlaylistId,
  setStatus,
  nameDialog,
  setNameDialog,
  nameInput,
  setNameInput,
}: UsePlaylistActionsOptions) {
  const openPlaylist = useCallback((playlistId: string) => {
    setActivePlaylistId(playlistId);
    setStatus("");
  }, [setActivePlaylistId, setStatus]);

  const onBackToPlaylists = useCallback(() => {
    setActivePlaylistId(null);
    setStatus("");
  }, [setActivePlaylistId, setStatus]);

  const onRenamePlaylist = useCallback((playlist: Playlist) => {
    setNameInput(playlist.name);
    setNameDialog({ mode: "rename", playlistId: playlist.id });
  }, [setNameDialog, setNameInput]);

  const savePlaylistName = () => {
    const nextName = nameInput.trim();
    if (!nextName) {
      setStatus("Digite um nome para a playlist.");
      return;
    }
    const duplicate = [
      ...BUILT_IN_PLAYLISTS,
      ...playlists.filter(
        (playlist) =>
          nameDialog?.mode !== "rename" ||
          playlist.id !== nameDialog.playlistId,
      ),
    ].some((playlist) => playlist.name.toLocaleLowerCase("pt-BR") === nextName.toLocaleLowerCase("pt-BR"));
    if (duplicate) {
      setStatus("Já existe uma playlist com esse nome.");
      return;
    }

    if (nameDialog?.mode === "rename") {
      setPlaylists((previous) =>
        previous.map((playlist) =>
          nameDialog?.mode === "rename" &&
          playlist.id === nameDialog.playlistId
            ? { ...playlist, name: nextName }
            : playlist,
        ),
      );
    } else {
      const playlist = {
        id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: nextName,
        songIds: [],
        createdAt: Date.now(),
      };
      setPlaylists((previous) => [...previous, playlist]);
      setStatus(`Playlist "${nextName}" criada.`);
    }
    setNameDialog(null);
    setNameInput("");
  };

  const createPlaylist = useCallback(() => {
    let name = "Nova playlist";
    let suffix = 2;
    while (
      [...BUILT_IN_PLAYLISTS, ...playlists].some(
        (playlist) => playlist.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
      )
    ) {
      name = `Nova playlist ${suffix}`;
      suffix += 1;
    }
    setNameInput(name);
    setNameDialog({ mode: "create" });
  }, [playlists, setNameDialog, setNameInput]);

  const removePlaylist = useCallback((playlist: Playlist) => {
    Alert.alert("Remover playlist", `Deseja remover "${playlist.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          setPlaylists((previous) =>
            previous.filter((item) => item.id !== playlist.id),
          );
          if (activePlaylistId === playlist.id) setActivePlaylistId(null);
          setStatus(`A playlist "${playlist.name}" foi removida.`);
        },
      },
    ]);
  }, [activePlaylistId, setActivePlaylistId, setPlaylists, setStatus]);

  return {
    openPlaylist,
    onBackToPlaylists,
    onRenamePlaylist,
    savePlaylistName,
    createPlaylist,
    removePlaylist,
  };
}
