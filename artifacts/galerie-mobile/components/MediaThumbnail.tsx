import React, { useEffect, useState } from "react";
import { Image } from "expo-image";
import { View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { createVideoPlayer, type VideoThumbnail } from "expo-video";

const cache = new Map<string, VideoThumbnail>();
let queue = Promise.resolve();
// Only one decoder at a time; offscreen tasks are skipped and the cache is bounded.
export function MediaThumbnail({
  uri,
  video = false,
}: {
  uri: string;
  video?: boolean;
}) {
  const [thumbnail, setThumbnail] = useState<VideoThumbnail | null>(
    video ? (cache.get(uri) ?? null) : null,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setThumbnail(video ? (cache.get(uri) ?? null) : null);
    if (!video || cache.has(uri)) return;
    queue = queue
      .then(async () => {
        if (cancelled) return;
        const existing = cache.get(uri);
        if (existing) {
          setThumbnail(existing);
          return;
        }
        const player = createVideoPlayer(null);
        try {
          await player.replaceAsync(uri);
          if (cancelled) return;
          const [frame] = await player.generateThumbnailsAsync(0, {
            maxWidth: 320,
            maxHeight: 320,
          });
          if (frame) {
            cache.set(uri, frame);
            if (cache.size > 80) cache.delete(cache.keys().next().value!);
            if (!cancelled) setThumbnail(frame);
          }
        } catch {
          if (!cancelled) setFailed(true);
        } finally {
          player.release();
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [uri, video]);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#18202A",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {failed || (video && !thumbnail) ? (
        <Feather name={video ? "video" : "image"} color="#98A5B5" size={28} />
      ) : (
        <Image
          source={video ? thumbnail : { uri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          allowDownscaling
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
