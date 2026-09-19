import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import Feather from "@expo/vector-icons/Feather";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function VideoPlayer({
  uri,
  active = true,
  autoplay = false,
  secure = false,
}: {
  uri: string;
  active?: boolean;
  autoplay?: boolean;
  secure?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    if (autoplay && active) instance.play();
  });
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
    error: undefined,
  });
  useEffect(() => {
    if (!active) {
      player.pause();
      setExpanded(false);
    }
  }, [active, player]);
  useFocusEffect(
    useCallback(
      () => () => {
        player.pause();
        setExpanded(false);
      },
      [player],
    ),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        player.pause();
        setExpanded(false);
      }
    });
    return () => subscription.remove();
  }, [player]);
  const content = (
    <View style={styles.root}>
      <VideoView
        testID="video-player"
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls
        fullscreenOptions={{ enable: !secure }}
        allowsPictureInPicture={false}
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
      {secure ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Zmenšit video" : "Video na celou obrazovku"
          }
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [
            styles.fullscreenButton,
            {
              top: expanded ? insets.top + 12 : 12,
              right: expanded ? insets.right + 12 : 12,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Feather
            name={expanded ? "minimize" : "maximize"}
            size={23}
            color="white"
          />
        </Pressable>
      ) : null}
    </View>
  );
  // Hidden playback remains in the secured app window. RN's Android Modal
  // copies its FLAG_SECURE before showing; Expo's separate fullscreen Activity
  // does not. Mount exactly one VideoView while retaining this same player,
  // playback position and pause state across expansion/collapse.
  return secure && expanded ? (
    <Modal
      visible
      animationType="none"
      presentationStyle="fullScreen"
      supportedOrientations={["portrait", "landscape"]}
      statusBarTranslucent
      navigationBarTranslucent
      backdropColor="#000"
      onRequestClose={() => setExpanded(false)}
    >
      <StatusBar hidden style="light" />
      {content}
    </Modal>
  ) : (
    content
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
  error: { color: "#fff", textAlign: "center", padding: 24 },
  fullscreenButton: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#05101CCC",
    alignItems: "center",
    justifyContent: "center",
  },
});
