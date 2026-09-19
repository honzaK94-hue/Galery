import React from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { GalleryHeader } from "@/components/GalleryHeader";
export default function HelpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const sections = [
    [
      "Časová osa",
      "Fotky se řadí podle data pořízení. Nadpisy Dnes, Včera, měsíců a let pouze rozdělují seznam. Žádné datum vaše fotografie nefiltruje. Hustotu změníte ve Více → Zobrazení.",
    ],
    [
      "Výběr a alba",
      "Podržte fotografii nebo video, další položky označíte klepnutím. Vybrat vše projde celý aktuální seznam, včetně dosud nenačtených stránek. Vlastní alba sdružují média bez vytváření kopií souborů.",
    ],
    [
      "Skryté položky a alba",
      "Více → Skryté nabízí položky i alba. Přidáním média do skrytého alba se médium skryje v běžných seznamech Galerie. Smazání skrytého alba zachová soubory i jejich skrytí. Obnovení média odstraní jeho členství ve skrytých albech a vrátí jej do běžných pohledů. Skrytí není šifrování a neplatí pro jiné aplikace.",
    ],
    [
      "Koš a mazání",
      "Do koše přesune médium pouze uvnitř Galerie a lze jej obnovit. Smazat z telefonu je trvalá akce s potvrzením. Smazání vlastního alba nebo odebrání média z alba nikdy nemaže soubor v telefonu.",
    ],
    [
      "Prohlížeč",
      "Dvěma prsty nebo dvojitým klepnutím přiblížíte fotografii. Přiblížený snímek lze posouvat. Při oddálení přejedete na sousední médium. Android Back nejprve zruší přiblížení nebo informace. Video má vlastní přehrávání, posun a celou obrazovku.",
    ],
    [
      "Sdílení a přístup",
      "Sdílet lze fotografii i video v prohlížeči nebo jednu vybranou položku v seznamu. Po změně oprávnění v nastavení telefonu Galerie znovu zkontroluje dostupná média.",
    ],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GalleryHeader title="Nápověda" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 24,
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {sections.map(([title, body]) => (
          <View key={title} style={{ marginBottom: 26 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 19,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                lineHeight: 23,
                fontSize: 14,
              }}
            >
              {body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
