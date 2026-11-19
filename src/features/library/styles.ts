import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/features/music/types";

export const ROW_HEIGHT = 64;
export const ROW_GAP = 8;
export const ITEM_LENGTH = ROW_HEIGHT + ROW_GAP;
export const LIST_HEADER_HEIGHT = 72;

// Menu flutuante dos 3 pontinhos.
export const MENU_WIDTH = 184;
export const MENU_ITEM_HEIGHT = 48;
export const MENU_PADDING = 6;
export const MENU_HEIGHT = MENU_ITEM_HEIGHT * 2 + MENU_PADDING * 2;
export const SCROLL_TO_TOP_THRESHOLD = 240;

export function createSongsViewStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    toolbar: {
      paddingTop: 14,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    backButton: {
      width: 46,
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: { opacity: 0.6 },
    searchBar: {
      flex: 1,
      minWidth: 0,
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    searchBarFocused: { borderColor: colors.accent },
    searchInput: {
      flex: 1,
      padding: 0,
      color: colors.text,
      fontSize: 15,
      includeFontPadding: false,
    },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 },
    row: {
      height: ROW_HEIGHT,
      marginBottom: ROW_GAP,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingLeft: 12,
      paddingRight: 4,
      flexDirection: "row",
      alignItems: "center",
    },
    rowCurrent: { borderColor: colors.accent },
    rowMain: {
      flex: 1,
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    rowArtwork: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
    },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
    rowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
    rowDuration: {
      color: colors.muted,
      fontSize: 11,
      fontVariant: ["tabular-nums"],
    },
    dotsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    dotsButtonPressed: { backgroundColor: colors.surfaceRaised },
    addCard: {
      height: ROW_HEIGHT,
      borderRadius: 16,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    addCardText: { color: colors.text, fontWeight: "700", fontSize: 15 },
    emptyState: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 24,
      gap: 10,
      alignItems: "center",
      backgroundColor: colors.surface,
      marginBottom: ROW_GAP,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    emptyIconSoft: { backgroundColor: colors.surfaceRaised },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
    emptyText: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    menuLayer: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.2)",
      zIndex: 20,
    },
    menuCard: {
      position: "absolute",
      width: MENU_WIDTH,
      padding: MENU_PADDING,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      elevation: 10,
      zIndex: 1,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    scrollToTopButton: {
      position: "absolute",
      top: 10,
      alignSelf: "center",
      zIndex: 10,
      elevation: 8,
      minHeight: 42,
      paddingHorizontal: 14,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    scrollToTopText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    menuItem: {
      height: MENU_ITEM_HEIGHT,
      borderRadius: 11,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    menuItemPressed: { backgroundColor: colors.border },
    menuLabel: { fontSize: 15, fontWeight: "600" },
  });
}


export type SongListStyles = ReturnType<typeof createSongsViewStyles>;
