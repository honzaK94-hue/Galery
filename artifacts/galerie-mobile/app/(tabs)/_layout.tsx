import React from "react";
import { LogBox, Platform, Pressable, StyleSheet, View } from "react-native";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import Feather from "@expo/vector-icons/Feather";
import { router, Tabs, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import { useGallery } from "@/components/GalleryProvider";
import { isExpoGo } from "@/components/DevelopmentBuildRequired";

if (isExpoGo) {
  LogBox.ignoreLogs([
    "Due to changes in Androids permission requirements, Expo Go can no longer provide full access to the media library.",
  ]);
}

// Overlay nav: three icon-only controls, no background, no text labels.
// Active state uses primary fill; inactive is fully transparent — no container at all.
function OverlayNav() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { selectionActive } = useGallery();
  if (selectionActive) return null;

  const isActive = (path: string) => {
    if (path === "/")
      return (
        pathname === "/" ||
        pathname === "/(tabs)" ||
        pathname === "/(tabs)/index"
      );
    return pathname.startsWith(path);
  };

  const navigate = (path: "/" | "/albums" | "/videos") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.navigate(path);
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const navIcon = (
    path: string,
    name: "grid" | "book-open" | "video",
    label: string,
  ) => {
    const active = isActive(path);
    return (
      <Pressable
        testID={`nav-${name}`}
        onPress={() => navigate(path as "/" | "/albums" | "/videos")}
        style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
      >
        {/* Active: filled primary pill. Inactive: bare icon only, no background. */}
        {active ? (
          <View
            style={[styles.navIconActive, { backgroundColor: colors.primary }]}
          >
            <Feather name={name} size={20} color={colors.primaryForeground} />
          </View>
        ) : (
          <View
            style={[
              styles.navIconInactive,
              {
                backgroundColor: colors.background + "E6",
                borderRadius: nativeTheme.radius,
              },
            ]}
          >
            <Feather name={name} size={24} color={colors.foreground} />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.overlayNav, { bottom: bottomPad + 8 }]}
      pointerEvents="box-none"
    >
      {navIcon("/", "grid", "Záběry")}
      {navIcon("/albums", "book-open", "Alba")}
      {navIcon("/videos", "video", "Videa")}
    </View>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="albums" />
        <Tabs.Screen name="videos" />
      </Tabs>
      <OverlayNav />
    </View>
  );
}

const styles = StyleSheet.create({
  overlayNav: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    zIndex: 100,
    pointerEvents: "box-none",
  },
  navBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Active: compact filled pill using primary
  navIconActive: {
    width: 52,
    height: 44,
    borderRadius: nativeTheme.radius,
    alignItems: "center",
    justifyContent: "center",
  },
  // Inactive: no background, no border — bare icon only
  navIconInactive: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
