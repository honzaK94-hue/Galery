import React, { useState } from "react";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { clearVideoThumbnailCache } from "@/components/MediaThumbnail";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { GalleryHeader } from "@/components/GalleryHeader";
import { MenuCard } from "@/components/MenuCard";
import { useGallery } from "@/components/GalleryProvider";
import {
  useGalleryPreferences,
  densityLabels,
} from "@/components/GalleryPreferences";
import {
  PreferenceSheet,
  type PreferenceKind,
} from "@/components/PreferenceSheet";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const gallery = useGallery();
  const prefs = useGalleryPreferences();
  const [sheet, setSheet] = useState<PreferenceKind | null>(null);
  const access =
    gallery.permission?.accessPrivileges === "limited"
      ? "Vybraná média"
      : gallery.permission?.granted
        ? "Povoleno"
        : "Nepovoleno";
  const permissionAction = () => {
    if (
      gallery.permission?.canAskAgain &&
      !gallery.permission.granted &&
      gallery.permission.accessPrivileges !== "limited"
    )
      void gallery.requestPermission();
    else if (gallery.permission?.accessPrivileges === "limited")
      void gallery.chooseMedia();
    else
      void Linking.openSettings().catch(() =>
        Alert.alert(
          "Nastavení nelze otevřít",
          "Otevřete oprávnění Galerie v nastavení telefonu.",
        ),
      );
  };
  const clearCache = () =>
    Alert.alert(
      "Vyčistit náhledy?",
      "Fotografie, videa a alba zůstanou zachované. Náhledy se při dalším zobrazení znovu načtou.",
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Vyčistit",
          onPress: async () => {
            try {
              clearVideoThumbnailCache();
              await Promise.all([
                Image.clearMemoryCache(),
                Image.clearDiskCache(),
              ]);
              gallery.refreshLibrary();
              Alert.alert("Náhledy vyčištěné");
            } catch {
              Alert.alert("Náhledy se nepodařilo vyčistit", "Zkuste to znovu.");
            }
          },
        },
      ],
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GalleryHeader
        title="Nastavení"
        onBack={() => router.back()}
        onMenu={() => router.navigate("/more")}
      />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
          width: "100%",
          maxWidth: 720,
          alignSelf: "center",
        }}
      >
        <MenuCard
          title="Vzhled a ovládání"
          items={[
            {
              label: "Vzhled",
              icon: "moon",
              value: {
                dark: "Tmavý",
                light: "Světlý",
                system: "Podle telefonu",
              }[prefs.appearance],
              onPress: () => setSheet("appearance"),
            },
            {
              label: "Hustota mřížky",
              icon: "grid",
              value: densityLabels[prefs.density],
              onPress: () => setSheet("density"),
            },
            {
              label: "Gesta",
              icon: "move",
              description: "Přiblížení, přejetí a výběr",
              onPress: () => router.push("/help"),
            },
          ]}
        />
        <MenuCard
          title="Přístup a úložiště"
          items={[
            {
              label: "Oprávnění k médiím",
              icon: "shield",
              value: access,
              onPress: permissionAction,
            },
            {
              label: "Obnovit knihovnu",
              icon: "refresh-cw",
              description: "Znovu ověřit přístup a dostupnost souborů",
              onPress: () => {
                void gallery.refreshPermission();
                Alert.alert(
                  "Obnova knihovny",
                  "Dostupnost médií se znovu kontroluje.",
                );
              },
            },
            {
              label: "Vyčistit náhledy",
              icon: "hard-drive",
              description: "Uvolnit cache bez smazání fotografií",
              onPress: clearCache,
            },
          ]}
        />
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 13,
            lineHeight: 20,
          }}
        >
          Skrytá alba a koš spravuje Galerie místně. Soubory mohou být stále
          dostupné ostatním aplikacím. Odinstalace Galerie odstraní její vlastní
          alba a nastavení.
        </Text>
      </ScrollView>
      <PreferenceSheet kind={sheet} onClose={() => setSheet(null)} />
    </View>
  );
}
