import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";

export function GalleryHeader({
  title,
  subtitle,
  onSearch,
  onMenu,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onSearch?: () => void;
  onMenu?: () => void;
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const icon = (
    name: React.ComponentProps<typeof Feather>["name"],
    label: string,
    action: () => void,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={action}
      style={({ pressed }) => [
        styles.icon,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Feather name={name} size={20} color={colors.foreground} />
    </Pressable>
  );
  return (
    <View
      style={{ paddingTop: insets.top + 8, backgroundColor: colors.background }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[colors.accent + "70", colors.background]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        {onBack ? icon("arrow-left", "Zpět", onBack) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: colors.foreground }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[styles.subtitle, { color: colors.mutedForeground }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onSearch ? icon("search", "Hledat", onSearch) : null}
        {icon(
          "more-vertical",
          "Více možností",
          onMenu ?? (() => router.navigate("/(tabs)/more")),
        )}
      </View>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  title: {
    fontFamily: nativeTheme.fonts.bold,
    fontSize: 26,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: nativeTheme.fonts.regular,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
