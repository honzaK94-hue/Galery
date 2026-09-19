import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { DeviceOnly } from "./DeviceOnly";
import { DevelopmentBuildRequired, isExpoGo } from "./DevelopmentBuildRequired";
import { MediaPermissionGate } from "./MediaPermissionGate";
import { MediaGrid } from "./MediaGrid";
import { GalleryHeader } from "./GalleryHeader";
import { useGalleryPreferences } from "./GalleryPreferences";

export function LibraryScreen({ kind }: { kind: "photos" | "videos" }) {
  const colors = useColors();
  const prefs = useGalleryPreferences();
  const params = useLocalSearchParams<{ search?: string }>();
  const [searching, setSearching] = useState(false);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 220);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    if (params.search) setSearching(true);
  }, [params.search]);
  useEffect(() => {
    setCount(null);
  }, [query, prefs.sort]);
  useFocusEffect(
    useCallback(() => {
      prefs.setLastLibrary(kind);
    }, [kind, prefs.setLastLibrary]),
  );
  if (Platform.OS === "web") return <DeviceOnly />;
  if (isExpoGo) return <DevelopmentBuildRequired />;
  return (
    <MediaPermissionGate>
      <MediaGrid
        source={{ kind }}
        bottomTabs
        query={query}
        sort={prefs.sort}
        density={prefs.density}
        selectionRequest={
          prefs.selectionTarget === kind ? prefs.selectionRequest : 0
        }
        onCountChange={setCount}
        emptyText={
          query
            ? "Žádné odpovídající soubory"
            : kind === "photos"
              ? "Vaše fotografie se zobrazí zde"
              : "Vaše videa se zobrazí zde"
        }
        header={
          <GalleryHeader
            title={kind === "photos" ? "Fotky" : "Videa"}
            subtitle={
              query
                ? `Hledání: ${query}`
                : count === null
                  ? "Vaše vzpomínky, na jednom místě"
                  : `${count.toLocaleString("cs-CZ")} ${kind === "photos" ? "fotografií" : "videí"}`
            }
            onSearch={() => {
              setSearching(!searching);
              if (searching) setInput("");
            }}
          >
            {searching ? (
              <View
                style={{
                  marginHorizontal: 16,
                  marginBottom: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  paddingHorizontal: 12,
                }}
              >
                <Feather
                  name="search"
                  color={colors.mutedForeground}
                  size={18}
                />
                <TextInput
                  autoFocus
                  value={input}
                  onChangeText={setInput}
                  placeholder="Hledat podle názvu souboru"
                  placeholderTextColor={colors.mutedForeground}
                  accessibilityLabel="Hledat média"
                  style={{
                    flex: 1,
                    minHeight: 46,
                    paddingHorizontal: 10,
                    color: colors.foreground,
                  }}
                />
                <Pressable
                  accessibilityLabel="Zrušit hledání"
                  onPress={() => {
                    setInput("");
                    setSearching(false);
                  }}
                  style={{ padding: 8 }}
                >
                  <Feather name="x" color={colors.foreground} size={18} />
                </Pressable>
              </View>
            ) : null}
          </GalleryHeader>
        }
      />
    </MediaPermissionGate>
  );
}
