import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import { albumStore, type AlbumWithCount } from "@/db";
import { AlbumCards, NewAlbumButton } from "@/components/AlbumCards";
import { CreateAlbumModal } from "@/components/CreateAlbumModal";
import { GalleryHeader } from "@/components/GalleryHeader";
import { useGalleryPreferences } from "@/components/GalleryPreferences";
import { useGallery, useLibraryFocus } from "@/components/GalleryProvider";
import { MediaGrid } from "@/components/MediaGrid";
import { MediaPermissionGate } from "@/components/MediaPermissionGate";

export default function HiddenScreen() {
  return (
    <MediaPermissionGate requireIndex>
      <HiddenContent />
    </MediaPermissionGate>
  );
}
function HiddenContent() {
  const colors = useColors();
  const { selectionActive } = useGallery();
  const { sort, density } = useGalleryPreferences();
  const [mode, setMode] = useState<"items" | "albums">("items");
  const [albums, setAlbums] = useState<AlbumWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const load = async () => {
    const current = ++generation.current;
    try {
      const result = await albumStore.getAlbums("hidden");
      if (current !== generation.current) return;
      setAlbums(result);
      setError(null);
    } catch {
      if (current === generation.current)
        setError("Skrytá alba se nepodařilo načíst.");
    } finally {
      if (current === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };
  useLibraryFocus(load);
  const header = (
    <GalleryHeader
      title="Skryté"
      onBack={() => router.back()}
      onSearch={() => {
        setSearch(!search);
        setQuery("");
      }}
    >
      <Text style={[styles.description, { color: colors.mutedForeground }]}>
        Skryto pouze v Galerii. Soubory zůstávají dostupné ostatním aplikacím.
      </Text>
      <View
        accessibilityRole="tablist"
        style={[
          styles.segments,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {(["items", "albums"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{
              selected: mode === value,
              disabled: selectionActive,
            }}
            disabled={selectionActive}
            onPress={() => {
              setMode(value);
              setQuery("");
            }}
            style={[
              styles.segment,
              {
                backgroundColor: mode === value ? colors.accent : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                {
                  color:
                    mode === value ? colors.primary : colors.mutedForeground,
                },
              ]}
            >
              {value === "items" ? "Položky" : "Alba"}
            </Text>
          </Pressable>
        ))}
      </View>
      {search ? (
        <TextInput
          autoFocus
          accessibilityLabel={
            mode === "albums"
              ? "Hledat skrytá alba"
              : "Hledat skrytá média podle názvu souboru"
          }
          value={query}
          onChangeText={setQuery}
          placeholder={mode === "albums" ? "Název alba…" : "Název souboru…"}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.search,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
        />
      ) : null}
    </GalleryHeader>
  );
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {mode === "items" ? (
        <MediaGrid
          source={{ kind: "hidden" }}
          header={header}
          query={query}
          sort={sort}
          density={density}
          emptyText={
            query
              ? "Žádná odpovídající skrytá média"
              : "Zatím nemáte žádná skrytá média"
          }
        />
      ) : (
        <>
          {header}
          <AlbumCards
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            sections={[
              {
                key: "hidden",
                title: "Skrytá alba",
                action: <NewAlbumButton onPress={() => setCreate(true)} />,
                emptyText: query
                  ? "Žádné skryté album neodpovídá hledání."
                  : "Vytvořte skryté album a uspořádejte své skryté fotky a videa.",
                items: albums
                  .filter((album) =>
                    album.name
                      .toLocaleLowerCase("cs-CZ")
                      .includes(query.trim().toLocaleLowerCase("cs-CZ")),
                  )
                  .map((album) => ({
                    key: String(album.id),
                    title: album.name,
                    count: album.photo_count,
                    uri: album.cover_uri,
                    video: album.cover_type === "video",
                    hidden: true,
                    onPress: () =>
                      router.push({
                        pathname: "/album/[id]",
                        params: { id: String(album.id) },
                      }),
                  })),
              },
            ]}
          />
        </>
      )}
      <CreateAlbumModal
        visible={create}
        initialType="hidden"
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
  description: {
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  segments: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 15,
    padding: 4,
    gap: 4,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    minHeight: 43,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: { fontFamily: nativeTheme.fonts.medium, fontSize: 14 },
  search: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    fontSize: 15,
  },
});
