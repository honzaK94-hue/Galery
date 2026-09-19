import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { MediaPermissionGate } from "@/components/MediaPermissionGate";
import { MediaGrid } from "@/components/MediaGrid";
import { GalleryHeader } from "@/components/GalleryHeader";
import { useGalleryPreferences } from "@/components/GalleryPreferences";
import { useGallery } from "@/components/GalleryProvider";
import { useVault } from "@/components/VaultProvider";
import { VaultGate } from "@/components/VaultGate";
import { getMediaPage, type MediaSource, type PageCursor } from "@/lib/media";
import { deleteMediaFromPhone, setMediaTrashed } from "@/lib/media-actions";

export default function TrashScreen() {
  const vault = useVault();
  const [includeHidden, setIncludeHidden] = useState(false);
  return (
    <MediaPermissionGate requireIndex>
      {includeHidden ? (
        <VaultGate onBack={() => setIncludeHidden(false)}>
          <TrashContent
            includeHidden
            onHidden={() => setIncludeHidden(false)}
          />
        </VaultGate>
      ) : (
        <TrashContent
          includeHidden={false}
          onHidden={() => {
            void vault.unlock().then((ok) => {
              if (ok) setIncludeHidden(true);
            });
          }}
        />
      )}
    </MediaPermissionGate>
  );
}
function TrashContent({
  includeHidden,
  onHidden,
}: {
  includeHidden: boolean;
  onHidden: () => void;
}) {
  const colors = useColors();
  const prefs = useGalleryPreferences();
  const gallery = useGallery();
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const source: MediaSource = { kind: "trash", includeHidden };
  const bulk = async (kind: "restore" | "delete" | "migrate") => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const ids = new Set<string>();
      let cursor: PageCursor = { offset: 0 };
      let more = true;
      while (more) {
        const page = await getMediaPage(source, cursor);
        page.items.forEach((item) => {
          if (kind !== "migrate" || !item.isTrashed) ids.add(item.id);
        });
        cursor = page.cursor;
        more = page.hasMore;
      }
      if (!ids.size) {
        Alert.alert(
          "Žádné položky",
          kind === "migrate"
            ? "Všechny položky už jsou v systémovém koši."
            : "V tomto pohledu je koš prázdný.",
        );
        return;
      }
      const result =
        kind === "delete"
          ? await deleteMediaFromPhone([...ids])
          : await setMediaTrashed([...ids], kind === "migrate");
      gallery.refreshLibrary();
      Alert.alert(
        result.cancelled ? "Akce přerušená" : "Koš",
        "Změněno: " +
          result.completedIds.length +
          " / " +
          ids.size +
          (result.cancelled ? "\nNepotvrzené položky zůstaly zachované." : ""),
      );
    } catch (error) {
      Alert.alert(
        "Akce se nezdařila",
        error instanceof Error ? error.message : "Zkuste to znovu.",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <MediaGrid
        source={source}
        sort={prefs.sort}
        density={prefs.density}
        onCountChange={setCount}
        emptyText="Koš je prázdný"
        header={
          <GalleryHeader
            title="Koš"
            subtitle={
              (count === null ? "Systémový koš Androidu" : count + " položek") +
              (includeHidden ? " · včetně skrytých" : "")
            }
            onBack={() => router.back()}
          >
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 12,
                padding: 13,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
              }}
            >
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                Android může položky po vypršení lhůty trvale odstranit; datum
                je uvedené u položky, pokud je dostupné. Dřívější místní koš
                zůstává zachovaný. Skryté položky se zobrazí až po odemknutí.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 4,
                  marginTop: 8,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={onHidden}
                  style={{ padding: 10, minHeight: 44 }}
                >
                  <Text style={{ color: colors.primary }}>
                    {includeHidden ? "Bez skrytých" : "Zahrnout skryté"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void bulk("restore")}
                  style={{ padding: 10, minHeight: 44 }}
                >
                  <Text style={{ color: colors.primary }}>Obnovit vše</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void bulk("delete")}
                  style={{ padding: 10, minHeight: 44 }}
                >
                  <Text style={{ color: colors.destructive }}>
                    Vysypat zobrazený koš
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void bulk("migrate")}
                  style={{ padding: 10, minHeight: 44 }}
                >
                  <Text style={{ color: colors.primary }}>
                    Převést starý koš
                  </Text>
                </Pressable>
              </View>
              {busy ? <ActivityIndicator color={colors.primary} /> : null}
            </View>
          </GalleryHeader>
        }
      />
    </View>
  );
}
