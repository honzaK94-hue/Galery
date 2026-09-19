import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";

export function VideoPlayer({
  uri,
  active = true,
}: {
  uri: string;
  active?: boolean;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
    error: undefined,
  });
  useEffect(() => {
    if (!active) player.pause();
  }, [active, player]);
  useFocusEffect(
    useCallback(
      () => () => {
        player.pause();
      },
      [player],
    ),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
    });
    return () => subscription.remove();
  }, [player]);
  return (
    <View style={styles.root}>
      <VideoView
        testID="video-player"
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls
        fullscreenOptions={{ enable: true }}
        contentFit="contain"
        requiresLinearPlayback={false}
      />
      {status === "loading" ? (
        <ActivityIndicator pointerEvents="none" color="white" />
      ) : null}
      {status === "error" ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Video se nepodařilo přehrát. Soubor může být nedostupný nebo
          poškozený.{error?.message ? `\n${error.message}` : ""}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
  error: { color: "#fff", textAlign: "center", padding: 24 },
});
