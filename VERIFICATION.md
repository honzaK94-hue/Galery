# Galerie 1.1.1 — timeline a správa alb

19. 9. 2026. Rozsah: nové zadání timeline, zobrazování systémových alb, řazení,
             připínání a titulní fotografie vlastních alb. Zachována také požadovaná stránka
             O aplikaci. Dřívější požadavek mazání systémových alb byl výslovně zrušen.

## Implementace

- Timeline používá Dnes / Včera / posledních 30 kalendářních dnů / starší měsíce
  aktuálního roku / předchozí roky. Stejné skupiny ve všech hustotách, žádný filtr
  ani vynechání médií. Nadpisy se obnoví o místní půlnoci a při návratu do aplikace.
  Zachované stránkování, memoizace, kvalitní náhledy, výběr a výchozí čtyři sloupce
  na vnitřním displeji. Budoucí a neplatná data zůstávají viditelná.
- Nastavení → Alba → Zobrazovat systémová alba, výchozí hodnota zapnuto. Vypnutí
  odstraní celou systémovou sekci pouze z obrazovky Alba, bez změny souborů, Fotek,
  Videí, MediaStore, vlastních nebo skrytých alb. Při vypnuté volbě se nativní alba
  nenačítají, ani krátce před načtením uložené preference po restartu.
- Řazení vlastních alb podle českého názvu, data vytvoření nebo počtu dostupných
  položek. Dosavadní výchozí pořadí Nejnovější zůstává. Už načtená systémová alba
  se kvůli změně řazení znovu nenačítají; ruční obnova cache obnoví.
- Připnutí/odepnutí v nabídce karty vlastního alba i jeho detailu. Připnutá jsou
  vždy první; uvnitř obou skupin platí zvolené řazení. Odznak na kartě.
- V otevřeném vlastním albu výběr jedné fotografie → Nastavit jako titulní.
  Ukládá se stabilní ID média. Nedostupnost, skrytí, koš, odebrání z alba nebo
  smazání snímku vyvolá bezpečný náhradní obal. Lze obnovit automatickou volbu.
- Nabídka vlastního alba je posuvná, aby zpřístupnila přejmenování, připnutí,
  titulní fotografii a smazání. Smazání vlastního alba zachovává média v telefonu.
- Nastavení → O aplikaci a odkaz z Více: sjednocené karty, ikona, aktuální verze,
  podíly **5 % puppy Shiny** za obecný nápad a **95 % Mister puppy - Dark** za
  dopracování, vložené úsilí, výpočetní výkon a profesionální programátorské zkušenosti.
- Nové preference, připnutí a volba obalu se ukládají a zahrnují do záloh.

Systémová alba nemají tlačítko mazání. Nativní modul, MediaStore operace, Viewer,
Video Player, zámek a architektura koše nejsou tímto updatem změněné.

## SQLite a závislosti

Migrace **user_version 3 → 4** přidává do `albums` pouze:

- `is_pinned INTEGER NOT NULL DEFAULT 0`
- `preferred_cover_media_id TEXT` (nullable)

Zachovává existující alba, vztahy, média, skrytý stav, koš a nastavení. Obal smí být
pouze dostupná fotografie z daného alba; náhradní obal respektuje viditelnost.
`app_settings` ukládá `showSystemAlbums` a `albumSort`; nepotřebuje novou tabulku.
Záloha zůstává ve formátu v1 s volitelnými novými poli. Staré zálohy se dál načítají
bez resetování novějších voleb, které v nich chybí.

**Žádné nové ani odstraněné závislosti.** Verze aplikace 1.1.1 / Android versionCode 3.
EAS profil preview zůstává samostatná APK s `developmentClient: false`.

## Ověření

- TypeScript mobilní aplikace: **prošel**.
- Rychlé testy: **40/40 prošlo**, přibližně 0,7 s. Skutečná SQLite migrace, zachování
  dat/vazeb, připnutí a řazení, volba/náhrada obalu, zálohy a restart databáze;
  timeline ověřena včetně úplnosti datasetu, všech hustot, hranic roku a DST.
- Kontrola změn: bez chyb whitespace. Zrušené mazání systémových alb ani přesouvání
  jejich obsahu není součástí výsledných změn.
- Android produkční export: **prošel**, 1 911 modulů, 32 assetů, Hermes přibližně
  4,7 MB. Export ověřuje JavaScript a assety, není instalační APK.

Nová APK není v tomto kroku sestavená na EAS. Poslední ověření účtu v této relaci
vrátilo Not logged in; přístup k projektu `shiny94s-team` potřebuje autor buildu.
Příkaz z `artifacts/galerie-mobile`:

```sh
npx eas-cli@latest build --platform android --profile preview
```

## Co ještě ověřit na telefonu

Fyzický průchod novou APK na Fold 8 v tomto prostředí nebyl proveden. Zbývá ověřit
vizuální rozložení na obou displejích, přepínač alb po restartu, menu a volbu obalu,
připínání, návraty Android Back a plynulost skutečné velké knihovny. Krátce projít
zachované skryté položky, koš, výběr, prohlížeč a přehrávání. Úspěšný export a datové
testy nejsou označované za fyzické ověření těchto scénářů.

## Změněné soubory tohoto updatu

<!-- changed-files -->

- `artifacts/galerie-mobile/app.json`
- `artifacts/galerie-mobile/app/(tabs)/albums.tsx`
- `artifacts/galerie-mobile/app/(tabs)/more.tsx`
- `artifacts/galerie-mobile/app/_layout.tsx`
- `artifacts/galerie-mobile/app/about.tsx`
- `artifacts/galerie-mobile/app/album/[id].tsx`
- `artifacts/galerie-mobile/app/hidden.tsx`
- `artifacts/galerie-mobile/app/settings.tsx`
- `artifacts/galerie-mobile/components/AlbumCards.tsx`
- `artifacts/galerie-mobile/components/GalleryPreferences.tsx`
- `artifacts/galerie-mobile/components/MediaGrid.tsx`
- `artifacts/galerie-mobile/components/PreferenceSheet.tsx`
- `artifacts/galerie-mobile/db/backup.ts`
- `artifacts/galerie-mobile/db/schema.ts`
- `artifacts/galerie-mobile/db/stores/album-store.ts`
- `artifacts/galerie-mobile/lib/timeline.ts`
- `artifacts/galerie-mobile/tests/backup.test.cjs`
- `artifacts/galerie-mobile/tests/library.test.cjs`
- `artifacts/galerie-mobile/tests/timeline.test.cjs`
- `README.md`
- `VERIFICATION.md`
