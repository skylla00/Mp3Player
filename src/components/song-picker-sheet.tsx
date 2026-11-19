import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import type { DeviceScanState, DeviceSong, ThemeColors } from "@/features/music/types";
import { SheetContent } from "./song-picker/SheetContent";
import { createStyles } from "./song-picker/styles";

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
}: {
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
  scan: DeviceScanState;
  addedIds: Set<string>;
  addedLabel: string;
  targetLabel: string;
  onConfirm: (songs: DeviceSong[]) => void;
  onRequestAccess: () => void;
  onOpenSettings: () => void;
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
  const dragY = useSharedValue(0);

  const handleGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .onUpdate((event) => {
          dragY.set(Math.max(event.translationY, 0));
        })
        .onEnd((event) => {
          if (
            event.translationY > sheetHeight * 0.22 ||
            event.velocityY > 900
          ) {
            scheduleOnRN(onClose);
          } else {
            dragY.set(
              withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) }),
            );
          }
        })
        .onFinalize((_event, success) => {
          if (!success) {
            dragY.set(
              withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) }),
            );
          }
        }),
    [dragY, onClose, sheetHeight],
  );

  useEffect(() => {
    if (visible) {
      dragY.set(
        withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) }),
      );
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
  }, [visible, dragY, progress, unmount]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.get() * Math.max(0, 1 - dragY.get() / sheetHeight),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - progress.get()) * sheetHeight + dragY.get() },
    ],
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
      <GestureHandlerRootView style={{ flex: 1 }}>
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
              handleGesture={handleGesture}
              onClose={onClose}
              onConfirm={onConfirm}
              onRequestAccess={onRequestAccess}
              onOpenSettings={onOpenSettings}
            />
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
