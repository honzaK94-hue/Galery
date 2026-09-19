import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import { GalleryHeader } from "@/components/GalleryHeader";

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 620 && fontScale <= 1.2;
  const version = Constants.expoConfig?.version;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GalleryHeader title="O aplikaci" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[colors.accent + "A0", colors.card]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.icon}
            accessibilityLabel="Ikona Galerie"
          />
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.foreground }]}
          >
            Galerie
          </Text>
          <Text style={[styles.tagline, { color: colors.foreground }]}>
            Tvé fotky. Jak to má být.
          </Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            Fotografie, videa a vzpomínky z vašeho telefonu. Přehledně
            uspořádané ve vašich albech.
          </Text>
          {version ? (
            <View
              style={[
                styles.version,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                Verze {version}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionHeading}>
          <Text
            accessibilityRole="header"
            style={[styles.heading, { color: colors.foreground }]}
          >
            Za aplikací stojí
          </Text>
          <Text style={[styles.caption, { color: colors.mutedForeground }]}>
            Podíl na vzniku a dopracování Galerie
          </Text>
        </View>
        <View
          style={[styles.proportions, { backgroundColor: colors.border }]}
          accessible
          accessibilityLabel="Mister puppy - Dark: 95 procent. puppy Shiny: 5 procent."
        >
          <View style={{ flex: 95, backgroundColor: colors.primary }} />
          <View style={{ flex: 5, backgroundColor: colors.mutedForeground }} />
        </View>

        <View style={{ flexDirection: wide ? "row" : "column", gap: 14 }}>
          <View
            style={[
              styles.credit,
              {
                flex: wide ? 1 : undefined,
                backgroundColor: colors.card,
                borderColor: colors.primary,
              },
            ]}
          >
            <View style={styles.creditTop}>
              <View
                style={[styles.creditIcon, { backgroundColor: colors.accent }]}
              >
                <Feather name="code" size={21} color={colors.primary} />
              </View>
              <Text style={[styles.percent, { color: colors.primary }]}>
                95 %
              </Text>
            </View>
            <Text style={[styles.role, { color: colors.primary }]}>
              VÝVOJ A DOPRACOVÁNÍ
            </Text>
            <Text style={[styles.name, { color: colors.foreground }]}>
              Mister puppy - Dark
            </Text>
            <Text
              style={[
                styles.creditDescription,
                { color: colors.mutedForeground },
              ]}
            >
              Kompletní dopracování aplikace, spousta vloženého úsilí, výpočetní
              výkon a profesionální programátorské zkušenosti.
            </Text>
          </View>
          <View
            style={[
              styles.credit,
              {
                flex: wide ? 1 : undefined,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.creditTop}>
              <View
                style={[
                  styles.creditIcon,
                  { backgroundColor: colors.background },
                ]}
              >
                <Feather name="sun" size={21} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.percent, { color: colors.foreground }]}>
                5 %
              </Text>
            </View>
            <Text style={[styles.role, { color: colors.mutedForeground }]}>
              NÁPAD A INSPIRACE
            </Text>
            <Text style={[styles.name, { color: colors.foreground }]}>
              puppy Shiny
            </Text>
            <Text
              style={[
                styles.creditDescription,
                { color: colors.mutedForeground },
              ]}
            >
              Obecný nápad a prvotní inspirace pro vznik aplikace.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Feather name="smartphone" size={17} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Jen vaše média. Jen váš telefon.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  icon: { width: 80, height: 80, borderRadius: 22, marginBottom: 16 },
  title: {
    fontFamily: nativeTheme.fonts.bold,
    fontSize: 36,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: nativeTheme.fonts.medium,
    fontSize: 16,
    textAlign: "center",
    marginTop: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 400,
    marginTop: 14,
  },
  version: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 18,
  },
  sectionHeading: {
    marginTop: 28,
    marginBottom: 16,
    paddingHorizontal: 4,
    gap: 5,
  },
  heading: { fontFamily: nativeTheme.fonts.bold, fontSize: 21 },
  caption: { fontSize: 13, lineHeight: 20 },
  proportions: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 18,
  },
  credit: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
  },
  creditTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  creditIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  percent: {
    fontFamily: nativeTheme.fonts.bold,
    fontSize: 32,
    letterSpacing: -1,
  },
  role: {
    fontFamily: nativeTheme.fonts.medium,
    fontSize: 10,
    letterSpacing: 1,
    lineHeight: 16,
    marginBottom: 7,
  },
  name: { fontFamily: nativeTheme.fonts.bold, fontSize: 20, lineHeight: 28 },
  creditDescription: { fontSize: 14, lineHeight: 22, marginTop: 10 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 28,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
    textAlign: "center",
  },
});
