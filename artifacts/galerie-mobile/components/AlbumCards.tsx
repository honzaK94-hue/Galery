import React, { memo, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import { MediaThumbnail } from "./MediaThumbnail";

export type AlbumCardItem = {
  key: string;
  title: string;
  count: number;
  uri?: string | null;
  video?: boolean;
  hidden?: boolean;
  pinned?: boolean;
  onPress: () => void;
  onMenu?: () => void;
};
export type AlbumCardSection = {
  key: string;
  title: string;
  items: AlbumCardItem[];
  emptyText: string;
  action?: React.ReactNode;
};
type ListRow =
  | { key: string; kind: "heading"; section: AlbumCardSection }
  | { key: string; kind: "cards"; items: AlbumCardItem[] }
  | { key: string; kind: "empty"; text: string };

export function albumCountLabel(count: number): string {
  return `${count.toLocaleString("cs-CZ")} ${count === 1 ? "položka" : count >= 2 && count <= 4 ? "položky" : "položek"}`;
}

const AlbumCard = memo(function AlbumCard({
  item,
  width,
}: {
  item: AlbumCardItem;
  width: number;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${albumCountLabel(item.count)}${item.hidden ? ", skryté album" : ""}${item.pinned ? ", připnuté" : ""}`}
      testID={`album-card-${item.key}`}
      onPress={item.onPress}
      onLongPress={item.onMenu}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.cover,
          { height: width * 0.77, backgroundColor: colors.muted },
        ]}
      >
        {item.uri ? (
          <MediaThumbnail
            uri={item.uri}
            video={item.video}
            width={width}
            height={width * 0.77}
          />
        ) : (
          <View style={styles.placeholder}>
            <Feather
              name={item.hidden ? "eye-off" : "folder"}
              size={32}
              color={colors.mutedForeground}
            />
          </View>
        )}
        {item.hidden ? (
          <View style={styles.hiddenBadge}>
            <Feather name="eye-off" size={14} color="#FFFFFF" />
          </View>
        ) : null}
        {item.pinned ? (
          <View style={styles.pinnedBadge}>
            <Feather name="bookmark" size={14} color="#FFFFFF" />
          </View>
        ) : null}
        {item.onMenu ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Možnosti alba ${item.title}`}
            onPress={(event) => {
              event.stopPropagation();
              item.onMenu?.();
            }}
            style={styles.menuButton}
          >
            <Feather name="more-vertical" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.caption}>
        <Text
          numberOfLines={1}
          style={[styles.name, { color: colors.foreground }]}
        >
          {item.title}
        </Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {albumCountLabel(item.count)}
        </Text>
      </View>
    </Pressable>
  );
});

export function NewAlbumButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nové album"
      testID="btn-create-album"
      onPress={onPress}
      style={({ pressed }) => [
        styles.createButton,
        { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Feather name="plus" size={17} color={colors.primaryForeground} />
      <Text style={[styles.createLabel, { color: colors.primaryForeground }]}>
        Nové album
      </Text>
    </Pressable>
  );
}

export function AlbumCards({
  sections,
  loading = false,
  refreshing = false,
  error,
  onRefresh,
  bottomTabs = false,
}: {
  sections: AlbumCardSection[];
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  bottomTabs?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = width >= 960 ? 4 : width >= 640 ? 3 : 2;
  const cardWidth = Math.max(100, (width - 32 - (columns - 1) * 12) / columns);
  const rows = useMemo(
    () =>
      sections.flatMap((section): ListRow[] => {
        const result: ListRow[] = [
          { key: `${section.key}-heading`, kind: "heading", section },
        ];
        for (let index = 0; index < section.items.length; index += columns) {
          result.push({
            key: `${section.key}-${index}`,
            kind: "cards",
            items: section.items.slice(index, index + columns),
          });
        }
        if (!section.items.length && !loading)
          result.push({
            key: `${section.key}-empty`,
            kind: "empty",
            text: section.emptyText,
          });
        return result;
      }),
    [sections, columns, loading],
  );
  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.key}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + (bottomTabs ? 104 : 24),
        flexGrow: 1,
      }}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={5}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      ListHeaderComponent={
        error ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRefresh}
            style={[
              styles.notice,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.destructive }}>
              {error} · Zkusit znovu
            </Text>
          </Pressable>
        ) : null
      }
      ListFooterComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 28 }} />
        ) : null
      }
      renderItem={({ item }) =>
        item.kind === "heading" ? (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {item.section.title}
            </Text>
            {item.section.action}
          </View>
        ) : item.kind === "empty" ? (
          <View
            style={[
              styles.empty,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {item.text}
            </Text>
          </View>
        ) : (
          <View style={styles.cardRow}>
            {item.items.map((album) => (
              <AlbumCard key={album.key} item={album} width={cardWidth} />
            ))}
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 20,
    marginBottom: 14,
  },
  sectionTitle: { fontFamily: nativeTheme.fonts.bold, fontSize: 18 },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  cover: { width: "100%", overflow: "hidden" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  hiddenBadge: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "#07101DCC",
    borderRadius: 16,
    padding: 7,
  },
  menuButton: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#07101DCC",
    borderRadius: 22,
  },
  pinnedBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    backgroundColor: "#168BEE",
    borderRadius: 16,
    padding: 7,
  },
  caption: { paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  name: { fontFamily: nativeTheme.fonts.medium, fontSize: 15 },
  count: { fontFamily: nativeTheme.fonts.regular, fontSize: 12 },
  createButton: {
    minHeight: 42,
    borderRadius: 13,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  createLabel: { fontFamily: nativeTheme.fonts.medium, fontSize: 13 },
  empty: { padding: 24, borderRadius: 16, borderWidth: 1 },
  emptyText: { textAlign: "center", fontSize: 14, lineHeight: 21 },
  notice: { padding: 16, borderWidth: 1, borderRadius: 14, marginTop: 12 },
});
