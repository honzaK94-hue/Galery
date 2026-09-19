import React, { useEffect, useState } from "react";
import { Image } from "expo-image";
import { PixelRatio, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { createVideoPlayer, type VideoThumbnail } from "expo-video";
import { useGalleryPreferences } from "./GalleryPreferences";

type CachedFrame = { frame: VideoThumbnail; bytes: number };
const cache = new Map<string, CachedFrame>();
let cacheLimitBytes = 32 * 1024 * 1024;
let cacheBytes = 0;
let cacheGeneration = 0;
let queue = Promise.resolve();
export function clearVideoThumbnailCache(): void {
  cacheGeneration++;
  cache.clear();
  cacheBytes = 0;
}
function cached(key: string): VideoThumbnail | null {
  const entry = cache.get(key);
  if (!entry) return null;
  cache.delete(key);
  cache.set(key, entry);
  return entry.frame;
}
function remember(key: string, frame: VideoThumbnail) {
  const previous = cache.get(key);
  if (previous) cacheBytes -= previous.bytes;
  const bytes = Math.max(1, frame.width) * Math.max(1, frame.height) * 4;
  cache.set(key, { frame, bytes });
  cacheBytes += bytes;
  while (cacheBytes > cacheLimitBytes && cache.size > 1) {
    const oldest = cache.keys().next().value!;
    cacheBytes -= cache.get(oldest)!.bytes;
    cache.delete(oldest);
  }
}
function frameSize(
  width: number,
  height: number,
  mediaWidth?: number,
  mediaHeight?: number,
  maxDimension = 1536,
) {
  const pixelWidth = PixelRatio.getPixelSizeForLayoutSize(width);
  const pixelHeight = PixelRatio.getPixelSizeForLayoutSize(height);
  const scale =
    mediaWidth && mediaHeight
      ? Math.min(
          1,
          Math.max(pixelWidth / mediaWidth, pixelHeight / mediaHeight),
        )
      : 0;
  const targetWidth =
    scale && mediaWidth
      ? mediaWidth * scale
      : Math.max(pixelWidth, pixelHeight) * 1.8;
  const targetHeight =
    scale && mediaHeight
      ? mediaHeight * scale
      : Math.max(pixelWidth, pixelHeight) * 1.8;
  const cap = Math.min(1, maxDimension / Math.max(targetWidth, targetHeight));
  return {
    width: Math.min(
      mediaWidth || 1536,
      Math.max(64, Math.ceil((targetWidth * cap) / 64) * 64),
    ),
    height: Math.min(
      mediaHeight || 1536,
      Math.max(64, Math.ceil((targetHeight * cap) / 64) * 64),
    ),
  };
}

// Original photo URIs are decoded by expo-image to the actual view size. Video
// frames use physical pixels, one decoder at a time, and a byte-bounded LRU.
export function MediaThumbnail({
  uri,
  video = false,
  width,
  height,
  mediaWidth,
  mediaHeight,
  contentFit = "cover",
}: {
  uri: string;
  video?: boolean;
  width?: number;
  height?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  contentFit?: "cover" | "contain";
}) {
  const { thumbnailQuality } = useGalleryPreferences();
  const highQuality = thumbnailQuality === "high";
  cacheLimitBytes = (highQuality ? 32 : 16) * 1024 * 1024;
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  const size = frameSize(
    width ?? measured.width,
    height ?? measured.height,
    mediaWidth,
    mediaHeight,
    highQuality ? 1536 : 768,
  );
  const ready =
    (width ?? measured.width) > 0 && (height ?? measured.height) > 0;
  const key = `${uri}:${size.width}x${size.height}`;
  const [thumbnail, setThumbnail] = useState<VideoThumbnail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const currentGeneration = cacheGeneration;
    setFailed(false);
    const existing = video ? cached(key) : null;
    setThumbnail(existing);
    if (!video || existing || !ready) return;
    queue = queue
      .then(async () => {
        if (cancelled) return;
        const available = cached(key);
        if (available) {
          setThumbnail(available);
          return;
        }
        const player = createVideoPlayer(null);
        try {
          await player.replaceAsync(uri);
          if (cancelled) return;
          const [frame] = await player.generateThumbnailsAsync(0, {
            maxWidth: size.width,
            maxHeight: size.height,
          });
          if (frame && !cancelled) {
            if (currentGeneration === cacheGeneration) remember(key, frame);
            setThumbnail(frame);
          } else if (!cancelled) setFailed(true);
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
  }, [uri, video, key, ready, size.width, size.height]);
  return (
    <View
      onLayout={({ nativeEvent }) => {
        const next = nativeEvent.layout;
        if (
          Math.abs(next.width - measured.width) > 1 ||
          Math.abs(next.height - measured.height) > 1
        )
          setMeasured({ width: next.width, height: next.height });
      }}
      style={{
        flex: 1,
        alignSelf: "stretch",
        backgroundColor: "#0D2232",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {failed || (video && !thumbnail) ? (
        <Feather name={video ? "video" : "image"} color="#718B9D" size={26} />
      ) : (
        <Image
          source={video ? thumbnail : { uri }}
          style={{ width: "100%", height: "100%" }}
          contentFit={contentFit}
          allowDownscaling
          decodeFormat={highQuality ? "argb" : "rgb"}
          cachePolicy="memory-disk"
          recyclingKey={video ? key : uri}
          transition={80}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
