import React from "react";
import { Platform, Pressable, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { DeviceOnly } from "./DeviceOnly";
import { DevelopmentBuildRequired, isExpoGo } from "./DevelopmentBuildRequired";
import { MediaPermissionGate } from "./MediaPermissionGate";
import { MediaGrid } from "./MediaGrid";

export function LibraryScreen({ kind }: { kind: "photos" | "videos" }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  if (Platform.OS === "web") return <DeviceOnly />;
  if (isExpoGo) return <DevelopmentBuildRequired />;
  return (
    <MediaPermissionGate>
      <MediaGrid
        source={{ kind }}
        bottomTabs
        emptyText={kind === "photos" ? "Žádné fotografie" : "Žádná videa"}
        header={
          <View
            style={{
              paddingTop: insets.top,
              height: insets.top + 48,
              alignItems: "flex-end",
              backgroundColor: colors.background,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nastavení"
              testID="btn-settings"
              onPress={() => router.push("/settings")}
              style={{ padding: 12, marginRight: 8 }}
            >
              <Feather name="settings" size={24} color={colors.foreground} />
            </Pressable>
          </View>
        }
      />
    </MediaPermissionGate>
  );
}
