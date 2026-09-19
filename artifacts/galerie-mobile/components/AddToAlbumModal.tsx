import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import {
  albumStore,
  mediaStore,
  type AlbumType,
  type AlbumWithCount,
} from "@/db";
import { MediaThumbnail } from "./MediaThumbnail";
import { CreateAlbumModal } from "./CreateAlbumModal";
import { albumCountLabel } from "./AlbumCards";

type Props = {
  visible: boolean;
  selectedMediaIds: string[];
  initialType?: AlbumType;
  onClose: () => void;
  onAdded: (
    albumId: number,
    addedCount: number,
    alreadyPresent?: number,
    failed?: number,
  ) => void;
};

export function AddToAlbumModal({
  visible,
  selectedMediaIds,
  initialType = "normal",
  onClose,
  onAdded,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<AlbumType>(initialType);
  const [albums, setAlbums] = useState<AlbumWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const addingRef = useRef(false);
  const snapshot = useRef<string[]>([]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (visible) {
      setType(initialType);
      snapshot.current = [...new Set(selectedMediaIds)];
    }
  }, [visible, initialType]);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await albumStore.getAlbums(type);
      if (generation.current === current) setAlbums(result);
    } catch {
      if (generation.current === current)
        setError("Alba se nepodařilo načíst. Zkuste to znovu.");
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [type]);
  useEffect(() => {
    if (visible && !creating) void load();
  }, [visible, creating, load]);
  const add = async (albumId: number, ids = snapshot.current) => {
    if (addingRef.current || !ids.length) return;
    addingRef.current = true;
    setAdding(true);
    try {
      const idMap = await mediaStore.getMediaItemIdsByMediaIds(ids);
      const rowIds = [...new Set(ids)].flatMap((id) => {
        const row = idMap.get(id);
        return row == null ? [] : [row];
      });
      const result = await albumStore.addMediaBatchToAlbum(rowIds, albumId);
      onAdded(
        albumId,
        result.added,
        result.alreadyPresent,
        result.failed + new Set(ids).size - rowIds.length,
      );
    } catch (e) {
      Alert.alert(
        "Přidání se nezdařilo",
        e instanceof Error ? e.message : "Zkuste to znovu.",
      );
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };
  return (
    <>
      <Modal
        visible={visible && !creating}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!adding) onClose();
        }}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  Přidat do alba
                </Text>
                <Text
                  style={[styles.subtitle, { color: colors.mutedForeground }]}
                >
                  {snapshot.current.length} vybraných položek
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zavřít výběr alba"
                disabled={adding}
                onPress={onClose}
                style={styles.iconButton}
              >
                <Feather name="x" size={23} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <View
              accessibilityRole="tablist"
              style={[styles.types, { backgroundColor: colors.background }]}
            >
              {(["normal", "hidden"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: type === value }}
                  disabled={adding}
                  onPress={() => setType(value)}
                  style={[
                    styles.typeButton,
                    {
                      backgroundColor:
                        type === value ? colors.accent : "transparent",
                    },
                  ]}
                >
                  <Feather
                    name={value === "normal" ? "folder" : "eye-off"}
                    size={16}
                    color={
                      type === value ? colors.primary : colors.mutedForeground
                    }
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      {
                        color:
                          type === value
                            ? colors.foreground
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    {value === "normal" ? "Normální" : "Skrytá"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
              {type === "hidden"
                ? "Přidaná média se skryjí z běžných přehledů Galerie."
                : "Přidání do normálního alba neobnovuje skryté položky."}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vytvořit nové album a přidat výběr"
              disabled={adding}
              onPress={() => setCreating(true)}
              style={[styles.create, { backgroundColor: colors.accent }]}
            >
              <Feather name="plus" size={20} color={colors.primary} />
              <Text style={[styles.createLabel, { color: colors.primary }]}>
                Nové album
              </Text>
            </Pressable>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : error ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void load()}
                style={styles.loader}
              >
                <Text style={{ color: colors.destructive }}>{error}</Text>
              </Pressable>
            ) : (
              <FlatList
                data={albums}
                keyExtractor={(album) => String(album.id)}
                style={styles.list}
                contentContainerStyle={{ paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text
                    style={[styles.empty, { color: colors.mutedForeground }]}
                  >
                    Zatím žádná {type === "hidden" ? "skrytá " : ""}alba.
                    Vytvořte nové výše.
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    testID={`album-picker-item-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${albumCountLabel(item.photo_count)}`}
                    disabled={adding}
                    onPress={() => void add(item.id)}
                    style={({ pressed }) => [
                      styles.albumRow,
                      {
                        borderColor: colors.border,
                        opacity: adding ? 0.45 : pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[styles.cover, { backgroundColor: colors.muted }]}
                    >
                      {item.cover_uri ? (
                        <MediaThumbnail
                          uri={item.cover_uri}
                          video={item.cover_type === "video"}
                          width={60}
                          height={60}
                        />
                      ) : (
                        <Feather
                          name={type === "hidden" ? "eye-off" : "folder"}
                          size={22}
                          color={colors.mutedForeground}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={[styles.albumName, { color: colors.foreground }]}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.subtitle,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {albumCountLabel(item.photo_count)}
                      </Text>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={19}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                )}
              />
            )}
            {adding ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ padding: 12 }}
              />
            ) : null}
          </View>
        </View>
      </Modal>
      <CreateAlbumModal
        visible={creating}
        initialType={type}
        onClose={() => setCreating(false)}
        onCreated={(album) => {
          const ids = [...snapshot.current];
          setCreating(false);
          setType(album.type);
          void add(album.id, ids);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#020711AA",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 10,
  },
  handle: {
    height: 4,
    width: 36,
    alignSelf: "center",
    borderRadius: 4,
    marginBottom: 8,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  title: { fontSize: 21, fontFamily: nativeTheme.fonts.bold },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  types: {
    marginHorizontal: 20,
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  typeLabel: { fontFamily: nativeTheme.fonts.medium, fontSize: 14 },
  note: {
    paddingHorizontal: 22,
    fontSize: 12,
    lineHeight: 18,
    marginVertical: 12,
  },
  create: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 13,
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  createLabel: { fontSize: 14, fontFamily: nativeTheme.fonts.medium },
  loader: { padding: 28, alignItems: "center" },
  list: { flexGrow: 0 },
  empty: {
    paddingHorizontal: 28,
    paddingVertical: 30,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
  },
  albumRow: {
    minHeight: 86,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: 13,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  albumName: { fontFamily: nativeTheme.fonts.medium, fontSize: 15 },
});
