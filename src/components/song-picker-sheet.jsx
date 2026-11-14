import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Cor do texto/ícone sobre o destaque (a mesma usada nos botões primários do app).
const ON_ACCENT = "#171323";

// Altura fixa dos cartões: permite o getItemLayout e uma rolagem fluida
// mesmo com milhares de músicas.
const ROW_HEIGHT = 66;
const ROW_GAP = 10;
const ITEM_LENGTH = ROW_HEIGHT + ROW_GAP;

function formatDuration(milliseconds = 0) {
  const totalSeconds = Math.floor(Math.max(milliseconds, 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function createStyles(colors) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.62)",
    },
    sheet: {
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      overflow: "hidden",
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      marginTop: 10,
      backgroundColor: colors.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 14,
    },
    headerText: { flex: 1, gap: 4 },
    title: { color: colors.text, fontSize: 20, fontWeight: "700" },
    subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    body: { flex: 1 },
    listContent: { padding: 16, paddingBottom: 6 },
    row: {
      height: ROW_HEIGHT,
      marginBottom: ROW_GAP,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    rowAdded: { opacity: 0.55 },
    rowArtwork: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
    },
    rowText: { flex: 1, gap: 3 },
    rowName: { color: colors.text, fontSize: 15, fontWeight: "700" },
    rowMeta: { color: colors.muted, fontSize: 12 },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 9,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.header,
      paddingHorizontal: 16,
      paddingTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    footerCount: {
      flex: 1,
      color: colors.muted,
      fontSize: 13,
      fontWeight: "600",
    },
    confirmButton: {
      minHeight: 46,
      minWidth: 144,
      borderRadius: 13,
      backgroundColor: colors.accent,
      paddingHorizontal: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    confirmText: { color: ON_ACCENT, fontSize: 14, fontWeight: "700" },
    stateBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: 28,
    },
    stateIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    stateTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
    stateText: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    stateButton: {
      minHeight: 44,
      marginTop: 6,
      borderRadius: 13,
      backgroundColor: colors.accent,
      paddingHorizontal: 20,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}

const PickerRow = React.memo(function PickerRow({
  song,
  selected,
  added,
  addedLabel,
  colors,
  styles,
  onToggle,
}) {
  const selection = useSharedValue(selected ? 1 : 0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    selection.set(
      withTiming(selected ? 1 : 0, {
        duration: 190,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [selected, selection]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.get() }],
    borderColor: interpolateColor(
      selection.get(),
      [0, 1],
      [colors.border, colors.accent],
    ),
    backgroundColor: interpolateColor(
      selection.get(),
      [0, 1],
      [colors.surface, colors.surfaceRaised],
    ),
  }));
  const boxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      selection.get(),
      [0, 1],
      [colors.muted, colors.accent],
    ),
    backgroundColor: interpolateColor(
      selection.get(),
      [0, 1],
      [colors.surface, colors.accent],
    ),
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: selection.get(),
    transform: [{ scale: interpolate(selection.get(), [0, 1], [0.4, 1]) }],
  }));

  const pressIn = useCallback(() => {
    pressScale.set(withTiming(0.985, { duration: 70 }));
  }, [pressScale]);
  const pressOut = useCallback(() => {
    pressScale.set(
      withSpring(1, {
        damping: 18,
        stiffness: 420,
        mass: 0.65,
        overshootClamping: true,
      }),
    );
  }, [pressScale]);

  return (
    <AnimatedPressable
      accessibilityRole="checkbox"
      accessibilityLabel={song.displayName}
      accessibilityState={{ checked: selected, disabled: added }}
      disabled={added}
      onPress={() => onToggle(song.id)}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[styles.row, added && styles.rowAdded, cardStyle]}
    >
      <View style={styles.rowArtwork}>
        <Ionicons name="musical-note" size={20} color={colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={styles.rowName}>
          {song.displayName}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {added
            ? addedLabel
            : song.durationMillis
              ? `MP3 · ${formatDuration(song.durationMillis)}`
              : "Arquivo MP3"}
        </Text>
      </View>
      {added ? (
        <Ionicons name="checkmark-circle" size={24} color={colors.muted} />
      ) : (
        <Animated.View style={[styles.checkbox, boxStyle]}>
          <Animated.View style={checkStyle}>
            <Ionicons name="checkmark" size={16} color={ON_ACCENT} />
          </Animated.View>
        </Animated.View>
      )}
    </AnimatedPressable>
  );
});

