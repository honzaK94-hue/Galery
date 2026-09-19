import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { clearVideoThumbnailCache } from "@/components/MediaThumbnail";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { GalleryHeader } from "@/components/GalleryHeader";
import { MenuCard } from "@/components/MenuCard";
import { useGallery } from "@/components/GalleryProvider";
import {
  useGalleryPreferences,
  densityLabels,
  sortLabels,
} from "@/components/GalleryPreferences";
import {
  PreferenceSheet,
  type PreferenceKind,
} from "@/components/PreferenceSheet";
import { useVault } from "@/components/VaultProvider";
import { ensureDatabaseReady } from "@/db";
import {
  exportAlbumBackup,
  importAlbumBackup,
  MAX_ALBUM_BACKUP_BYTES,
} from "@/db/backup";

function confirm(
  title: string,
  message: string,
  label: string,
): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: "Zrušit", style: "cancel", onPress: () => resolve(false) },
        { text: label, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const gallery = useGallery();
  const prefs = useGalleryPreferences();
  const vault = useVault();
  const [sheet, setSheet] = useState<PreferenceKind | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const working = useRef(false);
  const run = async (label: string, work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(label);
    try {
      await work();
    } catch (error) {
      Alert.alert(
        "Akce se nezdařila",
        error instanceof Error ? error.message : "Zkuste to znovu.",
      );
    } finally {
      working.current = false;
      setBusy(null);
    }
  };
  const permissionAction = () =>
    void run("Oprávnění", async () => {
      if (
        gallery.permission?.canAskAgain &&
        !gallery.permission.granted &&
        gallery.permission.accessPrivileges !== "limited"
      )
        await gallery.requestPermission();
      else if (gallery.permission?.accessPrivileges === "limited")
        await gallery.chooseMedia();
      else await Linking.openSettings();
    });
  const exportBackup = () =>
    void run("Export zálohy", async () => {
      if (
        !(await confirm(
          "Exportovat zálohu alb?",
          "Záloha obsahuje názvy alb, přiřazení médií, skrytý stav a nastavení. Není šifrovaná a neobsahuje samotné fotografie ani videa. Uložte ji na bezpečné místo.",
          "Pokračovat",
        ))
      )
        return;
      const directory =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!directory.granted) return;
      if (!(await vault.unlock()) || !vault.canAccess()) return;
      const backup = await exportAlbumBackup(await ensureDatabaseReady());
      if (!vault.canAccess()) return;
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(
        directory.directoryUri,
        "Galerie-" + new Date().toISOString().slice(0, 10) + ".json",
        "application/json",
      );
      if (!vault.canAccess()) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        return;
      }
      try {
        await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup));
      } catch (error) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        throw error;
      }
      Alert.alert(
        "Záloha uložená",
        "Alba a nastavení jsou uložené ve vybrané složce.",
      );
    });
  const importBackup = () =>
    void run("Import zálohy", async () => {
      const selected = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain", "application/octet-stream"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selected.canceled) return;
      const file = selected.assets[0];
      try {
        if ((file.size ?? 0) > MAX_ALBUM_BACKUP_BYTES)
          throw new Error("Záloha je příliš velká (maximum 32 MB).");
        if (!(await vault.unlock())) return;
        const text = await FileSystem.readAsStringAsync(file.uri);
        if (text.length > MAX_ALBUM_BACKUP_BYTES)
          throw new Error("Záloha je příliš velká.");
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Soubor není platná záloha JSON.");
        }
        if (
          !(await confirm(
            "Obnovit alba a nastavení?",
            "Existující alba ani soubory se nesmažou. Obnoví se vazby a skrytý stav. Média musí být dostupná pod stejnými identifikátory v tomto telefonu; záloha nekopíruje originální soubory. Zabezpečení zůstane beze změny.",
            "Obnovit",
          ))
        )
          return;
        if (!vault.canAccess()) return;
        const result = await importAlbumBackup(
          await ensureDatabaseReady(),
          data,
        );
        const s = result.settings;
        if (s.sort) prefs.setSort(s.sort as typeof prefs.sort);
        if (s.density) prefs.setDensity(s.density as typeof prefs.density);
        if (s.appearance)
          prefs.setAppearance(s.appearance as typeof prefs.appearance);
        if (s.thumbnailQuality)
          prefs.setThumbnailQuality(
            s.thumbnailQuality as typeof prefs.thumbnailQuality,
          );
        if (s.swipeEnabled) prefs.setSwipeEnabled(s.swipeEnabled === "true");
        if (s.doubleTapEnabled)
          prefs.setDoubleTapEnabled(s.doubleTapEnabled === "true");
        if (s.videoAutoplay) prefs.setVideoAutoplay(s.videoAutoplay === "true");
        await gallery.refreshPermission();
        Alert.alert(
          "Záloha obnovená",
          "Alba: " +
            result.albums +
            "\nMédia: " +
            result.media +
            "\nDostupnost souborů se znovu ověří.",
        );
      } finally {
        if (
          FileSystem.cacheDirectory &&
          file.uri.startsWith(FileSystem.cacheDirectory)
        )
          await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(
            () => {},
          );
      }
    });
  const clearCache = () =>
    void run("Čištění náhledů", async () => {
      if (
        !(await confirm(
          "Vyčistit náhledy?",
          "Fotografie, videa a alba zůstanou zachované. Náhledy se znovu načtou.",
          "Vyčistit",
        ))
      )
        return;
      clearVideoThumbnailCache();
      const results = await Promise.all([
        Image.clearMemoryCache(),
        Image.clearDiskCache(),
      ]);
      if (results.some((result) => result === false))
        throw new Error("Část cache se nepodařilo vyčistit. Zkuste to znovu.");
      gallery.refreshLibrary();
      Alert.alert("Náhledy vyčištěné");
    });
  const restorePreferences = () =>
    void run("Obnovení nastavení", async () => {
      if (
        !(await confirm(
          "Obnovit výchozí zobrazení?",
          "Obnoví se vzhled, řazení, hustota, náhledy a gesta. Alba, skrytí, koš a zámek zůstanou zachované.",
          "Obnovit",
        ))
      )
        return;
      prefs.setAppearance("dark");
      prefs.setSort("newest");
      prefs.setDensity("comfortable");
      prefs.setThumbnailQuality("high");
      prefs.setSwipeEnabled(true);
      prefs.setDoubleTapEnabled(true);
      prefs.setVideoAutoplay(false);
    });
  const enabled = (value: boolean) => (value ? "Zapnuto" : "Vypnuto");
  const access =
    gallery.permission?.accessPrivileges === "limited"
      ? "Vybraná média"
      : gallery.permission?.granted
        ? "Povoleno"
        : "Nepovoleno";
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
        {busy ? (
          <View style={{ flexDirection: "row", gap: 12, padding: 12 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.foreground }}>{busy}…</Text>
          </View>
        ) : null}
        <MenuCard
          title="Vzhled"
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
              label: "Třídit podle",
              icon: "sliders",
              value: sortLabels[prefs.sort],
              onPress: () => setSheet("sort"),
            },
            {
              label: "Kvalita náhledů",
              icon: "image",
              value: prefs.thumbnailQuality === "high" ? "Vysoká" : "Úsporná",
              onPress: () => setSheet("quality"),
            },
          ]}
        />
        <MenuCard
          title="Gesta a přehrávání"
          items={[
            {
              label: "Dvojité klepnutí pro zoom",
              icon: "maximize",
              value: enabled(prefs.doubleTapEnabled),
              onPress: () => prefs.setDoubleTapEnabled(!prefs.doubleTapEnabled),
            },
            {
              label: "Přejetí mezi médii",
              icon: "move",
              value: enabled(prefs.swipeEnabled),
              description: "Při vypnutí se zobrazí tlačítka Předchozí / Další",
              onPress: () => prefs.setSwipeEnabled(!prefs.swipeEnabled),
            },
            {
              label: "Automaticky přehrát video",
              icon: "play-circle",
              value: enabled(prefs.videoAutoplay),
              onPress: () => prefs.setVideoAutoplay(!prefs.videoAutoplay),
            },
          ]}
        />
        <MenuCard
          title="Zabezpečení skrytých položek"
          items={[
            {
              label: "Biometrie / zámek telefonu",
              icon: "shield",
              value: enabled(vault.enabled),
              description: "Otisk prstu nebo PIN, gesto či heslo telefonu",
              onPress: () =>
                void run("Změna zámku", async () => {
                  await vault.setEnabled(!vault.enabled);
                }),
            },
            {
              label: "Zamknout skryté nyní",
              icon: "lock",
              value: !vault.enabled
                ? "Zámek je vypnutý"
                : vault.unlocked
                  ? "Odemčeno"
                  : "Zamčeno",
              onPress: () => {
                vault.lock();
                if (!vault.enabled)
                  Alert.alert(
                    "Zámek je vypnutý",
                    "Nejdřív zapněte biometrii / zámek telefonu.",
                  );
              },
            },
            {
              label: "Zabezpečení telefonu",
              icon: "key",
              description: "Nastavení otisku prstu a zámku obrazovky",
              onPress: () => void vault.openSecuritySettings(),
            },
          ]}
        />
        {vault.error ? (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.destructive, marginBottom: 16 }}
          >
            {vault.error}
          </Text>
        ) : null}
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
              description:
                gallery.error ??
                (gallery.ready
                  ? "Knihovna je připravená"
                  : "Ověřování dostupnosti médií"),
              onPress: () =>
                void run("Obnova knihovny", gallery.refreshPermission),
            },
            {
              label: "Koš",
              icon: "trash-2",
              description: "Systémový koš, obnova a trvalé smazání",
              onPress: () => router.push("/trash"),
            },
            {
              label: "Vyčistit náhledy",
              icon: "hard-drive",
              description: "Uvolnit cache bez smazání fotografií",
              onPress: clearCache,
            },
          ]}
        />
        <MenuCard
          title="Záloha alb a nastavení"
          items={[
            {
              label: "Exportovat zálohu",
              icon: "download",
              description: "Uložit JSON do vybrané složky v telefonu",
              onPress: exportBackup,
            },
            {
              label: "Importovat zálohu",
              icon: "upload",
              description: "Obnovit alba, vazby, skrytí a nastavení",
              onPress: importBackup,
            },
            {
              label: "Obnovit výchozí zobrazení",
              icon: "rotate-ccw",
              onPress: restorePreferences,
            },
          ]}
        />
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            lineHeight: 19,
          }}
        >
          Zámek chrání skrytou část této aplikace a blokuje její snímání
          obrazovky. Originály nejsou šifrované. Záloha neobsahuje samotné
          fotografie ani videa. Galerie 1.1.0.
        </Text>
      </ScrollView>
      <PreferenceSheet kind={sheet} onClose={() => setSheet(null)} />
    </View>
  );
}
