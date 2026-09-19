import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { MediaPermissionGate } from "@/components/MediaPermissionGate";
import { MediaGrid } from "@/components/MediaGrid";
import { GalleryHeader } from "@/components/GalleryHeader";
import { useGalleryPreferences } from "@/components/GalleryPreferences";
export default function TrashScreen() {
  const colors = useColors();
  const prefs = useGalleryPreferences();
  const [count, setCount] = useState<number | null>(null);
  return (
    <MediaPermissionGate requireIndex>
      <MediaGrid
        source={{ kind: "trash" }}
        sort={prefs.sort}
        density={prefs.density}
        onCountChange={setCount}
        emptyText="Koš je prázdný"
        header={
          <GalleryHeader
            title="Koš"
            subtitle={
              count === null ? "Prostor pro druhou šanci" : `${count} položek`
            }
            onBack={() => router.back()}
          >
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 16,
                padding: 14,
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
                Koš Galerie. Položky zde zůstávají, dokud je neobnovíte nebo
                trvale nesmažete z telefonu. Ostatní aplikace je mohou stále
                vidět.
              </Text>
            </View>
          </GalleryHeader>
        }
      />
    </MediaPermissionGate>
  );
}
