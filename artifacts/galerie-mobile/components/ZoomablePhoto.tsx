import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function ZoomablePhoto({
  uri,
  width,
  height,
  imageWidth,
  imageHeight,
  onZoomChange,
  doubleTapEnabled = true,
}: {
  uri: string;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  onZoomChange: (zoomed: boolean) => void;
  doubleTapEnabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState(false);
  const fit = Math.min(
    width / (imageWidth || width),
    height / (imageHeight || height),
  );
  const fittedWidth = (imageWidth || width) * fit;
  const fittedHeight = (imageHeight || height) * fit;
  const changeZoom = (value: boolean) => {
    setZoomed(value);
    onZoomChange(value);
  };
  useEffect(() => () => onZoomChange(false), [onZoomChange]);
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
      runOnJS(changeZoom)(true);
    })
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(5, startScale.value * event.scale));
    })
    .onEnd(() => {
      const next = scale.value > 1.05;
      if (!next) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
      } else {
        const maxX = Math.max(0, (fittedWidth * scale.value - width) / 2);
        const maxY = Math.max(0, (fittedHeight * scale.value - height) / 2);
        x.value = withTiming(Math.max(-maxX, Math.min(maxX, x.value)));
        y.value = withTiming(Math.max(-maxY, Math.min(maxY, y.value)));
      }
      runOnJS(changeZoom)(next);
    });
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((event) => {
      const maxX = Math.max(0, (fittedWidth * scale.value - width) / 2);
      const maxY = Math.max(0, (fittedHeight * scale.value - height) / 2);
      x.value = Math.max(
        -maxX,
        Math.min(maxX, startX.value + event.translationX),
      );
      y.value = Math.max(
        -maxY,
        Math.min(maxY, startY.value + event.translationY),
      );
    });
  const doubleTap = Gesture.Tap()
    .enabled(doubleTapEnabled)
    .numberOfTaps(2)
    .onEnd((event, success) => {
      if (!success) return;
      const next = scale.value <= 1.05;
      const target = next ? 2.5 : 1;
      const maxX = Math.max(0, (fittedWidth * target - width) / 2);
      const maxY = Math.max(0, (fittedHeight * target - height) / 2);
      scale.value = withTiming(target);
      x.value = withTiming(
        next
          ? Math.max(
              -maxX,
              Math.min(maxX, (width / 2 - event.x) * (target - 1)),
            )
          : 0,
      );
      y.value = withTiming(
        next
          ? Math.max(
              -maxY,
              Math.min(maxY, (height / 2 - event.y) * (target - 1)),
            )
          : 0,
      );
      runOnJS(changeZoom)(next);
    });
  const transform = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));
  return (
    <View
      style={{ width, height, overflow: "hidden", backgroundColor: "#000" }}
    >
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
        <Animated.View style={[StyleSheet.absoluteFill, transform]}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="memory-disk"
            onError={() => setFailed(true)}
          />
        </Animated.View>
      </GestureDetector>
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: "white", padding: 24 }}>
          Fotografii nelze zobrazit. Soubor může být nedostupný nebo poškozený.
        </Text>
      ) : null}
    </View>
  );
}
