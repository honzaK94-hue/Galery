import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { GalleryHeader } from "@/components/GalleryHeader";
import { MenuCard } from "@/components/MenuCard";
import {
  PreferenceSheet,
  type PreferenceKind,
} from "@/components/PreferenceSheet";
import {
  useGalleryPreferences,
  densityLabels,
  sortLabels,
} from "@/components/GalleryPreferences";

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const prefs = useGalleryPreferences();
  const [sheet, setSheet] = useState<PreferenceKind | null>(null);
  const about = () =>
    Alert.alert(
      "Galerie",
      "Tvé fotky. Jak to má být.\n\nMístní fotografie, videa a vlastní alba. Vaše média se nikam nenahrávají. Skrytí a koš platí uvnitř této aplikace.",
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GalleryHeader
        title="Více"
        subtitle="Vaše galerie, podle vás"
        onSearch={() =>
          router.navigate({
            pathname: "/",
            params: { search: String(Date.now()) },
          })
        }
        onMenu={about}
      />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingTop: 4,
          paddingBottom: insets.bottom + 100,
          width: "100%",
          maxWidth: 720,
          alignSelf: "center",
        }}
      >
        <MenuCard
          items={[
            {
              label: "Skryté",
              icon: "lock",
              description: "Skryté položky a alba",
              onPress: () => router.push("/hidden"),
            },
            {
              label: "Koš",
              icon: "trash-2",
              description: "Obnovit nebo trvale smazat",
              onPress: () => router.push("/trash"),
            },
            {
              label: "Nastavení",
              icon: "settings",
              onPress: () => router.push("/settings"),
            },
          ]}
        />
        <MenuCard
          title="Knihovna"
          items={[
            {
              label: "Vybrat",
              icon: "check-circle",
              value: prefs.lastLibrary === "photos" ? "Fotky" : "Videa",
              onPress: () => {
                prefs.requestSelection(prefs.lastLibrary);
                router.navigate(
                  prefs.lastLibrary === "photos" ? "/" : "/videos",
                );
              },
            },
            {
              label: "Třídit podle",
              icon: "sliders",
              value: sortLabels[prefs.sort],
              onPress: () => setSheet("sort"),
            },
            {
              label: "Zobrazení",
              icon: "grid",
              value: densityLabels[prefs.density],
              onPress: () => setSheet("density"),
            },
          ]}
        />
        <MenuCard
          items={[
            {
              label: "Nápověda",
              icon: "help-circle",
              onPress: () => router.push("/help"),
            },
            { label: "O aplikaci", icon: "info", onPress: about },
          ]}
        />
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            textAlign: "center",
            marginTop: 2,
          }}
        >
          Jen vaše média. Jen váš telefon.
        </Text>
      </ScrollView>
      <PreferenceSheet kind={sheet} onClose={() => setSheet(null)} />
    </View>
  );
}
