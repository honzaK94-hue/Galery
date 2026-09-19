# Galerie — stav implementace

19. 9. 2026. Rozsah: dokončení funkcí a vizuální redesign podle nového zadání.
             Předchozí zákaz fáze 10 byl tímto zadáním nahrazen.

## Implementováno

- Čtyři spodní záložky Fotky / Videa / Alba / Více, modré aktivní zvýraznění,
  tmavě modré plochy, zaoblené karty a společná hlavička hledání/menu.
- Souvislá fotografická časová osa s nadpisy dnů, měsíců a let; žádné datumové
  filtrování. Řazení podle data/názvu, hledání podle názvu a tři hustoty zobrazení.
  Média bez data pořízení se podle náhradního data slučují do správného místa
  napříč stránkami. Prohlížeč po skrytí/mazání nepřeskakuje další položky.
- Responzivní foto mřížka, výchozí 4 sloupce na širším displeji, 2 sloupce videí.
  Rozměry video náhledů podle fyzických pixelů, jeden dekodér, cache do 32 MiB.
  Fotografie se dekódují do velikosti zobrazení.
- Oddělená systémová a vlastní alba, obaly, počty, hledání, vytvoření,
  přejmenování a bezpečné smazání. Obnovení seznamů po změnách.
- Skryté → Položky / Alba, kompletní normální/skrytá alba ve společné SQLite.
  Přidání do skrytého alba skryje médium; odebrání nebo smazání alba zachová soubor.
  Obnova média odstraní skryté členství, zachová běžné členství.
- Funkční místní koš Galerie s obnovou. Trvalé mazání z telefonu zůstává
  samostatnou potvrzovanou akcí; SQLite vazby se čistí po úspěšném mazání.
- Více: Skryté, Koš, Nastavení, Vybrat, Třídit, Zobrazení, Nápověda, O aplikaci.
  Ukládání vzhledu, hustoty a řazení; správa oprávnění a vyčištění cache.
- Upravená lišta prohlížeče; zachovaný zoom, swipe, metadata a fungující video.
  Výběr, Vybrat vše, oprávnění, zvláštní znaky v ID a bezpečné nativní mazání
  zůstávají zapojené. Sdílení jedné položky z prohlížeče nebo výběru.
- Zachovaný samostatný EAS profil preview; development je jeho alias.
  README opraveno pro aktuální ovládání, instalaci, vývoj a samostatnou APK.

Fáze 5–8 jsou implementované včetně skrytých alb a nového UI. Fáze 9 obsahuje
stránkování, virtualizaci a omezené cache; výkon na skutečné velké knihovně
a fyzická přejímka Foldu zůstávají neověřené.

## Databáze a závislosti

Stejná `galerie.db`, tabulky `albums`, `media_items`, `media_albums`, `app_settings`.
Migrace na **user_version 2** přidává nullable `trashed_at` a indexy viditelnosti.
Zachovává alba, soubory, vazby, nastavení a skrytý stav; napravuje skrytý stav
dřívějších členů skrytých alb. Migrace i změny se serializují přes stávající frontu.

**V tomto kroku nebyly přidány ani odstraněny žádné závislosti.**
Package soubory a pnpm lockfile se neměnily. Expo SDK 57, React Native 0.86.3,
React 19.2.3; žádný nový backend nebo cloud.

## Provedené kontroly

- TypeScript mobilní aplikace a designového balíčku: **prošel**.
- Existující rychlá sada rozšířená o migraci v2, skrytá alba, koš a časovou osu:
  **28/28 prošlo** (celkem pod jednu sekundu). SQLite test zahrnuje skutečné
  zavření a opětovné otevření DB; stránkování pokrývá i chybějící data pořízení.
- Android produkční export: **prošel**, 1 886 modulů, 31 assetů, Hermes 4,5 MB.
  Výstup je v ignorované `.expo/validation-export`; export není APK.
- Expo konfigurace se správně načte; samostatný profil preview zůstává nastavený.
- `adb devices`: žádné připojené zařízení.
- `eas whoami`: Not logged in. Nová APK na EAS v tomto prostředí nevytvořena.

Uživatel před touto změnou potvrdil přímý start APK, přehrávání videí a nativní
alba. Toto potvrzení není vydáváno za fyzický test nové verze.

