import React from "react";
import { Modal, Pressable, Switch, Text, View } from "react-native";
import type { PlayerSettings, ThemeColors } from "@/features/music/types";
import type { AppStyles } from "@/features/player/styles";

interface SettingsDialogProps {
  visible: boolean;
  settings: PlayerSettings;
  colors: ThemeColors;
  lightMode: boolean;
  styles: AppStyles;
  onClose: () => void;
  onSettingChange: (key: "autoAdvance" | "shuffle", value: boolean) => void;
  onThemeChange: (theme: PlayerSettings["themeMode"]) => void;
}

/** App settings for playback behavior and color theme. */
export function SettingsDialog({
  visible,
  settings,
  colors,
  lightMode,
  styles,
  onClose,
  onSettingChange,
  onThemeChange,
}: SettingsDialogProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>Configurações</Text>
          <Text style={styles.cardDescription}>
            Ajuste a reprodução e a aparência do player.
          </Text>
          {([
            {
              key: "autoAdvance",
              title: "Reprodução automática",
              detail: "Tocar outra faixa ao terminar",
            },
            {
              key: "shuffle",
              title: "Ordem aleatória",
              detail: "Escolher outra faixa aleatória",
            },
          ] as const).map((setting, index) => (
            <React.Fragment key={setting.key}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.settingRow}>
                <View style={styles.cardText}>
                  <Text style={styles.settingText}>{setting.title}</Text>
                  <Text style={styles.settingDetail}>{setting.detail}</Text>
                </View>
                <Switch
                  value={settings[setting.key]}
                  onValueChange={(value) => onSettingChange(setting.key, value)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={lightMode ? "#fff" : "#f7f5ff"}
                />
              </View>
            </React.Fragment>
          ))}
          <View style={styles.divider} />
          <View style={styles.themeSetting}>
            <Text style={styles.settingText}>Tema</Text>
            <View style={styles.themeOptions}>
              {([
                { value: "system", label: "Sistema" },
                { value: "light", label: "Claro" },
                { value: "dark", label: "Escuro" },
              ] as const).map((option) => {
                const selected = settings.themeMode === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => onThemeChange(option.value)}
                    style={[
                      styles.themeOption,
                      selected && styles.themeOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.themeOptionText,
                        selected && styles.themeOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={[styles.modalActionButton, styles.modalActionPrimary]}
            >
              <Text
                style={[styles.modalActionText, styles.modalActionPrimaryText]}
              >
                Concluir
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
