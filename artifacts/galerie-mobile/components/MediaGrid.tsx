import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
import Feather from "@expo/vector-icons/Feather";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { AddToAlbumModal } from "./AddToAlbumModal";
import { useGallery } from "./GalleryProvider";
import {
  getMediaPage,
  type GalleryAsset,
  type MediaSource,
  type PageCursor,
} from "@/lib/media";
import { createViewerSession, mediaRoute } from "@/lib/viewer-session";
import {
  createTimelineRows,
  gridColumns,
  type GridDensity,
} from "@/lib/timeline";
import { albumStore, mediaStore } from "@/db";
import {
  deleteMediaFromPhone,
  shareMedia,
  setMediaTrashed,
  setMediaFavorite,
} from "@/lib/media-actions";
import { MediaThumbnail } from "./MediaThumbnail";
import { useVault } from "./VaultProvider";

type GridAction =
  | "hide"
  | "delete"
  | "remove"
  | "share"
  | "trash"
  | "restore"
  | "favorite"
  | "cover";
const Tile = memo(function Tile({
  asset,
  width,
  height,
  selected,
  selecting,
  trash,
  onPress,
  onLongPress,
}: {
  asset: GalleryAsset;
  width: number;
  height: number;
  selected: boolean;
  selecting: boolean;
  trash: boolean;
  onPress: (asset: GalleryAsset) => void;
  onLongPress: (asset: GalleryAsset) => void;
}) {
  const duration = Math.max(0, Math.floor(asset.duration || 0));
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
      style={[
        styles.tile,
        {
          width,
          height,
          borderColor: selected ? "#2597FF" : "transparent",
          borderWidth: selected ? 2 : 0,
        },
      ]}
    >
      <View style={{ flex: 1, opacity: selected ? 0.65 : 1 }}>
        <MediaThumbnail
          uri={asset.uri}
          video={asset.mediaType === "video"}
          width={width}
          height={height}
          mediaWidth={asset.width}
          mediaHeight={asset.height}
        />
      </View>
      {asset.mediaType === "video" ? (
        <View style={styles.badge}>
          <Feather name="play" size={13} color="white" />
          <Text style={styles.duration}>
            {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
          </Text>
        </View>
      ) : null}
      {selecting ? (
        <View
          style={[styles.check, selected && { backgroundColor: "#168BEE" }]}
        >
          <Feather
            name={selected ? "check" : "circle"}
            size={18}
            color="white"
          />
        </View>
      ) : null}
      {trash ? (
        <View
          style={[
            styles.badge,
            { bottom: undefined, top: 6, maxWidth: width - 12 },
          ]}
        >
          <Text numberOfLines={1} style={styles.duration}>
            {asset.dateExpires
              ? "Do " + new Date(asset.dateExpires).toLocaleDateString("cs-CZ")
              : asset.isTrashed
                ? "Systémový koš"
                : "Místní koš"}
          </Text>
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
  query,
  sort,
  density = "comfortable",
  selectionRequest = 0,
  onCountChange,
}: {
  source: MediaSource;
  header?: React.ReactElement;
  emptyText?: string;
  bottomTabs?: boolean;
  query?: string;
  sort?: "newest" | "oldest" | "name";
  density?: GridDensity;
  selectionRequest?: number;
  onCountChange?: (count: number | null) => void;
}) {
  const colors = useColors();
  const vault = useVault();
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(windowWidth);
  const insets = useSafeAreaInsets();
  const { revision, setSelectionActive, refreshLibrary } = useGallery();
  const [busy, setBusy] = useState(false);
  const columns = gridColumns(
    containerWidth,
    source.kind === "videos",
    density,
  );
  const tileWidth = Math.max(
    1,
    (containerWidth - 24 - (columns - 1) * 4) / columns,
  );
  const tileHeight = source.kind === "videos" ? tileWidth / 1.6 : tileWidth;
  const [items, setItems] = useState<GalleryAsset[]>([]);
  const [totalCount, setTotalCount] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [selectionProgress, setSelectionProgress] = useState(0);
  const [picker, setPicker] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [timelineNow, setTimelineNow] = useState(() => new Date());
  const acting = useRef(false);
  const generation = useRef(0);
  const focused = useRef(false);
  const latestRevision = useRef(revision);
  const seenRevision = useRef(revision);
  latestRevision.current = revision;
  const request = useRef<number | null>(null);
  const appliedSelectionRequest = useRef(0);
  const cursor = useRef<PageCursor>({ offset: 0 });
  const hasMore = useRef(true);
  const sourceRef = useRef(source);
  sourceRef.current = {
    ...source,
    query: query ?? source.query,
    sort: sort ?? source.sort,
  };
  const sourceKey = JSON.stringify(sourceRef.current);
  const hiddenContext =
    source.kind === "hidden" || source.albumType === "hidden";
  const singleSelectedId = selected.size === 1 ? [...selected][0] : undefined;
  const singleLoadedType = singleSelectedId
    ? items.find((item) => item.id === singleSelectedId)?.mediaType
    : undefined;
  useEffect(() => {
    let cancelled = false;
    setSelectedPhotoId(null);
    if (source.kind !== "album" || !singleSelectedId) return;
    if (singleLoadedType) {
      setSelectedPhotoId(
        singleLoadedType === "photo" ? singleSelectedId : null,
      );
      return;
    }
    // Select-all can include a lone photo outside the currently rendered pages.
    void mediaStore
      .getMediaItemByMediaId(singleSelectedId)
      .then((row) => {
        if (
          !cancelled &&
          row?.media_type === "photo" &&
          row.is_available &&
          !row.trashed_at
        )
          setSelectedPhotoId(singleSelectedId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [source.kind, source.id, singleSelectedId, singleLoadedType]);
  useEffect(() => {
    if (source.kind !== "photos") return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = new Date();
      setTimelineNow(now);
      clearTimeout(timer);
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );
      timer = setTimeout(
        update,
        Math.max(1, midnight.getTime() - now.getTime() + 100),
      );
    };
    update();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [source.kind]);
  const rows = useMemo(
    () =>
      createTimelineRows(
        items,
        columns,
        source.kind === "photos" && (sort ?? source.sort) !== "name",
        density,
        timelineNow,
      ),
    [items, columns, source.kind, source.sort, sort, density, timelineNow],
  );
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
      setTotalCount(page.totalCount);
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
    setItems([]);
    setTotalCount(undefined);
    hasMore.current = true;
    cursor.current = { offset: 0 };
    void load(true);
  }, [clear, load]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      seenRevision.current = latestRevision.current;
      refresh();
      return () => {
        focused.current = false;
        generation.current++;
        request.current = null;
        setItems([]);
        clear();
      };
    }, [refresh, sourceKey, clear]),
  );
  // Inline album creation emits a DB revision before the subsequent add. Keep
  // the picker and its selected IDs alive until that operation has finished.
  useEffect(() => {
    if (!focused.current || picker || seenRevision.current === revision) return;
    seenRevision.current = revision;
    refresh();
  }, [revision, picker, refresh]);
  useFocusEffect(
    useCallback(() => {
      if (selectionRequest > appliedSelectionRequest.current) {
        appliedSelectionRequest.current = selectionRequest;
        setSelecting(true);
        setSelectionActive(true);
      }
    }, [selectionRequest, setSelectionActive]),
  );
  useEffect(() => {
    if (totalCount !== undefined) onCountChange?.(totalCount);
    else if (!loading && !error && !hasMore.current)
      onCountChange?.(items.length);
    else onCountChange?.(null);
  }, [totalCount, loading, error, items.length, onCountChange]);
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
      if (selecting)
        setSelected((old) => {
          const next = new Set(old);
          if (next.has(asset.id)) next.delete(asset.id);
          else next.add(asset.id);
          return next;
        });
      else
        router.push(
          mediaRoute(
            asset.id,
            createViewerSession(
              items,
              sourceRef.current,
              cursor.current,
              hasMore.current,
            ),
          ),
        );
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
  const action = async (kind: GridAction) => {
    if (busy || acting.current || !selected.size) return;
    if (
      kind === "cover" &&
      (source.kind !== "album" ||
        selected.size !== 1 ||
        selectedPhotoId !== singleSelectedId)
    )
      return;
    if (hiddenContext && !vault.canAccess()) return;
    acting.current = true;
    setBusy(true);
    const ids = [...selected];
    try {
      if (kind === "cover") {
        await albumStore.setCover(Number(source.id), ids[0]);
        setMessage("Titulní fotografie nastavena.");
      }
      if (kind === "hide") await mediaStore.setHiddenBatch(ids, !hiddenContext);
      if (kind === "trash" || kind === "restore") {
        const result = await setMediaTrashed(ids, kind === "trash");
        setMessage(
          `${kind === "trash" ? "Přesunuto do koše" : "Obnoveno"}: ${result.completedIds.length} / ${ids.length}${result.cancelled ? " · zrušeno" : ""}`,
        );
        if (!result.completedIds.length) return;
        refreshLibrary();
      }
      if (kind === "delete") {
        const result = await deleteMediaFromPhone(ids);
        if (!result.completedIds.length) return;
        setMessage(`Smazáno: ${result.completedIds.length} / ${ids.length}`);
        refreshLibrary();
      }
      if (kind === "favorite") {
        const result = await setMediaFavorite(ids, source.kind !== "favorites");
        setMessage(
          `Změněno: ${result.completedIds.length} / ${ids.length}${result.cancelled ? " · zrušeno" : ""}`,
        );
        if (!result.completedIds.length) return;
        refreshLibrary();
      }
      if (kind === "remove")
        await albumStore.removeMediaBatchFromAlbum(
          [...(await mediaStore.getMediaItemIdsByMediaIds(ids)).values()],
          Number(source.id),
        );
      if (kind === "share") await shareMedia(ids);
      clear();
    } catch (e) {
      Alert.alert(
        "Akce se nezdařila",
        e instanceof Error ? e.message : "Zkuste knihovnu obnovit.",
      );
      if (kind === "delete") refreshLibrary();
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  const actions: GridAction[] =
    source.kind === "trash"
      ? ["restore", "delete"]
      : [
          "hide",
          "favorite",
          ...(source.kind === "album" ? ["remove" as const] : []),
          ...(source.kind === "album" &&
          singleSelectedId &&
          selectedPhotoId === singleSelectedId
            ? ["cover" as const]
            : []),
          "share",
          "trash",
          "delete",
        ];
  const labels: Record<GridAction, string> = {
    hide: hiddenContext ? "Obnovit" : "Skrýt",
    remove: "Odebrat z alba",
    share: "Sdílet",
    trash: "Do koše",
    restore: "Obnovit",
    delete: "Smazat z telefonu",
    favorite: source.kind === "favorites" ? "Z oblíbených" : "Oblíbené",
    cover: "Nastavit jako titulní",
  };
  const icons: Record<
    GridAction,
    React.ComponentProps<typeof Feather>["name"]
  > = {
    hide: hiddenContext ? "eye" : "eye-off",
    remove: "minus-circle",
    share: "share-2",
    trash: "archive",
    restore: "rotate-ccw",
    delete: "trash-2",
    favorite: "heart",
    cover: "image",
  };
  return (
    <View
      onLayout={({ nativeEvent }) =>
        setContainerWidth(nativeEvent.layout.width)
      }
      style={[styles.root, { backgroundColor: colors.background }]}
    >
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
        data={rows}
        extraData={selected}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) =>
          item.kind === "heading" ? (
            <Text style={[styles.heading, { color: colors.foreground }]}>
              {item.label}
            </Text>
          ) : (
            <View style={styles.mediaRow}>
              {item.items.map((asset) => (
                <Tile
                  key={asset.id}
                  asset={asset}
                  width={tileWidth}
                  height={tileHeight}
                  selected={selected.has(asset.id)}
                  selecting={selecting}
                  trash={source.kind === "trash"}
                  onPress={onPress}
                  onLongPress={onLongPress}
                />
              ))}
            </View>
          )
        }
        initialNumToRender={10}
        maxToRenderPerBatch={8}
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
              <>
                <Feather
                  name={source.kind === "trash" ? "trash-2" : "image"}
                  color={colors.mutedForeground}
                  size={34}
                />
                <Text
                  style={[styles.emptyText, { color: colors.mutedForeground }]}
                >
                  {query ? "Žádné odpovídající položky" : emptyText}
                </Text>
              </>
            )}
          </View>
        }
        ListFooterComponent={
          loading && items.length ? (
            <ActivityIndicator style={{ padding: 20 }} color={colors.primary} />
          ) : null
        }
        contentContainerStyle={{
          paddingTop: source.kind === "photos" ? 0 : 8,
          paddingHorizontal: 12,
          paddingBottom:
            (selecting ? 158 : bottomTabs ? 98 : 20) + insets.bottom,
          flexGrow: items.length ? undefined : 1,
        }}
      />
      {selecting ? (
        <View
          style={[
            styles.actions,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 10,
            },
          ]}
        >
          <View style={styles.row}>
            <Text style={[styles.selectionCount, { color: colors.foreground }]}>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.actionRow}
          >
            <Pressable
              accessibilityRole="button"
              disabled={selectingAll || busy}
              onPress={() => void selectAll()}
              style={styles.actionButton}
            >
              <Feather name="check-square" size={20} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.primary }]}>
                Vybrat vše
              </Text>
            </Pressable>
            {source.kind !== "trash" ? (
              <Pressable
                accessibilityRole="button"
                disabled={!selected.size || selectingAll || busy}
                onPress={() => setPicker(true)}
                style={[
                  styles.actionButton,
                  { opacity: selected.size ? 1 : 0.4 },
                ]}
              >
                <Feather name="folder-plus" size={20} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.primary }]}>
                  {hiddenContext ? "Do skrytého alba" : "Do alba"}
                </Text>
              </Pressable>
            ) : null}
            {actions.map((kind) => {
              const disabled = busy || selectingAll || !selected.size;
              const color =
                kind === "delete" ? colors.destructive : colors.primary;
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  accessibilityLabel={
                    kind === "share" ? "Sdílet vybrané položky" : labels[kind]
                  }
                  disabled={disabled}
                  onPress={() => void action(kind)}
                  style={[styles.actionButton, { opacity: disabled ? 0.4 : 1 }]}
                >
                  <Feather name={icons[kind]} size={20} color={color} />
                  <Text style={[styles.actionLabel, { color }]}>
                    {labels[kind]}
                  </Text>
                </Pressable>
              );
            })}
            {busy ? <ActivityIndicator color={colors.primary} /> : null}
          </ScrollView>
        </View>
      ) : null}
      {message ? (
        <View
          pointerEvents="none"
          style={[
            styles.toast,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={{ color: colors.foreground }}>{message}</Text>
        </View>
      ) : null}
      <AddToAlbumModal
        visible={picker}
        selectedMediaIds={[...selected]}
        initialType={hiddenContext ? "hidden" : "normal"}
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
  tile: { borderRadius: 9, overflow: "hidden", backgroundColor: "#102536" },
  mediaRow: { flexDirection: "row", gap: 4, marginBottom: 4 },
  heading: {
    fontSize: 13,
    fontWeight: "600",
    paddingTop: 18,
    paddingBottom: 9,
    letterSpacing: 0.1,
    textTransform: "uppercase",
  },
  empty: {
    flex: 1,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  emptyText: { textAlign: "center", fontSize: 14, lineHeight: 21 },
  badge: {
    position: "absolute",
    bottom: 7,
    left: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 5,
    backgroundColor: "#00121DD9",
  },
  duration: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  check: {
    position: "absolute",
    right: 6,
    top: 6,
    backgroundColor: "#00121DBB",
    borderRadius: 14,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectionCount: { fontSize: 14, fontWeight: "600" },
  button: { minHeight: 44, padding: 12, justifyContent: "center" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionButton: {
    minHeight: 64,
    minWidth: 68,
    paddingHorizontal: 9,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  actionLabel: { fontSize: 11, fontWeight: "500" },
  notice: { padding: 16 },
  toast: {
    position: "absolute",
    bottom: 150,
    alignSelf: "center",
    maxWidth: "90%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
});
