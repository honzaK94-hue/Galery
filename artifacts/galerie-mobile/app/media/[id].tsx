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
import Feather from "@expo/vector-icons/Feather";
import { StatusBar } from "expo-status-bar";
import { MediaThumbnail } from "@/components/MediaThumbnail";

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
  const [trashed, setTrashed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [reset, setReset] = useState(0);
  const [info, setInfo] = useState(false);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const list = useRef<FlatList<GalleryAsset>>(null);
  const loadingMore = useRef<number | null>(null);
  const paginationGeneration = useRef(0);
  const removedIds = useRef(new Set<string>());
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
        const source = session.current?.source;
        if (
          source &&
          ((row?.trashed_at && source.kind !== "trash") ||
            (row?.is_hidden &&
              source.kind !== "hidden" &&
              source.kind !== "trash" &&
              source.albumType !== "hidden"))
        ) {
          removeCurrent();
          return;
        }
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
        setTrashed(Boolean(row?.trashed_at));
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
    const generation = paginationGeneration.current;
    if (!context?.hasMore || loadingMore.current === generation) return;
    loadingMore.current = generation;
    const isCurrent = () =>
      mounted.current && generation === paginationGeneration.current;
    try {
      // Mutations can shift both SQLite offsets and Android's native cursor.
      // After a mutation restart paging and skip already loaded identities.
      while (context.hasMore && isCurrent()) {
        const page = await getMediaPage(
          context.source,
          context.cursor,
          isCurrent,
        );
        if (!isCurrent()) return;
        context.cursor = page.cursor;
        context.hasMore = page.hasMore;
        const seen = new Set(context.items.map((item) => item.id));
        const additions = page.items.filter(
          (item) => !seen.has(item.id) && !removedIds.current.has(item.id),
        );
        if (additions.length) {
          context.items = [...context.items, ...additions];
          break;
        }
      }
      if (isCurrent()) setItems([...context.items]);
    } catch {
      if (isCurrent())
        Alert.alert(
          "Další média se nepodařilo načíst",
          "Přejeďte znovu na další položku nebo obnovte seznam.",
        );
    } finally {
      if (loadingMore.current === generation) loadingMore.current = null;
    }
  }, []);
  useEffect(() => {
    if (index >= items.length - 3) void more();
  }, [index, items.length, more]);
  const removeCurrent = () => {
    // The database revision and the action may both notice the same removal.
    if (removedIds.current.has(currentId)) return;
    removedIds.current.add(currentId);
    paginationGeneration.current++;
    const next = (session.current?.items ?? items).filter(
      (item) => item.id !== currentId,
    );
    if (session.current) {
      session.current.items = next;
      session.current.cursor = { offset: 0 };
    }
    if (!next.length) {
      router.back();
      return;
    }
    const nextIndex = Math.min(index, next.length - 1);
    setIndex(nextIndex);
    setItems(next);
    list.current?.scrollToIndex({ index: nextIndex, animated: false });
  };
  const action = async (kind: "hide" | "delete" | "share" | "trash") => {
    if (busy || !asset) return;
    setBusy(true);
    try {
      if (kind === "share") await shareMedia(currentId);
      if (kind === "hide") {
        await mediaStore.setHidden(currentId, !hidden);
        removeCurrent();
      }
      if (kind === "trash") {
        await mediaStore.setTrashedBatch([currentId], !trashed);
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
  const deleteOptions = () => {
    if (trashed) {
      void action("delete");
      return;
    }
    Alert.alert(
      "Odstranit médium",
      "Přesun do koše lze v Galerii vrátit. Smazání z telefonu odstraní samotný soubor.",
      [
        { text: "Zrušit", style: "cancel" },
        { text: "Do koše", onPress: () => void action("trash") },
        {
          text: "Smazat z telefonu",
          style: "destructive",
          onPress: () => void action("delete"),
        },
      ],
    );
  };
  const iconButton = (
    icon: React.ComponentProps<typeof Feather>["name"],
    label: string,
    onPress: () => void,
    disabled = false,
    danger = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        minWidth: 48,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Feather name={icon} size={22} color={danger ? "#FF727B" : "#F2F7FC"} />
    </Pressable>
  );
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
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 6,
          minHeight: 56,
          backgroundColor: "#030B12",
        }}
      >
        {iconButton("arrow-left", "Zpět", () => router.back())}
        <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 6 }}>
          <Text numberOfLines={1} style={{ color: "white", fontSize: 13 }}>
            {asset?.mediaType === "video"
              ? asset.filename
              : `${index + 1} / ${items.length}${session.current?.hasMore ? "+" : ""}`}
          </Text>
          {hidden || trashed ? (
            <Text style={{ color: "#8EA6BA", fontSize: 11, marginTop: 4 }}>
              {trashed ? "Koš" : "Skryté"}
            </Text>
          ) : null}
        </View>
        {iconButton(
          "more-vertical",
          "Možnosti média",
          () =>
            Alert.alert("Médium", asset?.filename, [
              { text: "Informace", onPress: () => setInfo(true) },
              ...(!trashed
                ? [
                    {
                      text: hidden ? "Obnovit do běžné galerie" : "Skrýt",
                      onPress: () => void action("hide"),
                    },
                  ]
                : []),
              { text: "Zavřít", style: "cancel" as const },
            ]),
          !asset,
        )}
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
                ) : (
                  <View style={{ width: frame.width, height: frame.height }}>
                    <MediaThumbnail
                      uri={item.uri}
                      video={item.mediaType === "video"}
                      mediaWidth={item.width}
                      mediaHeight={item.height}
                      contentFit="contain"
                    />
                  </View>
                )}
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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-evenly",
          paddingVertical: 7,
          borderTopWidth: 1,
          borderTopColor: "#112534",
          backgroundColor: "#030B12",
        }}
      >
        {iconButton(
          "share-2",
          "Sdílet",
          () => void action("share"),
          busy || !asset,
        )}
        {!trashed
          ? iconButton(
              "folder-plus",
              "Přidat do alba",
              () => setPicker(true),
              busy || !asset,
            )
          : null}
        {iconButton(
          trashed || hidden ? "rotate-ccw" : "eye-off",
          trashed || hidden ? "Obnovit" : "Skrýt",
          () => void action(trashed ? "trash" : "hide"),
          busy || !asset,
        )}
        {iconButton("info", "Informace", () => setInfo(!info), !asset)}
        {iconButton(
          "trash-2",
          trashed ? "Trvale smazat" : "Odstranit",
          deleteOptions,
          busy || !asset,
          trashed,
        )}
        {busy ? <ActivityIndicator color="white" /> : null}
      </View>
      <AddToAlbumModal
        visible={picker}
        initialType={hidden ? "hidden" : "normal"}
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
