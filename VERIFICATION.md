# Galerie — implementace a přejímací protokol

Datum: 19. 9. 2026. Rozsah: audit a fáze 5–9. Fáze 10 se neimplementovala.

Implementace je připravená k nativnímu ověření. Celou aplikaci zatím nelze označit
za fyzicky ověřenou nebo finálně převzatou: `adb devices` v tomto prostředí
neobsahuje žádné zařízení a `eas whoami` vrací `Not logged in`.
Hostitelské testy, export JavaScriptu a Android prebuild nenahrazují sestavení APK
na EAS ani spuštění na Samsung Galaxy Z Fold 8.

## Audit — provedené opravy

1. Skutečné přehrávání videa přes expo-video, nativní play/pause/seek/fullscreen,
   pozastavení při opuštění obrazovky a přechodu aplikace do pozadí.
2. Android Back z nativního alba vrací seznam alb. Výběr médií má přednost před
   opuštěním alba. Přepínání hlavních záložek používá navigate.
3. Média se otevírají strukturovanou Expo Router cestou s parametrem `id`.
   Speciální znaky se neskládají do syrové URL.
4. Změny SQLite oznamují změnu knihovny; seznamy se obnovují při návratu i změně.
   Počty a obaly vlastních alb filtrují skrytá a nedostupná média. Úplný úspěšný
   scan s plným přístupem čistí osiřelé záznamy a jejich vazby. Omezený přístup
   pouze označuje nedostupnost, zachovává skrytý stav a členství v albech.
5. AddToAlbumModal hlásí skutečně vložené / již přítomné / nedostupné položky.
6. Jednotná kontrola oprávnění, návrat z Android Settings, omezený výběr,
   explicitní žádost o přístup a opakování po chybě. Zastaralé či přerušené
   výsledky nesmějí promazat databázi.
7. pnpm lockfile, runtime závislosti v dependencies, sjednocený React 19.2.3,
   kompatibilní opravy SDK 57, chybějící Metro peer dependency a správný
   expo-splash-screen plugin. Profily development a samostatný preview APK.
8. Generátor tokenů skutečně čte tokens.json; výstup je testovaný proti zdroji.
9. README obsahuje instalaci, vývoj, EAS APK a instalaci APK bez Bolt/Replit.
   Nepřidával se backend ani účet do aplikace. Ostatní workspace infrastruktura
   zůstala mimo funkční rozsah mobilní galerie.

## Stav fází

| Fáze | Implementováno | Zbývající ověření |
|---|---|---|
| 5 — skrytá média | Existující is_hidden, jedna i více položek, sekce Nastavení → Skrytá média, obnova, filtrování feedu/videí/alb/obalů | Nativní průchod a restart na telefonu |
| 6 — prohlížeč | Pinch, dvojité klepnutí, pan, swipe s pokračováním stránkování, video, metadata, Back, dynamické rozměry | Gesta, kodeky, fullscreen, orientace a Fold |
| 7 — delete/share | Potvrzení a nativní mazání jednotlivě i dávkou; SQL cleanup až po úspěchu; sdílení přes cache a systémový dialog | Skutečné Android dialogy a cílové aplikace |
| 8 — alba/výběr | CRUD alb, vazby, přesné počty a obaly, jednotný výběr, vybrat vše, kontextové akce, obnova po změně | Kompletní UI průchod a Android Back |
| 9 — stabilita/výkon | Stránkování, downsampling, omezený video thumbnail cache, jeden dekodér, serializované SQL transakce, zrušení starých požadavků, bezpečné oprávnění a DB startup retry | Profilování na velké skutečné knihovně, Fold, EAS APK |

## Databáze

Zůstává `galerie.db` a původní tabulky `albums`, `media_items`, `media_albums`,
`app_settings`. Migrace `PRAGMA user_version = 1`:

- Sloučí staré duplicitní řádky podle `media_id`, zachová sjednocení vazeb i skrytí.
- Přidá unikátní index `idx_media_identity` nad `media_id`.
- Přidá `is_available INTEGER NOT NULL DEFAULT 1` pro omezená oprávnění.
- Používá existující `is_hidden`; nevzniká druhá evidence skrytých médií.
- Mazání alba/členství mění výhradně SQLite, nikoli telefonní média.
- Mazání média odstraní jeho vazby přes cizí klíče `ON DELETE CASCADE`.
- Migrace i vícenásobné změny probíhají v transakcích; fronta odděluje souběžné
  operace store. Neúspěšná inicializace zobrazí opakování místo prázdné „funkční“ DB.

