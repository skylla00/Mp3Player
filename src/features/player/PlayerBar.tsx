import React from "react";
import { Text, View } from "react-native";
import type { PlaybackState, Song, ThemeColors } from "@/features/music/types";
import { formatTime } from "@/features/music/utils";
import {
  CenteredIcon,
  LiveDot,
  PlayerArtwork,
  PlayerControlButton,
  PlayPauseButton,
} from "./components/PlayerControls";
import { PlayerTitle } from "./components/PlayerTitle";
import { ProgressSlider } from "./components/ProgressSlider";
import type { AppStyles } from "./styles";

interface PlayerBarProps {
  colors: ThemeColors;
  styles: AppStyles;
  hidden: boolean;
  playback: PlaybackState;
  currentSong: Song | null;
  currentTitle: string;
  progress: number;
  onSeek: (ratio: number, durationMillis: number) => void;
  onSkip: (direction: -1 | 1) => void;
  onTogglePlayback: () => void;
}

/** Persistent playback bar shared by the library and playlist views. */
export function PlayerBar({
  colors,
  styles,
  hidden,
  playback,
  currentSong,
  currentTitle,
  progress,
  onSeek,
  onSkip,
  onTogglePlayback,
}: PlayerBarProps) {
  return (
    <View style={[styles.playerBar, hidden && styles.hidden]}>
      <View style={styles.playerTrack}>
        <PlayerArtwork colors={colors} styles={styles} />
        <View style={styles.playerInfo}>
          <View style={styles.nowPlayingRow}>
            <LiveDot isPlaying={playback.isPlaying} styles={styles} />
            <Text style={styles.nowPlayingLabel}>TOCANDO AGORA</Text>
          </View>
          <PlayerTitle colors={colors} title={currentTitle} styles={styles} />
        </View>
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.timeText}>{formatTime(playback.positionMillis)}</Text>
        <View style={styles.progressSliderWrap}>
          <ProgressSlider
            durationMillis={playback.durationMillis}
            isPlaying={playback.isPlaying}
            onSeek={onSeek}
            progress={progress}
            styles={styles}
          />
        </View>
        <Text style={[styles.timeText, styles.timeTextEnd]}>
          {formatTime(playback.durationMillis)}
        </Text>
      </View>
      <View style={styles.playerControls}>
        <PlayerControlButton
          accessibilityLabel="Música anterior"
          disabled={!currentSong}
          nudge={-4}
          onPress={() => onSkip(-1)}
          style={styles.skipButton}
        >
          <CenteredIcon
            name="play-skip-back"
            size={22}
            color={currentSong ? colors.text : colors.muted}
          />
        </PlayerControlButton>
        <PlayPauseButton
          accessibilityLabel={
            playback.isPlaying ? "Pausar música" : "Reproduzir música"
          }
          buttonForeground={colors.buttonForeground}
          disabled={!currentSong}
          isPlaying={playback.isPlaying}
          onPress={onTogglePlayback}
          styles={styles}
        />
        <PlayerControlButton
          accessibilityLabel="Próxima música"
          disabled={!currentSong}
          nudge={4}
          onPress={() => onSkip(1)}
          style={styles.skipButton}
        >
          <CenteredIcon
            name="play-skip-forward"
            size={22}
            color={currentSong ? colors.text : colors.muted}
          />
        </PlayerControlButton>
      </View>
    </View>
  );
}
