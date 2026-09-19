import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { albumStore, type AlbumWithCount } from "@/db";
import { getNativeAlbums, type NativeAlbumDisplay } from "@/lib/native-albums";
import { getMediaPage, type GalleryAsset } from "@/lib/media";
import {
  AlbumCards,
  NewAlbumButton,
  type AlbumCardItem,
} from "@/components/AlbumCards";
import { CreateAlbumModal } from "@/components/CreateAlbumModal";
import { GalleryHeader } from "@/components/GalleryHeader";
import { useGalleryPreferences } from "@/components/GalleryPreferences";
import { useGallery, useLibraryFocus } from "@/components/GalleryProvider";
import { MediaGrid } from "@/components/MediaGrid";
import { MediaPermissionGate } from "@/components/MediaPermissionGate";

function NativeAlbumDetail({
  album,
  onBack,
}: {
  album: NativeAlbumDisplay;
  onBack: () => void;
}) {
  const colors = useColors();
  const { selectionActive } = useGallery();
  const { sort, density } = useGalleryPreferences();
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener("hardwareBackPress", () => {
        if (selectionActive) return false;
        if (search) {
          setSearch(false);
          setQuery("");
          return true;
        }
        onBack();
        return true;
      });
      return () => listener.remove();
    }, [onBack, selectionActive, search]),
  );
  return (
    <MediaGrid
      source={{ kind: "native", id: album.album.id }}
      bottomTabs
      sort={sort}
      density={density}
      query={query}
      emptyText={query ? "Žádná odpovídající média" : "Album je prázdné"}
      header={
        <GalleryHeader
          title={album.title}
          subtitle="Systémové album"
          onBack={onBack}
          onSearch={() => {
            setSearch(!search);
            setQuery("");
          }}
        >
          {search ? (
            <TextInput
              autoFocus
              accessibilityLabel="Hledat v albu podle názvu souboru"
              placeholder="Název souboru…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              style={[
                styles.search,
                {
                  backgroundColor: colors.card,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
            />
          ) : null}
        </GalleryHeader>
      }
    />
  );
}

export default function AlbumsScreen() {
  return (
    <MediaPermissionGate requireIndex>
      <AlbumsContent />
    </MediaPermissionGate>
  );
}

function AlbumsContent() {
  const colors = useColors();
  const [custom, setCustom] = useState<AlbumWithCount[]>([]);
  const [native, setNative] = useState<NativeAlbumDisplay[]>([]);
  const [favorites, setFavorites] = useState<{
    count: number;
    cover?: GalleryAsset;
  }>({ count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NativeAlbumDisplay | null>(null);
  const [create, setCreate] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const load = useCallback(async () => {
    const current = ++generation.current;
    const results = await Promise.allSettled([
      albumStore.getAlbums("normal"),
      getNativeAlbums(),
      getMediaPage({ kind: "favorites" }),
    ]);
    if (current !== generation.current) return;
    if (results[0].status === "fulfilled") setCustom(results[0].value);
    if (results[1].status === "fulfilled") setNative(results[1].value);
    if (results[2].status === "fulfilled")
      setFavorites({
        count: results[2].value.totalCount ?? results[2].value.items.length,
        cover: results[2].value.items[0],
      });
    setError(
      results.some((result) => result.status === "rejected")
        ? "Některá alba se nepodařilo načíst."
        : null,
    );
    setLoading(false);
    setRefreshing(false);
  }, []);
  useLibraryFocus(load);
  const closeNative = useCallback(() => setSelected(null), []);
  if (selected)
    return <NativeAlbumDetail album={selected} onBack={closeNative} />;
  const matches = (title: string) =>
    title
      .toLocaleLowerCase("cs-CZ")
      .includes(query.trim().toLocaleLowerCase("cs-CZ"));
  const systemCards: AlbumCardItem[] = native
    .filter((album) => matches(album.title))
    .map((album) => ({
      key: `system-${album.album.id}`,
      title: album.title,
      count: album.count,
      uri: album.thumbUri,
      video: album.thumbVideo,
      onPress: () => setSelected(album),
    }));
  const customCards: AlbumCardItem[] = custom
    .filter((album) => matches(album.name))
    .map((album) => ({
      key: `custom-${album.id}`,
      title: album.name,
      count: album.photo_count,
      uri: album.cover_uri,
      video: album.cover_type === "video",
      onPress: () =>
        router.push({
          pathname: "/album/[id]",
          params: { id: String(album.id) },
        }),
    }));
  if (matches("Oblíbené"))
    systemCards.unshift({
      key: "favorites",
      title: "Oblíbené",
      count: favorites.count,
      uri: favorites.cover?.uri,
      video: favorites.cover?.mediaType === "video",
      onPress: () => router.push("/favorites"),
    });
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GalleryHeader
        title="Alba"
        subtitle="Vaše vzpomínky, přehledně"
        onSearch={() => {
          setSearch(!search);
          setQuery("");
        }}
      >
        {search ? (
          <TextInput
            accessibilityLabel="Hledat alba"
            placeholder="Hledat podle názvu alba…"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            value={query}
            onChangeText={setQuery}
            style={[
              styles.search,
              {
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          />
        ) : null}
      </GalleryHeader>
      <AlbumCards
        bottomTabs
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        sections={[
          {
            key: "system",
            title: "Systémová alba",
            items: systemCards,
            emptyText: query
              ? "Žádné systémové album neodpovídá hledání."
              : "Telefon zatím neobsahuje žádná dostupná alba.",
          },
          {
            key: "custom",
            title: "Moje alba",
            items: customCards,
            action: <NewAlbumButton onPress={() => setCreate(true)} />,
            emptyText: query
              ? "Žádné vlastní album neodpovídá hledání."
              : "Vytvořte své první album a přidejte do něj oblíbené okamžiky.",
          },
        ]}
      />
      <CreateAlbumModal
        visible={create}
        onClose={() => setCreate(false)}
        onCreated={(album) => {
          setCreate(false);
          void load();
          router.push({
            pathname: "/album/[id]",
            params: { id: String(album.id) },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    marginHorizontal: 16,
    marginBottom: 12,
  },
});
