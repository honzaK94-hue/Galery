import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as MediaLibrary from "expo-media-library/legacy";
import { mediaStore } from "@/db";
import { AddToAlbumModal } from "@/components/AddToAlbumModal";
import { MediaPermissionGate } from "@/components/MediaPermissionGate";
import { useGallery } from "@/components/GalleryProvider";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ZoomablePhoto } from "@/components/ZoomablePhoto";
import {
  fromAsset,
  getMediaPage,
  identity,
  type GalleryAsset,
} from "@/lib/media";
import { getViewerSession } from "@/lib/viewer-session";
import { deleteFromPhone, shareMedia } from "@/lib/media-actions";

export default function MediaScreen() {
  return (
    <MediaPermissionGate>
      <Viewer />
    </MediaPermissionGate>
  );
}
function Viewer() {
  const params = useLocalSearchParams<{ id: string; session?: string }>();
  const session = useRef(getViewerSession(params.session));
  const [items, setItems] = useState<GalleryAsset[]>(
    session.current?.items ?? [],
  );
  const [index, setIndex] = useState(
    Math.max(
      0,
      items.findIndex((item) => item.id === params.id),
    ),
  );
  const [asset, setAsset] = useState<GalleryAsset | null>(null);
  const [metadata, setMetadata] = useState({ modified: 0, favorite: false });
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [reset, setReset] = useState(0);
  const [info, setInfo] = useState(false);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const list = useRef<FlatList<GalleryAsset>>(null);
  const loadingMore = useRef(false);
  const mounted = useRef(true);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { refreshLibrary, revision } = useGallery();
  const currentId = items[index]?.id ?? params.id;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setAsset(null);
    setError(null);
    setZoomed(false);
    void (async () => {
      try {
        const detail = await MediaLibrary.getAssetInfoAsync(currentId);
        const row = await mediaStore.getMediaItemByMediaId(currentId);
        if (cancelled) return;
        const resolved = {
          ...fromAsset(detail),
          uri:
            detail.mediaType === "video"
              ? detail.uri
              : (detail.localUri ?? detail.uri),
        };
        await mediaStore.upsertBatch([identity(resolved)], () => !cancelled);
        if (cancelled) return;
        setAsset(resolved);
        setMetadata({
          modified: detail.modificationTime,
          favorite: !!detail.isFavorite,
        });
        setHidden(Boolean(row?.is_hidden));
        if (!items.length) setItems([resolved]);
      } catch {
        if (!cancelled)
          setError(
            "Médium není dostupné. Mohlo být smazáno nebo se změnil přístup.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentId, reset, revision]);
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (zoomed) {
        setReset((value) => value + 1);
        setZoomed(false);
        return true;
      }
      if (info) {
        setInfo(false);
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [zoomed, info]);
  const more = useCallback(async () => {
    const context = session.current;
    if (!context?.hasMore || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const page = await getMediaPage(
        context.source,
        context.cursor,
        () => mounted.current,
      );
      if (!mounted.current) return;
      context.cursor = page.cursor;
      context.hasMore = page.hasMore;
      const seen = new Set(context.items.map((item) => item.id));
      context.items = [
        ...context.items,
        ...page.items.filter((item) => !seen.has(item.id)),
      ];
      setItems([...context.items]);
    } catch {
      if (mounted.current)
        Alert.alert(
          "Další média se nepodařilo načíst",
          "Přejeďte znovu na další položku nebo obnovte seznam.",
        );
    } finally {
      loadingMore.current = false;
    }
  }, []);
  useEffect(() => {
    if (index >= items.length - 3) void more();
  }, [index, items.length, more]);
  const removeCurrent = () => {
    const next = items.filter((item) => item.id !== currentId);
    if (session.current) session.current.items = next;
    if (!next.length) {
      router.back();
      return;
    }
    const nextIndex = Math.min(index, next.length - 1);
    setIndex(nextIndex);
    setItems(next);
    list.current?.scrollToIndex({ index: nextIndex, animated: false });
  };
  const action = async (kind: "hide" | "delete" | "share") => {
    if (busy || !asset) return;
    setBusy(true);
    try {
      if (kind === "share") await shareMedia(currentId);
      if (kind === "hide") {
        await mediaStore.setHidden(currentId, !hidden);
        removeCurrent();
      }
      if (kind === "delete" && (await deleteFromPhone([currentId]))) {
        removeCurrent();
        refreshLibrary();
      }
    } catch (e) {
      Alert.alert("Akce se nezdařila", String(e));
      if (kind === "delete") refreshLibrary();
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{ padding: 13, minHeight: 44, opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ color: "white" }}>{label}</Text>
    </Pressable>
  );
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {button("Zpět", () => router.back())}
        <Text numberOfLines={1} style={{ color: "white", flex: 1 }}>
          {asset?.filename ?? "Médium"}
        </Text>
        {button("Info", () => setInfo(!info))}
      </View>
      <View
        style={{ flex: 1 }}
        onLayout={(event) => setFrame(event.nativeEvent.layout)}
      >
        {frame.width > 0 && items.length > 0 ? (
          <FlatList
            ref={list}
            key={`${width}:${frame.width}`}
            data={items}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed && !busy}
            keyExtractor={(item) => item.id}
            initialScrollIndex={index}
            getItemLayout={(_, position) => ({
              length: frame.width,
              offset: frame.width * position,
              index: position,
            })}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            removeClippedSubviews={false}
            showsHorizontalScrollIndicator={false}
            extraData={`${index}:${asset?.uri}:${reset}:${frame.height}:${error}`}
            onMomentumScrollEnd={(event) => {
              const next = Math.round(
                event.nativeEvent.contentOffset.x / frame.width,
              );
              setIndex(Math.max(0, Math.min(items.length - 1, next)));
              setInfo(false);
            }}
            onEndReached={() => void more()}
            onEndReachedThreshold={0.5}
            renderItem={({ item, index: position }) => (
              <View
                style={{
                  width: frame.width,
                  height: frame.height,
                  justifyContent: "center",
                }}
              >
                {position === index ? (
                  error ? (
                    <View style={{ padding: 24 }}>
                      <Text style={{ color: "white" }}>{error}</Text>
                      {button("Zkusit znovu", () =>
                        setReset((value) => value + 1),
                      )}
                    </View>
                  ) : asset?.id === item.id ? (
                    asset.mediaType === "video" ? (
                      <VideoPlayer key={asset.id} uri={asset.uri} />
                    ) : (
                      <ZoomablePhoto
                        key={`${asset.id}:${reset}:${frame.width}:${frame.height}`}
                        uri={asset.uri}
                        width={frame.width}
                        height={frame.height}
                        imageWidth={asset.width}
                        imageHeight={asset.height}
                        onZoomChange={setZoomed}
                      />
                    )
                  ) : (
                    <ActivityIndicator color="white" />
                  )
                ) : null}
              </View>
            )}
          />
        ) : error ? (
          <Text style={{ color: "white", padding: 24 }}>{error}</Text>
        ) : (
          <ActivityIndicator color="white" />
        )}
      </View>
      {info && asset ? (
        <ScrollView
          style={{ maxHeight: "30%", flexGrow: 0 }}
          contentContainerStyle={{ padding: 12 }}
        >
          <Text selectable style={{ color: "white", marginBottom: 8 }}>
            {asset.filename}
          </Text>
          <Text style={{ color: "white" }}>
            {asset.mediaType === "video" ? "Video" : "Fotografie"} ·{" "}
            {asset.width} × {asset.height} ·{" "}
            {new Date(asset.creationTime).toLocaleString("cs-CZ")}
            {asset.mediaType === "video"
              ? ` · ${Math.round(asset.duration)} s`
              : ""}
          </Text>
          <Text style={{ color: "white", marginTop: 8 }}>
            Upraveno:{" "}
            {metadata.modified
              ? new Date(metadata.modified).toLocaleString("cs-CZ")
              : "—"}
          </Text>
          <Text style={{ color: "white", marginTop: 8 }}>
            Oblíbené: {metadata.favorite ? "Ano" : "Ne"}
          </Text>
        </ScrollView>
      ) : null}
      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ alignItems: "center" }}
      >
        {button("Do alba", () => setPicker(true), busy || !asset)}
        {button(
          hidden ? "Obnovit" : "Skrýt",
          () => void action("hide"),
          busy || !asset,
        )}
        {button("Sdílet", () => void action("share"), busy || !asset)}
        {button("Smazat", () => void action("delete"), busy || !asset)}
        {busy ? <ActivityIndicator color="white" /> : null}
      </ScrollView>
      <AddToAlbumModal
        visible={picker}
        selectedMediaIds={[currentId]}
        onClose={() => setPicker(false)}
        onAdded={(_id, added, existing = 0, failed = 0) => {
          setPicker(false);
          Alert.alert(
            "Přidání do alba",
            `Přidáno: ${added}\nJiž v albu: ${existing}\nNedostupné: ${failed}`,
          );
        }}
      />
    </View>
  );
}
