import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NameDialog as NameDialogState, ThemeColors } from "@/features/music/types";
import type { AppStyles } from "@/features/player/styles";

interface NameDialogProps {
  dialog: NameDialogState | null;
  name: string;
  colors: ThemeColors;
  styles: AppStyles;
  onChangeName: (name: string) => void;
  onSavePlaylist: () => void;
  onSaveSong: () => void;
  onClose: () => void;
}

/** Shared create/rename dialog for playlists and tracks. */
export function NameDialog({
  dialog,
  name,
  colors,
  styles,
  onChangeName,
  onSavePlaylist,
  onSaveSong,
  onClose,
}: NameDialogProps) {
  const save = dialog?.mode === "renameSong" ? onSaveSong : onSavePlaylist;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(dialog)}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {dialog?.mode === "create"
              ? "Nova playlist"
              : dialog?.mode === "rename"
                ? "Renomear playlist"
                : "Renomear música"}
          </Text>
          <TextInput
            autoFocus
            onChangeText={onChangeName}
            onSubmitEditing={save}
            placeholder="Digite um nome"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            selectTextOnFocus
            style={styles.input}
            value={name}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalActionButton}>
              <Text style={styles.modalActionText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={save}
              style={[styles.modalActionButton, styles.modalActionPrimary]}
            >
              <Text
                style={[styles.modalActionText, styles.modalActionPrimaryText]}
              >
                Salvar
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