## Závislosti

Přidáno mobilní aplikaci:

- `expo-video ~57.0.4` — přehrávání a video náhledy.
- `expo-sharing ~57.0.21` — systémové sdílení jednoho souboru.
- `expo-file-system ~57.0.7` — kopie do cache pro sdílení.
- `expo-dev-client ~57.0.19` — vlastní vývojový klient.
- `@react-native/metro-config 0.86.3` jako dev dependency — chybějící peer.

SDK zůstává 57, React Native 0.86.3. Aktualizovány kompatibilní patch verze
expo (57.0.24), expo-constants (57.0.19), expo-router (57.0.22), expo-image-picker
a expo-location (57.0.19). React a React DOM v designovém balíčku sjednoceny
na 19.2.3. Runtime mobilní knihovny přesunuty z devDependencies do dependencies.
Žádná existující přímá závislost nebyla odstraněna. Zbytečný mobilní `serve`
příkaz a Replit spouštěcí příkaz byly nahrazeny skutečnými Expo příkazy.
Lockfile generoval pnpm, nebyl ručně upravován.

## Provedené kontroly

- `pnpm install --frozen-lockfile`: úspěch.
- TypeScript mobilní aplikace: úspěch.
- TypeScript designového balíčku a generování tokenů: úspěch.
- `pnpm --filter @workspace/galerie-mobile test`: **22/22 úspěšných**.
- Skutečná hostitelská SQLite: migrace, restart, cizí klíče, rollback, duplicitní
  přidávání, skrytí/obnova, bezpečné smazání alba, cleanup médií, omezená oprávnění.
- Test 1 205 položek: úplné a disjunktní stránky, dávky nad 400 parametry,
  počty a úklid vazeb. Jde o test datové logiky, nikoli Android FPS benchmark.
- Simulované Media Library odpovědi: skryté stránky, cursor, typ média,
  album scope, neplatný permission snapshot, nativní obaly a počty bez skrytých médií.
- `expo install --check`: dependencies are up to date.
- `expo-doctor`: **21/21**, bez nálezů. Běží z artifacts/galerie-mobile.
- `expo export --platform android`: úspěch, Hermes bundle a assets v ignorované
  `.expo/validation-export`. Není to APK ani důkaz funkčnosti nativního přehrávání.
  Poslední export: 1 875 modulů, 31 assetů, Hermes přibližně 4,4 MB. Přímé importy
  používaných fontů/ikon snížily proti prvnímu exportu této změny 64 assetů na 31
  a balíček z přibližně 4,8 na 4,4 MB bez změny vzhledu.
- `expo prebuild --platform android --no-install`: úspěch v izolované validační
  kopii pod `.git/validation/native-prebuild`; zdrojový managed projekt se nemění.
- `git diff --check`: bez chyb whitespace.
- `eas whoami`: **Not logged in**. Skutečný cloud build APK neproveden.
- `adb devices`: **žádné připojené zařízení**. Žádný scénář níže nemá falešné
  označení „prošel na telefonu“.

## Všech 34 požadovaných scénářů

Sloupec „zde ověřeno“ popisuje jen dostupný důkaz. Všechny řádky vyžadující Android
zůstávají k fyzickému dokončení; kontrola kódu není náhradou runtime testu.
Použijte kopie testovacích fotografií a videí pro scénáře fyzického mazání.

