# Galerie 1.1.0 — stav implementace

19. 9. 2026. Dokončení biometrie, systémového koše, oblíbených, hromadného sdílení
             a funkčních položek nastavení nad existující aplikací. Bez změny architektury
             vlastních SQLite alb, bez nového serveru. Předchozí redesign a čtyři záložky zachovány.

## Implementováno v tomto kroku

- Biometrický zámek skrytých položek/alb s náhradním PINem, gestem nebo heslem telefonu.
  Výchozí zapnutí, opětovné zamčení v pozadí a po restartu, ověření před vypnutím.
  Ošetřené zrušení ověření, chybějící zámek telefonu a přechody systémového dialogu.
- Ochrana skrytých tras, prohlížeče, vytváření a výběru skrytých alb před načtením
  soukromého obsahu. Blokování snímání obrazovky; bezpečný fullscreen skrytého videa.
- Nativní modul `galerie-device`: MediaStore koš, obnova, trvalé mazání, oblíbené,
  skutečná expirace, stránkování a sdílení originálních obsahových URI více souborů.
  Operace respektují systémový souhlas, zrušení a částečně dokončené dávky.
- Zachování vztahů a skrytého stavu při přesunu do koše i obnově. Úklid SQLite až
  po ověřeném odstranění; pozastavení synchronizačního úklidu během systémové operace.
  Starý místní koš zachován a lze jej převést do systémového koše.
- Skryté položky jsou filtrované také ze systémových oblíbených a koše, včetně
  fallback cesty bez nativního modulu. Soukromou část koše lze výslovně odemknout.
- Oblíbené v prohlížeči, výběru, nabídce Více a na obrazovce alb; vícečetné sdílení.
- Nastavení vzhledu, hustoty, řazení, kvality náhledů, dvojitého klepnutí, přejetí
  a automatického přehrávání skutečně mění aplikaci a ukládá se. Při vypnutí přejetí
  fungují tlačítka Předchozí / Další. Video náhledy mají omezenou paměťovou cache.
- Funkční nastavení zámku, okamžité zamčení, zabezpečení telefonu, oprávnění,
  obnova knihovny, koš, vyčištění náhledů a obnovení výchozího zobrazení.
- Export/import alb, vazeb, skrytého stavu a běžných nastavení do JSON přes systémový
  výběr souboru/složky. Validace, limit velikosti, transakční import, opakovaný import
  bez duplikování již importovaných alb, zachování místních dat a zabezpečení.
- Verze zvýšena na 1.1.0 / Android versionCode 2. Samostatný EAS profil `preview`
  zachován (`developmentClient: false`, `android.buildType: apk`).

## Původní audit a fáze

Původní opravy oprávnění, návratu z Android Settings, routování ID, návratu z nativního
alba, duplicit, počtů/obalů, chybějících médií a datové konzistence jsou zachované.
Fáze 5, 6, 7 a 8 jsou implementované; nově jsou doplněné také biometrie a systémové
operace výše. Fáze 9: stránkování, virtualizace, omezené náhledy/cache a adaptivní
rozložení jsou implementované; výkon velké knihovny a oba displeje Foldu potřebují
fyzické ověření. Tento report neoznačuje všechna zařízení a scénáře za otestované.

## Databáze a závislosti

Databáze zůstává `galerie.db`, se stejnými tabulkami `albums`, `media_items`,
`media_albums`, `app_settings`. Migrace na **user_version 3** přidává `native_trashed`
k dosavadnímu `trashed_at`, aby rozlišila skutečný a původní místní koš. Migrace
zachovává existující alba, vztahy, skrytý stav a nastavení. `app_settings` ukládá
zámek, nové preference, identitu zálohy a mapování importovaných alb. Import nesmí
zálohou měnit zámek ani nativní stav koše.

Přidané přímé závislosti:

- `expo-local-authentication ~57.0.3`
- `expo-screen-capture ~57.0.3`
- `expo-document-picker ~57.0.2`

Přidaný místní nativní modul je v `modules/galerie-device`. Používá API exportované
balíčkem `expo`; `expo-modules-core` zůstává jen jeho tranzitivní závislostí.
Žádná původní přímá závislost nebyla odstraněna. Expo SDK 57, React Native 0.86.3
a React 19.2.3 zůstávají; změněný pnpm lockfile je součástí commitu.

## Provedené kontroly

- TypeScript mobilní aplikace: **prošel**.
- Rychlá datová sada: **34/34 prošlo**, pod jednu sekundu. Obsahuje skutečnou SQLite,
  migrace, restart databáze, skrytá alba, koš, konzistenci vztahů, stránkování,
  částečné/zrušené nativní operace a bezpečný opakovaný import záloh.
- Android produkční export: **prošel**, 1 909 modulů, 31 assetů, Hermes přibližně 4,7 MB.
  Výstup `.expo/validation-export` je ignorovaný a není APK.
- Nový Android modul: **skutečná Kotlin kompilace prošla**,
  `:galerie-device:compileReleaseKotlin`, Android SDK 36 / Expo 57 / RN 0.86.3.
  Autolinking modul rozpoznává. Kontrola proběhla v izolované ignorované kopii,
  bez přidání vygenerovaného Android projektu nebo SDK do repozitáře.