function StateMessage({
  styles,
  colors,
  icon,
  title,
  text,
  actionLabel,
  onAction,
  loading,
}) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.stateBox}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} />
      ) : (
        <View style={styles.stateIcon}>
          <Ionicons name={icon} size={28} color={colors.accent} />
        </View>
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      {!!text && <Text style={styles.stateText}>{text}</Text>}
      {!!actionLabel && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={styles.stateButton}
        >
          <Text style={styles.confirmText}>{actionLabel}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// O conteúdo só existe enquanto a janela está montada: ao fechar ele é
// descartado, então a próxima abertura sempre começa com tudo desmarcado.
function SheetContent({
  colors,
  styles,
  scan,
  addedIds,
  addedLabel,
  targetLabel,
  bottomInset,
  onClose,
  onConfirm,
  onRequestAccess,
  onOpenSettings,
}) {
  const [selected, setSelected] = useState(() => new Set());
  const enabled = useSharedValue(0);

  // Músicas novas primeiro; as que já estão no destino vão para o fim.
  const ordered = useMemo(() => {
    const fresh = [];
    const taken = [];
    for (const song of scan.songs) {
      (addedIds.has(song.id) ? taken : fresh).push(song);
    }
    return [...fresh, ...taken];
  }, [scan.songs, addedIds]);

  const chosen = useMemo(
    () => ordered.filter((song) => selected.has(song.id)),
    [ordered, selected],
  );
  const chosenCount = chosen.length;

  useEffect(() => {
    enabled.set(withTiming(chosenCount > 0 ? 1 : 0, { duration: 170 }));
  }, [chosenCount, enabled]);

  const confirmStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * enabled.get(),
    transform: [{ scale: 0.98 + 0.02 * enabled.get() }],
  }));

  const toggle = useCallback((id) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderItem = useCallback(
    ({ item }) => (
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
    (_, index) => ({ length: ITEM_LENGTH, offset: ITEM_LENGTH * index, index }),
    [],
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
          data={ordered}
          extraData={selected}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          getItemLayout={getItemLayout}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
        />
      </Animated.View>
    );
  }

  const showFooter = scan.status === "ready" && total > 0;

  return (
    <>
      <View style={styles.handle} />
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
              ? "Marque as músicas que quer adicionar"
              : `${chosenCount} ${chosenCount === 1 ? "selecionada" : "selecionadas"}`}
          </Text>
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityState={{ disabled: chosenCount === 0 }}
            disabled={chosenCount === 0}
            onPress={() => onConfirm(chosen)}
            style={[styles.confirmButton, confirmStyle]}
          >
            <Ionicons name="add" size={18} color={ON_ACCENT} />
            <Text style={styles.confirmText}>Adicionar</Text>
          </AnimatedPressable>
        </View>
      )}
    </>
  );
}

/**
 * Janela (bottom sheet) com todos os MP3 encontrados no aparelho.
 * As músicas vêm desmarcadas; o botão "Adicionar" fica no rodapé do cartão.
 */
export default function SongPickerSheet({
  visible,
  onClose,
  colors,
  scan,
  addedIds,
  addedLabel,
  targetLabel,
  onConfirm,
  onRequestAccess,
  onOpenSettings,
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.round(height * 0.82);

  // O Modal fica montado até a animação de saída terminar.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const unmount = useCallback(() => setMounted(false), []);

  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.set(
        withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) }),
      );
    } else {
      progress.set(
        withTiming(
          0,
          { duration: 240, easing: Easing.in(Easing.cubic) },
          (finished) => {
            "worklet";
            if (finished) scheduleOnRN(unmount);
          },
        ),
      );
    }
  }, [visible, progress, unmount]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * sheetHeight }],
  }));

  return (
    <Modal
      transparent
      animationType="none"
      visible={mounted}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityLabel="Fechar"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
          <SheetContent
            colors={colors}
            styles={styles}
            scan={scan}
            addedIds={addedIds}
            addedLabel={addedLabel}
            targetLabel={targetLabel}
            bottomInset={insets.bottom}
            onClose={onClose}
            onConfirm={onConfirm}
            onRequestAccess={onRequestAccess}
            onOpenSettings={onOpenSettings}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}