| # | Scénář | Zde ověřeno | Zbývající přejímka |
|---|---|---|---|
| 1 | Start s povoleným přístupem | TypeScript, konfigurace, scan test | Studený start APK se všemi oprávněními |
| 2 | Start s odmítnutým přístupem | Denied scan nečte ani nemaže DB; gate v kódu | Odepřít, restartovat, povolit tlačítkem |
| 3 | Změna oprávnění v Settings | Foreground listener, omezené/změněné snapshoty v testech | Během běhu přepnout vše → vybrané → nic → vše |
| 4 | Načtení fotografií | Typ photo a stránkování testované | Reálné JPEG/PNG/HEIC a prázdná knihovna |
| 5 | Načtení videí | Typ video a stránkování testované | Reálné videosoubory a náhledy |
| 6 | Skutečné přehrávání videí | expo-video integrováno, export/prebuild | Play, pause, seek, konec, zvuk, poškozený soubor, pozadí |
| 7 | Otevření fotografie | Parametrická cesta, speciální ID test | Klepnout na fotografii ze všech seznamů |
| 8 | Photo zoom | Gesture/Reanimated kód, export | Pinch 1–5×, dvojité klepnutí, pan a hranice |
| 9 | Swipe mezi médii | Session, cursor a stránkování; TypeScript | Oba směry, konec stránky, smíšené album, zoom reset |
| 10 | Android Back | Handlery pro výběr, zoom a info; Router | Back ve výběru, zoomu, info, videu a fullscreen |
| 11 | Nativní alba | Scope a obaly/počty testované | Otevřít Camera, Screenshots a další Android alba |
| 12 | Back z nativního alba | Lokální stavový handler, priorita výběru | Návrat na seznam a opětovné otevření bez duplikované historie |
| 13 | Vytvoření vlastního alba | SQLite test | Vytvořit přes dialog v APK |
| 14 | Přejmenování alba | SQLite test a refresh notifikace | Detail → přejmenovat → seznam → restart |
| 15 | Smazání alba zachová média | SQLite test zachování media_items | Zkontrolovat originály i mimo Galerii |
| 16 | Přidání média do alba | SQLite insert/membership test | Jedna i více položek přes modal |
| 17 | Duplicitní přidání nelže | Test added=0, alreadyPresent a failed | Znovu přidat stejné položky a přečíst výsledek |
| 18 | Odebrání média z alba | SQLite vztah odstraněn, identita zachována | Ověřit soubor v hlavním feedu i telefonu |
| 19 | Aktualizace počtů | SQLite i native summary testy | Vracet se mezi detail/list po všech akcích |
| 20 | Aktualizace obalů | Test změny obalu i prázdného alba | Photo/video cover po skrytí, odebrání a externím smazání |
| 21 | Skrytí médií | SQLite jednotlivé/dávkové změny | Skrýt fotografii, video a smíšený výběr |
| 22 | Zmizí z běžných pohledů | Feed/native/custom filtrování a obaly testované | Zkontrolovat všechny záložky a běžná alba |
| 23 | Obnova skrytých médií | SQLite restore test | Nastavení → Skrytá média → obnovit jednotlivě i dávkou |
| 24 | Skrytí přežije restart | Skutečné zavření/otevření SQLite testované | Force-stop APK, znovu spustit; ověřit stav |
| 25 | Fyzické smazání jednoho média | Native success/cancel/error orchestrace testovaná | Potvrdit i zrušit skutečný systémový dialog |
| 26 | Fyzické smazání více médií | Dávková orchestrace a SQL cleanup test | Smíšený výběr včetně skrytých médií, potvrzení/zrušení |
| 27 | Úklid SQLite vazeb po smazání | FK cascade test, alba zachována | Po skutečném delete ověřit alba a restart |
| 28 | Sdílení média | Expo API + file/content URI cache implementace, export | Fotografie/video do skutečné cílové aplikace; viewer i výběr |
| 29 | Chybějící/smazaná média | Reconcile, rollback, unavailable a UI chyby | Smazat mimo aplikaci, vrátit se; neplatný či poškozený soubor |
| 30 | Aplikace po restartu | SQLite restart, migrace, TypeScript | Force-stop/start, relaunch po aktualizaci APK |
| 31 | Fold 8 cover display | Dynamické rozměry a stránkování v kódu | Celý UI průchod na zavřeném telefonu |
| 32 | Fold 8 inner display | Dynamické rozměry a neuzamčená orientace | Otevřít/zavřít během gridu, výběru, zoomu i videa; otočit |
| 33 | Velká mediální knihovna | Datový test 1 205 položek, virtualizace, downsampling/cache | Tisíce až desítky tisíc skutečných médií, FPS/paměť, select all |
| 34 | EAS APK bez Bolt/Replit | Frozen install, config, Doctor, export, native prebuild | Přihlásit EAS účet s přístupem k týmu, dokončit preview build a instalovat APK |

## Známé limity a otevřené body