- Expo Doctor: **21/21, bez problémů**.
- `eas whoami`: **Not logged in**. Nová podepsaná APK na EAS zatím nevytvořena;
  sestavení vyžaduje účet s přístupem k projektu týmu `shiny94s-team`.

## Známé hranice a fyzické ověření

Není připojený Samsung Galaxy Z Fold 8. Implementace, TypeScript, datové testy,
JavaScript export a kompilace modulu nenahrazují běh výsledné APK na telefonu.
Zbývá ověřit:

- Start nové APK, povolení/odmítnutí/omezení přístupu a změny v Android Settings.
- Otisk prstu, PIN, zrušení ověření, opětovné zamčení, ochranu snímků a náhledu
  v posledních aplikacích, přehrávání skrytého videa přes celou obrazovku.
- Systémové potvrzení koše, obnovu, expiraci, trvalé mazání, oblíbené a sdílení
  jedné/více položek do skutečných cílových aplikací.
- Otevření médií, videa, zoom, swipe/alternativní tlačítka, Android Back, nativní
  alba, vlastní i skrytá alba a aktualizaci počtů/obalů po operacích.
- Nastavení po restartu, systémový výběr zálohy, export/import na telefonu,
  velkou skutečnou knihovnu, cover/inner displej, otočení a otevření/zavření Foldu.

Zámek chrání skrytou část Galerie, **nešifruje originály** před jinými oprávněnými
aplikacemi. Záloha je nešifrovaná, neobsahuje samotné fotografie/videa a používá
identifikátory médií stejného telefonu. Samsung může pro oblíbené nebo svou aplikaci
koše používat i vlastní evidenci; zde se používá Android MediaStore. Uchování
systémového koše určuje OS, nikoli vlastní časovač Galerie.

Řazení podle názvu prochází metadata zdroje, nikoli plné obrázky. Při omezeném
přístupu zůstávají metadata nepřístupných médií zachovaná do úplného ověření.

Příkaz pro samostatnou APK z `artifacts/galerie-mobile`:

```sh
npx eas-cli@latest build --platform android --profile preview
```

## Změněné soubory

<!-- changed-files -->

- `artifacts/galerie-mobile/app.json`
- `artifacts/galerie-mobile/app/(tabs)/albums.tsx`
- `artifacts/galerie-mobile/app/(tabs)/more.tsx`
- `artifacts/galerie-mobile/app/_layout.tsx`
- `artifacts/galerie-mobile/app/album/[id].tsx`
- `artifacts/galerie-mobile/app/favorites.tsx`
- `artifacts/galerie-mobile/app/help.tsx`
- `artifacts/galerie-mobile/app/hidden.tsx`
- `artifacts/galerie-mobile/app/media/[id].tsx`
- `artifacts/galerie-mobile/app/settings.tsx`
- `artifacts/galerie-mobile/app/trash.tsx`
- `artifacts/galerie-mobile/components/AddToAlbumModal.tsx`
- `artifacts/galerie-mobile/components/CreateAlbumModal.tsx`
- `artifacts/galerie-mobile/components/GalleryPreferences.tsx`
- `artifacts/galerie-mobile/components/GalleryProvider.tsx`
- `artifacts/galerie-mobile/components/MediaGrid.tsx`
- `artifacts/galerie-mobile/components/MediaThumbnail.tsx`
- `artifacts/galerie-mobile/components/PreferenceSheet.tsx`
- `artifacts/galerie-mobile/components/VaultGate.tsx`
- `artifacts/galerie-mobile/components/VaultProvider.tsx`
- `artifacts/galerie-mobile/components/VideoPlayer.tsx`
- `artifacts/galerie-mobile/components/ZoomablePhoto.tsx`
- `artifacts/galerie-mobile/db/backup.ts`
- `artifacts/galerie-mobile/db/schema.ts`
- `artifacts/galerie-mobile/db/stores/media-store.ts`
- `artifacts/galerie-mobile/lib/media.ts`
- `artifacts/galerie-mobile/lib/media-actions.ts`
- `artifacts/galerie-mobile/lib/media-operation.ts`
- `artifacts/galerie-mobile/lib/viewer-session.ts`
- `artifacts/galerie-mobile/modules/galerie-device/android/build.gradle`
- `artifacts/galerie-mobile/modules/galerie-device/android/src/main/AndroidManifest.xml`
- `artifacts/galerie-mobile/modules/galerie-device/android/src/main/java/expo/modules/galeriedevice/GalerieDeviceModule.kt`
- `artifacts/galerie-mobile/modules/galerie-device/expo-module.config.json`
- `artifacts/galerie-mobile/modules/galerie-device/index.ts`
- `artifacts/galerie-mobile/package.json`
- `artifacts/galerie-mobile/tests/backup.test.cjs`
- `artifacts/galerie-mobile/tests/library.test.cjs`
- `artifacts/galerie-mobile/tests/media-actions.test.cjs`
- `artifacts/galerie-mobile/tests/media-pages.test.cjs`
- `pnpm-lock.yaml`
- `README.md`
- `VERIFICATION.md`
