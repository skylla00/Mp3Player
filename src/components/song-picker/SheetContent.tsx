import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ListRenderItemInfo } from "react-native";
import { FlatList, Keyboard, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { normalizeSearchText } from "@/features/music/utils";
import type { DeviceScanState, DeviceSong, ThemeColors } from "@/features/music/types";
import { PickerRow } from "./PickerRow";
import { StateMessage } from "./StateMessage";
import { ITEM_LENGTH, LIST_HEADER_HEIGHT, SCROLL_TO_TOP_THRESHOLD } from "./styles";
import type { PickerStyles } from "./styles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SheetContent({
  colors,
  styles,
  scan,
  addedIds,
  addedLabel,
  targetLabel,
  bottomInset,
  handleGesture,
  onClose,
  onConfirm,
  onRequestAccess,
  onOpenSettings,
}: {
  colors: ThemeColors;
  styles: PickerStyles;
  scan: DeviceScanState;
  addedIds: Set<string>;
  addedLabel: string;
  targetLabel: string;
  bottomInset: number;
  handleGesture: ReturnType<typeof Gesture.Pan>;
  onClose: () => void;
  onConfirm: (songs: DeviceSong[]) => void;
  onRequestAccess: () => void;
  onOpenSettings: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const enabled = useSharedValue(0);
  const deferredQuery = useDeferredValue(query);
  const listRef = useRef<FlatList<DeviceSong>>(null);

  // Músicas novas primeiro; as que já estão no destino vão para o fim.
  const ordered = useMemo(() => {
    const fresh: DeviceSong[] = [];
    const taken: DeviceSong[] = [];
    for (const song of scan.songs) {
      (addedIds.has(song.id) ? taken : fresh).push(song);
    }
    return [...fresh, ...taken];
  }, [scan.songs, addedIds]);
  const searchTokens = useMemo(
    () => normalizeSearchText(deferredQuery).split(" ").filter(Boolean),
    [deferredQuery],
  );
  const filteredSongs = useMemo(
    () =>
      searchTokens.length
        ? ordered.filter((song) => {
            const name = normalizeSearchText(song.displayName || song.name);
            return searchTokens.every((token) => name.includes(token));
          })
        : ordered,
    [ordered, searchTokens],
  );

  const chosen = useMemo(
    () => ordered.filter((song) => selected.has(song.id)),
    [ordered, selected],
  );
  const availableSongs = useMemo(
    () => ordered.filter((song) => !addedIds.has(song.id)),
    [ordered, addedIds],
  );
  const chosenCount = chosen.length;

  useEffect(() => {
    enabled.set(withTiming(chosenCount > 0 ? 1 : 0, { duration: 170 }));
  }, [chosenCount, enabled]);

  const confirmStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * enabled.get(),
    transform: [{ scale: 0.98 + 0.02 * enabled.get() }],
  }));

  const toggle = useCallback((id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addAll = useCallback(() => {
    if (availableSongs.length) onConfirm(availableSongs);
  }, [availableSongs, onConfirm]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<DeviceSong>) => (
      <PickerRow
        song={item}
        selected={selected.has(item.id)}
        added={addedIds.has(item.id)}
        addedLabel={addedLabel}
        colors={colors}
        styles={styles}
        onToggle={toggle}
      />
    ),
    [addedIds, addedLabel, colors, selected, styles, toggle],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<DeviceSong> | null | undefined, index: number) => ({
      length: ITEM_LENGTH,
      offset: LIST_HEADER_HEIGHT + ITEM_LENGTH * index,
      index,
    }),
    [],
  );
  const searchBar = (
    <View style={styles.searchBar}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        accessibilityLabel="Buscar músicas para adicionar"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setQuery}
        onSubmitEditing={Keyboard.dismiss}
        placeholder="Buscar músicas"
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
  );

  const isLoading = scan.status === "idle" || scan.status === "loading";
  const total = scan.songs.length;

  let subtitle = "";
  if (scan.status === "ready") {
    subtitle = `${total} ${total === 1 ? "MP3 encontrado" : "MP3 encontrados"}`;
  } else if (isLoading) {
    subtitle = "Procurando MP3 no seu aparelho…";
  }

  let body;
  if (scan.status === "denied") {
    body = (
      <StateMessage
        styles={styles}
        colors={colors}
        icon="lock-closed-outline"
        title="Precisamos da sua permissão"
        text={
          scan.canAskAgain
            ? "Para listar os MP3 do aparelho, permita o acesso aos arquivos de áudio."
            : "O acesso aos áudios foi negado. Ative a permissão de músicas e áudio nas configurações do app."
        }
        actionLabel={scan.canAskAgain ? "Permitir acesso" : "Abrir configurações"}
        onAction={scan.canAskAgain ? onRequestAccess : onOpenSettings}
      />
    );
  } else if (scan.status === "error") {
    body = (
      <StateMessage
        styles={styles}
        colors={colors}
        icon="alert-circle-outline"
        title="Não foi possível ler os arquivos"
        text={scan.error}
        actionLabel="Tentar de novo"
        onAction={onRequestAccess}
      />
    );
  } else if (isLoading) {
    body = (
      <StateMessage
        styles={styles}
        colors={colors}
        loading
        title="Procurando suas músicas"
        text="Isso leva só alguns instantes."
      />
    );
  } else if (total === 0) {
    body = (
      <StateMessage
        styles={styles}
        colors={colors}
        icon="folder-open-outline"
        title="Nenhum MP3 encontrado"
        text="Não encontramos arquivos .mp3 no armazenamento do aparelho."
      />
    );
  } else {
    body = (
      <Animated.View entering={FadeIn.duration(220)} style={styles.body}>
        <FlatList
          ref={listRef}
          data={filteredSongs}
          extraData={selected}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          getItemLayout={getItemLayout}
          ListHeaderComponent={searchBar}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.noSearchResults}>
              <Ionicons name="search" size={26} color={colors.muted} />
              <Text style={styles.noSearchResultsText}>
                Nenhuma música corresponde à busca. Tente outras palavras.
              </Text>
            </View>
          }
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
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
        />
        {showScrollToTop && (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              listRef.current?.scrollToOffset({ offset: 0, animated: true })
            }
            style={styles.scrollToTopButton}
          >
            <Ionicons name="arrow-up" size={17} color={colors.accent} />
            <Text style={styles.scrollToTopText}>Voltar ao topo</Text>
          </Pressable>
        )}
      </Animated.View>
    );
  }

  const showFooter = scan.status === "ready" && total > 0;

  return (
    <>
      <GestureDetector gesture={handleGesture}>
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
      </GestureDetector>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Adicionar músicas</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          {scan.status === "ready" && total > 0 && (
            <Text numberOfLines={1} style={styles.subtitle}>
              Destino: {targetLabel}
            </Text>
          )}
        </View>
        <Pressable
          accessibilityLabel="Fechar"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.divider} />
      <View style={styles.body}>{body}</View>
      {showFooter && (
        <View
          style={[styles.footer, { paddingBottom: Math.max(bottomInset, 14) }]}
        >
          <Text numberOfLines={1} style={styles.footerCount}>
            {chosenCount === 0
              ? availableSongs.length
                ? `${availableSongs.length} ${availableSongs.length === 1 ? "música disponível" : "músicas disponíveis"} para adicionar`
                : "Todas as músicas já estão adicionadas"
              : `${chosenCount} ${chosenCount === 1 ? "selecionada" : "selecionadas"}`}
          </Text>
          <View style={styles.footerActions}>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityState={{ disabled: chosenCount === 0 }}
              disabled={chosenCount === 0}
              onPress={() => onConfirm(chosen)}
              style={[styles.confirmButton, confirmStyle]}
            >
              <Ionicons name="add" size={18} color={colors.buttonForeground} />
              <Text numberOfLines={1} style={styles.confirmText}>
                Adicionar
              </Text>
            </AnimatedPressable>
            <Pressable
              accessibilityLabel="Adicionar todas as músicas disponíveis"
              accessibilityRole="button"
              accessibilityState={{ disabled: availableSongs.length === 0 }}
              disabled={availableSongs.length === 0}
              onPress={addAll}
              style={[
                styles.addAllButton,
                availableSongs.length === 0 && styles.rowAdded,
              ]}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
              <Text numberOfLines={1} style={[styles.confirmText, { color: colors.accent }]}>
                Adicionar todas
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}

/**
 * Janela (bottom sheet) com todos os MP3 encontrados no aparelho.
 * As músicas vêm desmarcadas; o botão "Adicionar" fica no rodapé do cartão.
 */
/** Bottom sheet for searching and selecting MP3 files found on the device. */