- EAS APK nebyla vytvořena; chybí přihlášení. Návod k dokončení je v README.
- Žádný fyzický Fold 8 test, codec/playback test ani skutečný Android dialog
  nebyl proveden. Fáze 9 nemá uzavřenou výkonovou a zařízeními podloženou přejímku.
- Sdílení podporuje jednu položku; hromadné sdílení není implementované.
  Kopie velkého videa ke sdílení vyžaduje odpovídající volné místo v cache.
- Skrytí je lokální filtr této aplikace, není to zabezpečený ani šifrovaný trezor.
- Video náhledy vznikají postupně jedním dekodérem; první průchod velkým seznamem
  může dočasně zobrazovat ikony videa. Cache drží maximálně 80 náhledů 320 × 320.
- Plný scan kvůli chybějícím starým médiím může projít celou knihovnu; při běžném
  ověření končí, jakmile našel všechny již evidované identity. Nativní výkon je
  nutné změřit na reálném zařízení, nikoli odvodit z rychlosti hostitelských testů.
- U omezeného přístupu nelze spolehlivě rozlišit smazaný a nepovolený soubor.
  Proto se nepřístupná metadata zachovávají, dokud není možné úplné ověření.

## Změněné soubory

Seznam níže zahrnuje implementaci, konfiguraci, testy a dokumentaci tohoto kroku;
generované `.expo`, nativní validační kopie a lokální node_modules se necommitují.

<!-- changed-files -->

- `README.md`
- `VERIFICATION.md`
- `artifacts/galerie-design-system/package.json`
- `artifacts/galerie-design-system/scripts/build-tokens.mjs`
- `artifacts/galerie-design-system/src/generated/tokens.tsx`
- `artifacts/galerie-design-system/src/hooks/use-fonts.tsx`
- `artifacts/galerie-mobile/app.json`
- `artifacts/galerie-mobile/app/(tabs)/_layout.tsx`
- `artifacts/galerie-mobile/app/(tabs)/albums.tsx`
- `artifacts/galerie-mobile/app/(tabs)/index.tsx`
- `artifacts/galerie-mobile/app/(tabs)/videos.tsx`
- `artifacts/galerie-mobile/app/_layout.tsx`
- `artifacts/galerie-mobile/app/album/[id].tsx`
- `artifacts/galerie-mobile/app/hidden.tsx`
- `artifacts/galerie-mobile/app/media/[id].tsx`
- `artifacts/galerie-mobile/app/settings.tsx`
- `artifacts/galerie-mobile/components/AddToAlbumModal.tsx`
- `artifacts/galerie-mobile/components/DevelopmentBuildRequired.tsx`
- `artifacts/galerie-mobile/components/DeviceOnly.tsx`
- `artifacts/galerie-mobile/components/ErrorFallback.tsx`
- `artifacts/galerie-mobile/components/GalleryProvider.tsx`
- `artifacts/galerie-mobile/components/LibraryScreen.tsx`
- `artifacts/galerie-mobile/components/MediaGrid.tsx`
- `artifacts/galerie-mobile/components/MediaPermissionGate.tsx`
- `artifacts/galerie-mobile/components/MediaThumbnail.tsx`
- `artifacts/galerie-mobile/components/VideoPlayer.tsx`
- `artifacts/galerie-mobile/components/ZoomablePhoto.tsx`
- `artifacts/galerie-mobile/db/changes.ts`
- `artifacts/galerie-mobile/db/database.ts`
- `artifacts/galerie-mobile/db/queue.ts`
- `artifacts/galerie-mobile/db/schema.ts`
- `artifacts/galerie-mobile/db/stores/album-store.ts`
- `artifacts/galerie-mobile/db/stores/media-store.ts`
- `artifacts/galerie-mobile/eas.json`
- `artifacts/galerie-mobile/lib/delete-media.ts`
- `artifacts/galerie-mobile/lib/media-actions.ts`
- `artifacts/galerie-mobile/lib/media.ts`
- `artifacts/galerie-mobile/lib/native-albums.ts`
- `artifacts/galerie-mobile/lib/reconcile.ts`
- `artifacts/galerie-mobile/lib/viewer-session.ts`
- `artifacts/galerie-mobile/package.json`
- `artifacts/galerie-mobile/tests/library.test.cjs`
- `artifacts/galerie-mobile/tests/media-pages.test.cjs`
- `pnpm-lock.yaml`