## Co zbývá ověřit na Samsung Galaxy Z Fold 8

Krátký průchod nové APK: start a oprávnění včetně návratu z Android Settings;
fotky/videa, ostrost náhledů, přehrávání, zoom/swipe/Back; nativní alba a návrat;
normální i skrytá alba, počty/obaly, výběr, koš, obnova, mazání, sdílení a restart.
Zkontrolovat všechny čtyři záložky, vzhled proti referenci, cover/inner displej,
otevření/zavření a otočení během práce. Posoudit plynulost na skutečné velké knihovně.

Požadované scénáře 1–38 nejsou označené jako prošlé na zařízení: zařízení není
připojené. Automatické kontroly pokrývají datové podmínky a sestavení, nikoli
Android dialogy, ovládání, kodeky, vzhled nebo FPS.

## Známé hranice

- Skrytí je filtr uvnitř Galerie, bez biometrického zámku či šifrování.
- Koš je lokální, bez automatického mazání; soubory zůstávají dostupné jiným
  oprávněným aplikacím až do potvrzeného smazání z telefonu.
- Sdílení podporuje jednu položku. Hromadné sdílení a zápis systémových
  oblíbených nejsou implementované.
- Řazení podle názvu potřebuje projít metadata vybraného zdroje; nenačítá tím
  originální obrázky. První video náhledy vznikají postupně.
  Datové řazení předem projde pouze metadata médií bez data pořízení, pokud taková
  existují. U běžné datované knihovny stačí úvodní dotaz na jeden záznam.
- Při omezeném přístupu nelze rozlišit smazané a nepovolené médium; metadata
  zůstávají uchovaná do úplného ověření oprávnění.

## Změněné soubory

<!-- changed-files -->

- `README.md`
- `VERIFICATION.md`
- `artifacts/galerie-design-system/tokens.json`
- `artifacts/galerie-design-system/src/generated/tokens.tsx`
- `artifacts/galerie-design-system/src/hooks/use-colors.tsx`
- `artifacts/galerie-mobile/app/_layout.tsx`
- `artifacts/galerie-mobile/app/(tabs)/_layout.tsx`
- `artifacts/galerie-mobile/app/(tabs)/albums.tsx`
- `artifacts/galerie-mobile/app/(tabs)/more.tsx`
- `artifacts/galerie-mobile/app/album/[id].tsx`
- `artifacts/galerie-mobile/app/hidden.tsx`
- `artifacts/galerie-mobile/app/media/[id].tsx`
- `artifacts/galerie-mobile/app/settings.tsx`
- `artifacts/galerie-mobile/app/trash.tsx`
- `artifacts/galerie-mobile/app/help.tsx`
- `artifacts/galerie-mobile/components/AddToAlbumModal.tsx`
- `artifacts/galerie-mobile/components/AlbumCards.tsx`
- `artifacts/galerie-mobile/components/CreateAlbumModal.tsx`
- `artifacts/galerie-mobile/components/GalleryHeader.tsx`
- `artifacts/galerie-mobile/components/GalleryPreferences.tsx`
- `artifacts/galerie-mobile/components/LibraryScreen.tsx`
- `artifacts/galerie-mobile/components/MediaGrid.tsx`
- `artifacts/galerie-mobile/components/MediaThumbnail.tsx`
- `artifacts/galerie-mobile/components/MenuCard.tsx`
- `artifacts/galerie-mobile/components/PreferenceSheet.tsx`
- `artifacts/galerie-mobile/db/index.ts`
- `artifacts/galerie-mobile/db/schema.ts`
- `artifacts/galerie-mobile/db/stores/album-store.ts`
- `artifacts/galerie-mobile/db/stores/media-store.ts`
- `artifacts/galerie-mobile/db/stores/settings-store.ts`
- `artifacts/galerie-mobile/lib/media.ts`
- `artifacts/galerie-mobile/lib/native-albums.ts`
- `artifacts/galerie-mobile/lib/timeline.ts`
- `artifacts/galerie-mobile/tests/library.test.cjs`
- `artifacts/galerie-mobile/tests/media-pages.test.cjs`
- `artifacts/galerie-mobile/tests/timeline.test.cjs`
