import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { getMusicAssetIds } from "@/modules/device-music";
// Na SDK 57 a API baseada em funções (getAssetsAsync etc.) fica em "/legacy".
// É ela que devolve o `uri` de cada arquivo já na listagem, sem uma chamada extra por faixa.
import * as MediaLibrary from "expo-media-library/legacy";
import type { DeviceScanOptions, DeviceScanState, DeviceSong } from "@/features/music/types";

// A varredura só existe no Android. No iOS a biblioteca de mídia não expõe
// arquivos MP3 soltos, e na web não há acesso ao armazenamento.
export const DEVICE_SCAN_SUPPORTED = Platform.OS === "android";

const PAGE_SIZE = 500;
// Ignora arquivos curtos (toques, notificações, efeitos sonoros). Arquivos cuja
// duração o Android ainda não informou (0) são mantidos para não esconder músicas.
const MIN_DURATION_SECONDS = 30;
const MP3_FILE = /\.mp3$/i;
// Só precisamos ler áudio (Android 13+ pede permissão por tipo de mídia).
const AUDIO_PERMISSION: MediaLibrary.GranularPermission[] = ["audio"];

function toSong(asset: MediaLibrary.Asset): DeviceSong {
  const name = asset.filename;
  return {
    id: `device-${asset.id}`,
    name,
    displayName: name.replace(MP3_FILE, ""),
    uri: asset.uri,
    // `duration` vem em segundos.
    durationMillis: Math.round((asset.duration || 0) * 1000),
  };
}

function compareByName(a: DeviceSong, b: DeviceSong): number {
  return a.displayName.localeCompare(b.displayName, "pt-BR");
}

/**
 * Procura arquivos .mp3 marcados como música pelo Android e guarda a lista em memória.
 * Nada aparece na interface até o usuário abrir a janela de "Adicionar música".
 *
 * status: "idle" | "loading" | "ready" | "denied" | "error"
 */
export function useDeviceMp3s() {
  const [state, setState] = useState<DeviceScanState>({
    status: "idle",
    songs: [],
    canAskAgain: true,
    error: null,
  });
  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const scan = useCallback(async ({ requestPermission = false }: DeviceScanOptions = {}) => {
    if (!DEVICE_SCAN_SUPPORTED) return;

    // Já existe uma varredura em andamento: se ela era silenciosa e agora o
    // usuário pediu a lista, espera terminar para então pedir a permissão.
    if (inFlightRef.current) {
      await inFlightRef.current.catch(() => {});
      if (!requestPermission) return;
    }

    const update = (patch: Partial<DeviceScanState>) => {
      if (mountedRef.current) setState((previous) => ({ ...previous, ...patch }));
    };

    const run = async () => {
      let permission = await MediaLibrary.getPermissionsAsync(
        false,
        AUDIO_PERMISSION,
      );
      if (!permission.granted && requestPermission && permission.canAskAgain) {
        permission = await MediaLibrary.requestPermissionsAsync(
          false,
          AUDIO_PERMISSION,
        );
      }
      if (!permission.granted) {
        // Na varredura silenciosa (ao abrir o app) não mostramos nada: o aviso
        // de permissão só aparece quando o usuário abre a janela.
        update({
          status: requestPermission ? "denied" : "idle",
          canAskAgain: permission.canAskAgain,
        });
        return;
      }

      // Se já temos uma lista, mantém ela visível enquanto atualiza.
      setState((previous) =>
        mountedRef.current
          ? {
              ...previous,
              status: previous.songs.length ? "ready" : "loading",
              error: null,
            }
          : previous,
      );

      const found: DeviceSong[] = [];
      const musicAssetIds = new Set(await getMusicAssetIds());
      let after;
      let hasNextPage = true;
      while (hasNextPage) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: "audio",
          first: PAGE_SIZE,
          after,
        });
        for (const asset of page.assets) {
          const isTooShort =
            asset.duration > 0 && asset.duration < MIN_DURATION_SECONDS;
          if (
            asset.uri &&
            musicAssetIds.has(String(asset.id)) &&
            MP3_FILE.test(asset.filename || "") &&
            !isTooShort
          ) {
            found.push(toSong(asset));
          }
        }
        hasNextPage = page.hasNextPage && Boolean(page.endCursor);
        after = page.endCursor;
      }
      found.sort(compareByName);
      update({ status: "ready", songs: found, canAskAgain: true, error: null });
    };

    const promise = run().catch((error) => {
      update({ status: "error", error: error?.message || String(error) });
    });
    inFlightRef.current = promise;
    try {
      await promise;
    } finally {
      if (inFlightRef.current === promise) inFlightRef.current = null;
    }
  }, []);

  return { ...state, scan };
}