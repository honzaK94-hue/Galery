import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import Feather from "@expo/vector-icons/Feather";
import { router, Tabs, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGallery } from "@/components/GalleryProvider";

function BottomNavigation() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { selectionActive } = useGallery();
  if (selectionActive) return null;
  const destinations = [
    { path: "/" as const, icon: "image" as const, label: "Fotky" },
    { path: "/videos" as const, icon: "video" as const, label: "Videa" },
    { path: "/albums" as const, icon: "folder" as const, label: "Alba" },
    { path: "/more" as const, icon: "more-horizontal" as const, label: "Více" },
  ];
  return (
    <View
      pointerEvents="box-none"
      style={[styles.position, { bottom: Math.max(insets.bottom, 8) + 6 }]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background + "F5",
            borderColor: colors.border,
          },
        ]}
      >
        {destinations.map(({ path, icon, label }) => {
          const active =
            path === "/"
              ? pathname === "/" || pathname === "/(tabs)"
              : pathname.startsWith(path);
          return (
            <Pressable
              key={path}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              testID={`nav-${label}`}
              onPress={() => router.navigate(path)}
              style={({ pressed }) => [
                styles.item,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <View
                style={[
                  styles.highlight,
                  active && {
                    backgroundColor: colors.accent,
                    borderColor: colors.primary + "65",
                    borderWidth: 1,
                    shadowColor: colors.primary,
                    shadowOpacity: 0.35,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 6,
                  },
                ]}
              >
                <Feather
                  name={icon}
                  size={21}
                  color={active ? colors.primary : colors.mutedForeground}
                />
              </View>
              <Text
                style={{
                  color: active ? colors.foreground : colors.mutedForeground,
                  fontSize: 11,
                  fontWeight: active ? "700" : "400",
                  marginTop: 3,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
export default function TabLayout() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="videos" />
        <Tabs.Screen name="albums" />
        <Tabs.Screen name="more" />
      </Tabs>
      <BottomNavigation />
    </View>
  );
}
const styles = StyleSheet.create({
  position: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 100,
  },
  container: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 520,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 5,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
  },
  item: { flex: 1, alignItems: "center", minHeight: 54 },
  highlight: {
    width: 48,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
});
