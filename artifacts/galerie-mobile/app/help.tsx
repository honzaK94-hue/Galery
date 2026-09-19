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
      "Do koše používá systémový koš Androidu. Položku můžete obnovit do vypršení lhůty; datum je uvedené v koši a informacích média. Starý místní koš lze převést tlačítkem Převést starý koš. Vysypat zobrazený koš trvale smaže pouze položky tohoto pohledu po potvrzení. Smazání alba ani odebrání člena nemaže originál.",
    ],
    [
      "Prohlížeč",
      "Dvěma prsty nebo dvojitým klepnutím přiblížíte fotografii. Přiblížený snímek lze posouvat. Při oddálení přejedete na sousední médium. Android Back nejprve zruší přiblížení nebo informace. Video má vlastní přehrávání, posun a celou obrazovku.",
    ],
    [
      "Sdílení a přístup",
      "Sdílet lze fotografii i video v prohlížeči a více vybraných položek přes systémovou nabídku Androidu. Po změně oprávnění v nastavení telefonu Galerie znovu zkontroluje dostupná média.",
    ],
    [
      "Oblíbené",
      "Srdíčko v prohlížeči přidá nebo odebere médium z oblíbených Androidu. Hromadně je změníte ve výběru. Seznam je v Albech i ve Více. Skrytá média se v běžném seznamu oblíbených nezobrazují. Některé jiné galerie používají vlastní oddělený seznam oblíbených.",
    ],
    [
      "Zabezpečení",
      "Skryté položky a alba odemknete otiskem prstu nebo PINem, gestem či heslem telefonu. Při opuštění aplikace se opět zamknou. Změnu zámku najdete v Nastavení; vypnutí vyžaduje ověření. Screenshoty skryté části jsou blokované. Originální soubory nejsou šifrované. Skrytá videa používají zabezpečený prohlížeč Galerie.",
    ],
    [
      "Nastavení a zálohy",
      "V Nastavení lze měnit vzhled, řazení, hustotu, kvalitu náhledů, dvojité klepnutí, swipe a automatické přehrávání videa. Export/Import uloží či obnoví alba, jejich členství, skrytý stav a nastavení. JSON záloha neobsahuje samotné fotografie ani videa a je určená pro stejné identifikátory médií v tomto telefonu. Zámek se importem nemění.",
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
