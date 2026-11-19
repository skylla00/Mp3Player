import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ListRenderItemInfo } from "react-native";
import { BackHandler, FlatList, Keyboard, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { normalizeSearchText } from "@/features/music/utils";
import type { Song, SongAnchorRef, SongMenuAnchor, ThemeColors } from "@/features/music/types";
import { createSongsViewStyles, ITEM_LENGTH, LIST_HEADER_HEIGHT, SCROLL_TO_TOP_THRESHOLD } from "../styles";
import { SongRow } from "./SongRow";
import { SongMenu } from "./SongMenu";

const songKeyExtractor = (item: Song) => String(item.id);
const songItemLayout = (_: ArrayLike<Song> | null | undefined, index: number) => ({
  length: ITEM_LENGTH,
  offset: LIST_HEADER_HEIGHT + ITEM_LENGTH * index,
  index,
});

export function PlaylistSongsView({
  songs,
  currentSongId,
  isPlaying,
  colors,
  onBack,
  onImportSongs,
  onPlaySong,
  onTogglePlayback,
  onRenameSong,
  onRemoveSong,
  onTypingChange,
}: {
  songs: Song[];
  currentSongId?: string;
  isPlaying: boolean;
  colors: ThemeColors;
  onBack: () => void;
  onImportSongs: () => void;
  onPlaySong: (song: Song) => void;
  onTogglePlayback: () => void;
  onRenameSong: (song: Song) => void;
  onRemoveSong: (song: Song) => void;
  onTypingChange?: (isTyping: boolean) => void;
}) {
  const styles = useMemo(() => createSongsViewStyles(colors), [colors]);
  const rootRef = useRef<View>(null);
  const listRef = useRef<FlatList<Song>>(null);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [menu, setMenu] = useState<(SongMenuAnchor & { song: Song }) | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // ---- Busca por palavras-chave -------------------------------------------
  // Cada palavra digitada precisa aparecer em qualquer lugar do nome, em
  // qualquer ordem. Ex.: "amor noite" encontra "Noite de Amor".
  const deferredQuery = useDeferredValue(query);
  const searchIndex = useMemo(
    () =>
      songs.map((song) => {
        const shown = normalizeSearchText(song.displayName || song.name);
        const original = normalizeSearchText(song.name);
        return original && original !== shown ? `${shown} ${original}` : shown;
      }),
    [songs],
  );
  const tokens = useMemo(
    () => normalizeSearchText(deferredQuery).split(" ").filter(Boolean),
    [deferredQuery],
  );
  const isSearching = tokens.length > 0;
  const filteredSongs = useMemo(() => {
    if (!isSearching) return songs;
    return songs.filter((_, index) =>
      tokens.every((token) => searchIndex[index].includes(token)),
    );
  }, [isSearching, songs, searchIndex, tokens]);

  // ---- Botão voltar do Android --------------------------------------------
  // Com o menu aberto, fecha o menu; senão volta para a lista de playlists
  // (em vez de sair do app). Só existe enquanto esta tela está aberta.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (menu) {
        setMenu(null);
      } else {
        onBack();
      }
      return true;
    });
    return () => subscription.remove();
  }, [menu, onBack]);

  // ---- Teclado -------------------------------------------------------------
  // Avisa o app quando o usuário está digitando na busca, para ele esconder o
  // player e dar espaço à lista.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const isTyping = searchFocused && keyboardVisible;
  useEffect(() => {
    onTypingChange?.(isTyping);
    return () => onTypingChange?.(false);
  }, [isTyping, onTypingChange]);

  // ---- Tocar música --------------------------------------------------------
  const latestRef = useRef({ currentSongId, onPlaySong, onTogglePlayback });
  useEffect(() => {
    latestRef.current = { currentSongId, onPlaySong, onTogglePlayback };
  });
  const handlePressSong = useCallback((song: Song) => {
    const latest = latestRef.current;
    if (song.id === latest.currentSongId) latest.onTogglePlayback();
    else latest.onPlaySong(song);
  }, []);

  // ---- Menu dos 3 pontinhos ------------------------------------------------
  const openMenu = useCallback((song: Song, anchorRef: SongAnchorRef) => {
    if (menu?.song.id === song.id) {
      setMenu(null);
      return;
    }
    const root = rootRef.current;
    const anchor = anchorRef.current;
    if (!root || !anchor) return;
    Keyboard.dismiss();
    root.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
      anchor.measureInWindow((x, y, width, height) => {
        setMenu({
          song,
          top: y - rootY,
          height,
          right: Math.max(8, rootX + rootWidth - x + 8),
          containerHeight: rootHeight,
        });
      });
    });
  }, [menu]);
  const closeMenu = useCallback(() => setMenu(null), []);
  const renameFromMenu = useCallback(() => {
    const song = menu?.song;
    setMenu(null);
    if (song) onRenameSong(song);
  }, [menu, onRenameSong]);
  const deleteFromMenu = useCallback(() => {
    const song = menu?.song;
    setMenu(null);
    if (song) onRemoveSong(song);
  }, [menu, onRemoveSong]);

  // ---- Lista ---------------------------------------------------------------
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Song>) => {
      const isCurrent = item.id === currentSongId;
      return (
        <SongRow
          song={item}
          isCurrent={isCurrent}
          isPlaying={isCurrent && isPlaying}
          colors={colors}
          styles={styles}
          onPress={handlePressSong}
          onOpenMenu={openMenu}
        />
      );
    },
    [colors, currentSongId, handlePressSong, isPlaying, openMenu, styles],
  );

  const listEmpty = useMemo(() => {
    if (songs.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="musical-notes" size={34} color="#fff" />
          </View>
          <Text style={styles.emptyTitle}>Sua playlist está vazia</Text>
          <Text style={styles.emptyText}>
            Adicione arquivos MP3 para começar a ouvir suas músicas aqui.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, styles.emptyIconSoft]}>
          <Ionicons name="search" size={30} color={colors.accent} />
        </View>
        <Text style={styles.emptyTitle}>Nada encontrado</Text>
        <Text style={styles.emptyText}>
          Nenhuma música combina com essa busca. Tente outras palavras.
        </Text>
      </View>
    );
  }, [colors.accent, songs.length, styles]);

  const listFooter = useMemo(
    () =>
      isSearching ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={onImportSongs}
          style={styles.addCard}
        >
          <Ionicons name="add-circle" size={26} color={colors.accent} />
          <Text style={styles.addCardText}>Adicionar músicas MP3</Text>
        </Pressable>
      ),
    [colors.accent, isSearching, onImportSongs, styles],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar às playlists"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.accentStrong} />
        </Pressable>
        <View
          style={[
            styles.searchBar,
            searchFocused && styles.searchBarFocused,
          ]}
        >
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            accessibilityLabel="Buscar músicas nesta playlist"
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={() => setSearchFocused(false)}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            placeholder="Buscar nesta playlist"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            selectionColor={colors.accent}
            style={styles.searchInput}
            value={query}
          />
          {query.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              hitSlop={10}
              onPress={() => setQuery("")}
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>
    ),
    [
      colors.accent,
      colors.accentStrong,
      colors.muted,
      onBack,
      query,
      searchFocused,
      styles,
    ],
  );

  return (
    <View ref={rootRef} collapsable={false} style={styles.root}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={filteredSongs}
        renderItem={renderItem}
        keyExtractor={songKeyExtractor}
        getItemLayout={songItemLayout}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const shouldShow =
            event.nativeEvent.contentOffset.y > SCROLL_TO_TOP_THRESHOLD;
          setShowScrollToTop((previous) =>
            previous === shouldShow ? previous : shouldShow,
          );
        }}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        overScrollMode={Platform.OS === "android" ? "always" : "never"}
        decelerationRate={Platform.OS === "android" ? 0.985 : "normal"}
      />

      {showScrollToTop && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            listRef.current?.scrollToOffset({ offset: 0, animated: true })
          }
          style={({ pressed }) => [
            styles.scrollToTopButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="arrow-up" size={17} color={colors.accentStrong} />
          <Text style={styles.scrollToTopText}>Voltar ao topo</Text>
        </Pressable>
      )}

      {menu && (
        <SongMenu
          anchor={menu}
          colors={colors}
          styles={styles}
          onClose={closeMenu}
          onRename={renameFromMenu}
          onDelete={deleteFromMenu}
        />
      )}
    </View>
  );
}


