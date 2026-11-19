import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { AppStyles } from "../styles";
import { ACCESSIBILITY_SEEK_STEP_MS, PLAYER_UPDATE_INTERVAL_MS, PROGRESS_THUMB_SIZE } from "@/features/music/constants";
import { formatTime } from "@/features/music/utils";

export const ProgressSlider = React.memo(function ProgressSlider({
  progress,
  durationMillis,
  isPlaying,
  onSeek,
  styles,
}: {
  progress: number;
  durationMillis: number;
  isPlaying: boolean;
  onSeek: (ratio: number, durationMillis: number) => void;
  styles: AppStyles;
}) {
  const sliderWidth = useSharedValue(0);
  const animatedProgress = useSharedValue(
    Math.min(Math.max(progress, 0), 1),
  );
  // Verdadeiro enquanto o usuário está com o dedo na barra.
  const isDragging = useSharedValue(false);
  // Evita buscar duas vezes no mesmo toque e reverter uma busca já feita.
  const didCommit = useSharedValue(false);
  // Últimos valores vindos do player, lidos pelos callbacks que rodam no JS.
  const latestRef = useRef({ progress, durationMillis });
  const latestProgress = useSharedValue(progress);
  const latestDuration = useSharedValue(durationMillis);
  const canSeek = durationMillis > 0;

  const fillStyle = useAnimatedStyle(() => ({
    // A trilha tem overflow hidden: deslocar o preenchimento (largura total)
    // para a esquerda dá o mesmo visual de animar a largura, sem recalcular layout.
    transform: [
      { translateX: (animatedProgress.get() - 1) * sliderWidth.get() },
    ],
  }));
  // A bolinha cresce discretamente enquanto o dedo está na barra.
  const thumbScale = useDerivedValue(() =>
    withTiming(isDragging.get() ? 1.12 : 1, {
      duration: 100,
      easing: Easing.out(Easing.quad),
    }),
  );
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          animatedProgress.get() * sliderWidth.get() - PROGRESS_THUMB_SIZE / 2,
      },
      { scale: thumbScale.get() },
    ],
  }));

  const commitSeek = useCallback(
    (ratio: number, total: number) => {
      onSeek(ratio, total);
    },
    [onSeek],
  );

  const gesture = useMemo(() => {
    const moveTo = (x: number) => {
      "worklet";
      const width = sliderWidth.get();
      if (width > 0) {
        animatedProgress.set(Math.min(Math.max(x / width, 0), 1));
      }
    };
    const commit = () => {
      "worklet";
      if (didCommit.get()) return;
      didCommit.set(true);
      scheduleOnRN(
        commitSeek,
        animatedProgress.get(),
        latestDuration.get(),
      );
    };

    const pan = Gesture.Pan()
      .enabled(canSeek)
      .minDistance(4)
      .onBegin((event) => {
        isDragging.set(true);
        didCommit.set(false);
        moveTo(event.x);
      })
      .onUpdate((event) => {
        moveTo(event.x);
      })
      .onEnd(() => {
        commit();
      })
      .onFinalize(() => {
        isDragging.set(false);
        if (!didCommit.get()) {
          animatedProgress.set(
            Math.min(Math.max(latestProgress.get(), 0), 1),
          );
        }
      });

    // Toque simples em qualquer ponto da barra pula para aquele ponto.
    const tap = Gesture.Tap()
      .enabled(canSeek)
      .maxDuration(10000)
      .onEnd((event) => {
        moveTo(event.x);
        commit();
      });

    return Gesture.Race(pan, tap);
  }, [
    animatedProgress,
    canSeek,
    commitSeek,
    didCommit,
    isDragging,
    latestDuration,
    latestProgress,
    sliderWidth,
  ]);

  useEffect(() => {
    latestRef.current = { progress, durationMillis };
    latestProgress.set(progress);
    latestDuration.set(durationMillis);
  }, [durationMillis, latestDuration, latestProgress, progress]);

  // Ações dos leitores de tela (TalkBack): avançar ou voltar um passo fixo.
  const adjustBy = useCallback(
    (deltaMillis: number) => {
      const { progress: current, durationMillis: total } = latestRef.current;
      if (!total) return;
      const ratio = Math.min(Math.max(current + deltaMillis / total, 0), 1);
      animatedProgress.set(ratio);
      onSeek(ratio, total);
    },
    [animatedProgress, onSeek],
  );

  // Valor falado em passos de 5 s, para o leitor de tela não repetir a cada atualização.
  const spokenPosition = Math.floor((progress * durationMillis) / 5000) * 5000;

  useEffect(() => {
    if (isDragging.get()) return;
    const next = Math.min(Math.max(progress, 0), 1);
    const delta = next - animatedProgress.get();
    if (isPlaying && delta > 0 && delta < 0.15) {
      // Avanço normal da música: desliza até a nova posição em vez de dar saltos.
      animatedProgress.set(
        withTiming(next, {
          duration: PLAYER_UPDATE_INTERVAL_MS,
          easing: Easing.linear,
        }),
      );
    } else {
      animatedProgress.set(next);
    }
  }, [animatedProgress, isDragging, isPlaying, progress]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Avançar ou retroceder na música"
        accessibilityValue={{
          text: canSeek
            ? `${formatTime(spokenPosition)} de ${formatTime(durationMillis)}`
            : "Nenhuma música tocando",
        }}
        accessibilityActions={[
          { name: "increment", label: "Avançar 10 segundos" },
          { name: "decrement", label: "Voltar 10 segundos" },
        ]}
        onAccessibilityAction={(event) => {
          const action = event.nativeEvent.actionName;
          if (action === "increment") adjustBy(ACCESSIBILITY_SEEK_STEP_MS);
          if (action === "decrement") adjustBy(-ACCESSIBILITY_SEEK_STEP_MS);
        }}
        onLayout={(event) => {
          sliderWidth.set(event.nativeEvent.layout.width);
        }}
        style={styles.progressTouchArea}
      >
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, fillStyle]} />
        </View>
        <Animated.View style={[styles.progressThumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
});



