import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import { AddToAlbumModal } from "./AddToAlbumModal";
import { useGallery } from "./GalleryProvider";
import {
  getMediaPage,
  type GalleryAsset,
  type MediaSource,
  type PageCursor,
} from "@/lib/media";
import { createViewerSession, mediaRoute } from "@/lib/viewer-session";
import { albumStore, mediaStore } from "@/db";
import { deleteFromPhone, shareMedia } from "@/lib/media-actions";
import { MediaThumbnail } from "./MediaThumbnail";

const Tile = memo(function Tile({
  asset,
  size,
  selected,
  selecting,
  onPress,
  onLongPress,
}: {
  asset: GalleryAsset;
  size: number;
  selected: boolean;
  selecting: boolean;
  onPress: (asset: GalleryAsset) => void;
  onLongPress: (asset: GalleryAsset) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        asset.filename || (asset.mediaType === "video" ? "Video" : "Fotografie")
      }
      accessibilityState={{ selected }}
      testID={`media-tile-${asset.id}`}
      onPress={() => onPress(asset)}
      onLongPress={() => onLongPress(asset)}
      style={{ width: size, height: size, padding: 1 }}
    >
      <View style={{ flex: 1, opacity: selected ? 0.65 : 1 }}>
        <MediaThumbnail uri={asset.uri} video={asset.mediaType === "video"} />
      </View>
      {asset.mediaType === "video" ? (
        <View style={styles.badge}>
          <Feather name="play" size={16} color="white" />
          <Text style={styles.white}>
            {Math.floor(asset.duration / 60)}:
            {String(Math.floor(asset.duration % 60)).padStart(2, "0")}
          </Text>
        </View>
      ) : null}
      {selecting ? (
        <View style={styles.check}>
          <Feather
            name={selected ? "check-circle" : "circle"}
            size={24}
            color="white"
          />
        </View>
      ) : null}
    </Pressable>
  );
});

