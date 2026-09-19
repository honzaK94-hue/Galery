import React, { useState } from "react";
import { TextInput } from "react-native";
import { router } from "expo-router";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { MediaPermissionGate } from "@/components/MediaPermissionGate";
import { MediaGrid } from "@/components/MediaGrid";
import { GalleryHeader } from "@/components/GalleryHeader";
import { useGalleryPreferences } from "@/components/GalleryPreferences";
export default function FavoritesScreen() {
  const colors = useColors();
  const prefs = useGalleryPreferences();
  const [count, setCount] = useState<number | null>(null);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  return (
    <MediaPermissionGate requireIndex>
      <MediaGrid
        source={{ kind: "favorites" }}
        sort={prefs.sort}
        density={prefs.density}
        query={query}
        onCountChange={setCount}
        emptyText="Oblíbené jsou prázdné. V prohlížeči klepněte na srdíčko."
        header={
          <GalleryHeader
            title="Oblíbené"
            subtitle={
              count === null
                ? "Vaše oblíbené fotografie a videa"
                : count + " položek"
            }
            onBack={() => router.back()}
            onSearch={() => {
              setSearch(!search);
              setQuery("");
            }}
          >
            {search ? (
              <TextInput
                accessibilityLabel="Hledat v oblíbených"
                placeholder="Název souboru…"
                placeholderTextColor={colors.mutedForeground}
                value={query}
                onChangeText={setQuery}
                autoFocus
                style={{
                  margin: 16,
                  marginTop: 0,
                  padding: 12,
                  minHeight: 46,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  color: colors.foreground,
                }}
              />
            ) : null}
          </GalleryHeader>
        }
      />
    </MediaPermissionGate>
  );
}
