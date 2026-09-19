import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { MediaGrid } from "@/components/MediaGrid";
import { MediaPermissionGate } from "@/components/MediaPermissionGate";
export default function HiddenScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <MediaPermissionGate requireIndex>
      <MediaGrid
        source={{ kind: "hidden" }}
        emptyText="Žádná skrytá média"
        header={
          <View
            style={{
              paddingTop: insets.top,
              paddingHorizontal: 16,
              backgroundColor: colors.background,
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={{ paddingVertical: 14 }}
            >
              <Text style={{ color: colors.primary }}>Zpět</Text>
            </Pressable>
            <Text style={{ color: colors.foreground, fontSize: 22 }}>
              Skrytá média
            </Text>
            <Text
              style={{ color: colors.mutedForeground, paddingVertical: 12 }}
            >
              Skryto pouze v Galerii. Soubory zůstávají dostupné ostatním
              aplikacím.
            </Text>
          </View>
        }
      />
    </MediaPermissionGate>
  );
}