export function MediaGrid({
  source,
  header,
  emptyText = "Žádná média",
  bottomTabs = false,
}: {
  source: MediaSource;
  header?: React.ReactElement;
  emptyText?: string;
  bottomTabs?: boolean;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { revision, setSelectionActive, refreshLibrary } = useGallery();
  const [busy, setBusy] = useState(false);
  const columns = Math.max(
    source.kind === "videos" ? 2 : 3,
    Math.floor(width / (source.kind === "videos" ? 190 : 130)),
  );
  const [items, setItems] = useState<GalleryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [selectionProgress, setSelectionProgress] = useState(0);
  const [picker, setPicker] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const generation = useRef(0);
  const request = useRef<number | null>(null);
  const cursor = useRef<PageCursor>({ offset: 0 });
  const hasMore = useRef(true);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const sourceKey = `${source.kind}:${source.id ?? ""}`;
  const clear = useCallback(() => {
    setSelected(new Set());
    setSelecting(false);
    setSelectingAll(false);
    setPicker(false);
    setSelectionActive(false);
  }, [setSelectionActive]);
  const load = useCallback(async (reset = false) => {
    const current = generation.current;
    if (request.current === current || (!reset && !hasMore.current)) return;
    request.current = current;
    setLoading(true);
    setError(null);
    try {
      const page = await getMediaPage(
        sourceRef.current,
        reset ? { offset: 0 } : cursor.current,
        () => current === generation.current,
      );
      if (current !== generation.current) return;
      cursor.current = page.cursor;
      hasMore.current = page.hasMore;
      setItems((old) => {
        if (reset) return page.items;
        const seen = new Set(old.map((item) => item.id));
        return [...old, ...page.items.filter((item) => !seen.has(item.id))];
      });
    } catch (e) {
      if (current === generation.current)
        setError(
          e instanceof Error ? e.message : "Média se nepodařilo načíst.",
        );
    } finally {
      if (current === generation.current) {
        request.current = null;
        setLoading(false);
      }
    }
  }, []);
  const refresh = useCallback(() => {
    generation.current++;
    clear();
    hasMore.current = true;
    void load(true);
  }, [clear, load]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        generation.current++;
        request.current = null;
        clear();
      };
    }, [refresh, sourceKey, revision, clear]),
  );
  useEffect(() => {
    if (!selecting) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      refresh();
      return true;
    });
    return () => back.remove();
  }, [selecting, refresh]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [message]);
  const onPress = useCallback(
    (asset: GalleryAsset) => {
      if (selecting) {
        setSelected((old) => {
          const next = new Set(old);
          if (next.has(asset.id)) next.delete(asset.id);
          else next.add(asset.id);
          return next;
        });
      } else {
        const key = createViewerSession(
          items,
          sourceRef.current,
          cursor.current,
          hasMore.current,
        );
        router.push(mediaRoute(asset.id, key));
      }
    },
    [selecting, items],
  );
  const onLongPress = useCallback(
    (asset: GalleryAsset) => {
      setSelecting(true);
      setSelectionActive(true);
      setSelected(new Set([asset.id]));
    },
    [setSelectionActive],
  );
  const selectAll = useCallback(async () => {
    const current = generation.current;
    setSelectingAll(true);
    setSelectionProgress(0);
    try {
      const ids = new Set<string>();
      let nextCursor: PageCursor = { offset: 0 };
      let more = true;
      while (more && current === generation.current) {
        const page = await getMediaPage(
          sourceRef.current,
          nextCursor,
          () => current === generation.current,
        );
        for (const item of page.items) ids.add(item.id);
        nextCursor = page.cursor;
        more = page.hasMore;
        if (current === generation.current) setSelectionProgress(ids.size);
      }
      if (current === generation.current) setSelected(ids);
    } catch {
      if (current === generation.current)
        Alert.alert("Výběr se nezdařil", "Zkuste knihovnu obnovit.");
    } finally {
      if (current === generation.current) setSelectingAll(false);
    }
  }, []);
  const action = async (kind: "hide" | "delete" | "remove" | "share") => {
    if (busy || !selected.size) return;
    setBusy(true);
    const ids = [...selected];
    try {
      if (kind === "hide")
        await mediaStore.setHiddenBatch(ids, source.kind !== "hidden");
      if (kind === "delete") {
        if (!(await deleteFromPhone(ids))) return;
        refreshLibrary();
      }
      if (kind === "remove")
        await albumStore.removeMediaBatchFromAlbum(
          [...(await mediaStore.getMediaItemIdsByMediaIds(ids)).values()],
          Number(source.id),
        );
      if (kind === "share") await shareMedia(ids[0]);
      clear();
    } catch (e) {
      Alert.alert(
        "Akce se nezdařila",
        e instanceof Error ? e.message : "Zkuste knihovnu obnovit.",
      );
      if (kind === "delete") refreshLibrary();
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {header}
      {error ? (
        <Pressable
          accessibilityRole="button"
          onPress={refresh}
          style={styles.notice}
        >
          <Text style={{ color: colors.destructive }}>
            {error} · Zkusit znovu
          </Text>
        </Pressable>
      ) : null}
      <FlatList
        key={columns}
        data={items}
        extraData={selected}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        renderItem={({ item }) => (
          <Tile
            asset={item}
            size={width / columns}
            selected={selected.has(item.id)}
            selecting={selecting}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        )}
        initialNumToRender={24}
        maxToRenderPerBatch={18}
        windowSize={5}
        onEndReached={() => {
          if (!selectingAll) void load();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={loading && items.length > 0}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={{ color: colors.mutedForeground }}>{emptyText}</Text>
            )}
          </View>
        }
        ListFooterComponent={
          loading && items.length ? (
            <ActivityIndicator color={colors.primary} />
          ) : null
        }
        contentContainerStyle={{
          paddingBottom:
            (selecting ? 130 : bottomTabs ? 80 : 16) + insets.bottom,
          flexGrow: items.length ? undefined : 1,
        }}
      />
      {selecting ? (
        <View
          style={[
            styles.actions,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <View style={styles.row}>
            <Text style={{ color: colors.foreground }}>
              {selectingAll
                ? `Načítám výběr: ${selectionProgress}`
                : `Vybráno: ${selected.size}`}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={refresh}
              style={styles.button}
            >
              <Text style={{ color: colors.primary }}>Zrušit</Text>
            </Pressable>
          </View>
          <ScrollView horizontal contentContainerStyle={styles.row}>
            <Pressable
              accessibilityRole="button"
              disabled={selectingAll || busy}
              onPress={() => void selectAll()}
              style={styles.button}
            >
              <Text style={{ color: colors.primary }}>Vybrat vše</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!selected.size || selectingAll || busy}
              onPress={() => setPicker(true)}
              style={styles.button}
            >
              <Text
                style={{
                  color: selected.size
                    ? colors.primary
                    : colors.mutedForeground,
                }}
              >
                Přidat do alba
              </Text>
            </Pressable>
            {(
              [
                "hide",
                ...(source.kind === "album" ? ["remove"] : []),
                "share",
                "delete",
              ] as const
            ).map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                disabled={
                  busy ||
                  selectingAll ||
                  !selected.size ||
                  (kind === "share" && selected.size !== 1)
                }
                onPress={() =>
                  void action(kind as "hide" | "remove" | "share" | "delete")
                }
                style={styles.button}
              >
                <Text
                  style={{
                    color:
                      kind === "delete" ? colors.destructive : colors.primary,
                    opacity: kind === "share" && selected.size !== 1 ? 0.4 : 1,
                  }}
                >
                  {kind === "hide"
                    ? source.kind === "hidden"
                      ? "Obnovit"
                      : "Skrýt"
                    : kind === "remove"
                      ? "Odebrat z alba"
                      : kind === "share"
                        ? "Sdílet (1)"
                        : "Smazat z telefonu"}
                </Text>
              </Pressable>
            ))}
            {busy ? <ActivityIndicator color={colors.primary} /> : null}
          </ScrollView>
        </View>
      ) : null}
      {message ? (
        <View
          pointerEvents="none"
          style={[styles.toast, { backgroundColor: colors.foreground }]}
        >
          <Text style={{ color: colors.background }}>{message}</Text>
        </View>
      ) : null}
      <AddToAlbumModal
        visible={picker}
        selectedMediaIds={[...selected]}
        onClose={() => setPicker(false)}
        onAdded={(_id, added, existing = 0, failed = 0) => {
          clear();
          setMessage(
            `Přidáno: ${added} · již v albu: ${existing}${failed ? ` · nedostupné: ${failed}` : ""}`,
          );
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: {
    flex: 1,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    gap: 5,
    padding: 4,
    borderRadius: 6,
    backgroundColor: "#0009",
  },
  white: { color: "#fff", fontSize: 12 },
  check: {
    position: "absolute",
    right: 6,
    top: 6,
    backgroundColor: "#0008",
    borderRadius: 14,
  },
  actions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  button: { minHeight: 44, padding: 12, justifyContent: "center" },
  notice: { padding: 16 },
  toast: {
    position: "absolute",
    bottom: 140,
    alignSelf: "center",
    padding: 14,
    borderRadius: nativeTheme.radius,
  },
});
