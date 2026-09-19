# Galerie

Lokální Android galerie se čtyřmi záložkami **Fotky, Videa, Alba, Více**.
Časová osa, přehrávání videí, systémová i vlastní alba, biometricky zamčené skryté
položky a alba, systémový koš, oblíbené a hromadné sdílení. Bez serveru nebo účtu
v aplikaci. Rozložení reaguje na šířku displeje a orientaci.

Aktuální implementace, výsledky kontrol a zbývající ověření na telefonu:
[VERIFICATION.md](VERIFICATION.md).

## Instalace projektu

Node.js 22 a pnpm 10.26.1. Klonujte celý repozitář; aplikace používá místní designový
balíček a nativní Android modul. Nepoužívejte `npm install` a nevytvářejte druhý lockfile.

```sh
git clone https://github.com/honzaK94-hue/Galery.git
cd Galery
corepack pnpm install --frozen-lockfile
```

U existujícího checkoutu nejdříve spusťte `git pull`, potom znovu instalaci závislostí.
V PowerShellu lze místo `corepack` a `npx` použít `corepack.cmd` a `npx.cmd`,
pokud execution policy blokuje jejich PowerShell variantu.

## Samostatná Android APK

APK je instalační soubor aplikace pro Android. **EAS** (Expo Application Services)
je služba, která jej sestaví ze zdrojového projektu. Expo účet potřebuje autor buildu;
uživatel Galerie se nikam nepřihlašuje.

Z kořene repozitáře:

```sh
cd artifacts/galerie-mobile
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Použijte profil **preview**: `developmentClient: false`, `distribution: internal`,
`android.buildType: apk`. Výsledná APK obsahuje aplikaci a otevírá přímo Galerii.
Nevyžaduje Expo Go, lokální vývojový server, Bolt ani Replit.
Starý profil `development` je aliasem tohoto samostatného profilu.

Projekt patří EAS týmu `shiny94s-team`; přihlášený Expo účet musí mít přístup.
Při buildu přes GitHub vyberte aktuální commit a adresář aplikace
`artifacts/galerie-mobile`. Build archiv musí obsahovat celý pnpm workspace.

Aktuální verze je **1.1.1 / versionCode 3**. Verze 1.1.0 přidala nativní modul a vyžaduje novou APK.
Pouhé obnovení JavaScriptu ve staré APK nové funkce nepřidá. Systémový koš a oblíbené
používají Android 11 nebo novější. Nativní modul je uložený přímo v repozitáři.

Z úspěšného EAS buildu stáhněte APK do telefonu a otevřete ji. S připojeným ADB:

```sh
adb install -r cesta-ke-stazene.apk
```

Instalujte jako aktualizaci se stejným podpisem. Odinstalování odstraní lokální
alba, nastavení a skrytý stav Galerie. Aktualizace databázi zachovává.

## Ovládání

- **Fotky:** souvislá časová osa. Nadpisy dnů, měsíců a let nic nefiltrují.
  Hledání vyhledává podle názvu souboru; řazení a hustotu lze měnit.
  Dnes a Včera platí ve všech hustotách, posledních 30 dnů má denní skupiny,
  starší snímky aktuálního roku měsíční a předchozí roky roční skupiny.
- **Videa:** dvě kolony, náhledy, délka, přehrávač s posunem a celou obrazovkou.
- **Alba:** systémová alba telefonu, oblíbené a vlastní SQLite alba s počty a obaly.
  Vlastní album lze vytvořit, přejmenovat nebo smazat bez odstranění originálů.
  Dlouhý stisk nebo tři tečky u vlastního alba nabízí připnutí/odepnutí.
  V otevřeném vlastním albu vyberte jednu fotografii a použijte **Nastavit jako titulní**.
  Při odebrání, skrytí, přesunu do koše nebo nedostupnosti se obal automaticky nahradí.
- **Více:** Oblíbené, Skryté, Koš, Nastavení, Vybrat, Třídit, Zobrazení a Nápověda.
- Podržení média zapne výběr. Vybrat vše postupně načte celý aktuální seznam.
  Akce zahrnují přiřazení do alba, odebrání z alba, skrytí, obnovu, oblíbené,
  sdílení více souborů, systémový koš a trvalé mazání s potvrzením.
- **Skryté → Položky / Alba:** otisk prstu nebo PIN, gesto či heslo telefonu.
  Zámek je výchozí; při odchodu do pozadí se zamkne znovu. Jeho vypnutí vyžaduje
  ověření. Chráněný obsah blokuje snímání obrazovky; skrytá videa mají vlastní
  zabezpečené zobrazení přes celou obrazovku.
- Přidání do skrytého alba zároveň médium skryje z běžných pohledů. Odebrání z alba
  ani smazání alba nesmaže originál a samo médium neodkryje. Výslovná obnova média
  odstraní jeho vazby na skrytá alba a zachová vazby na běžná alba.
- Skrytí a zámek chrání obsah **uvnitř Galerie**. Originální soubory nejsou šifrované
  a jiné oprávněné aplikace je mohou číst.
- **Koš:** skutečný Android MediaStore koš s obnovou, datem vypršení, jednotlivým
  i hromadným trvalým mazáním. Délku uchování určuje Android. Původní místní koš
  zůstává obnovitelný; tlačítko Převést starý koš přesune jeho položky do systémového
  koše po potvrzení. Zahrnutí skrytých položek vyžaduje odemčení.
- **Oblíbené:** srdíčko zapisuje Android MediaStore oblíbené. Oddělená obrazovka
  respektuje skrytí a koš. Samsung může ve své aplikaci používat jinou evidenci.
- Prohlížeč podporuje pinch, dvojité klepnutí, posun při přiblížení a přejetí mezi
  médii při oddálení. Android Back nejdřív zruší zoom nebo informace.
  Při vypnutí přejetí jsou dostupná tlačítka Předchozí / Další.
- Návrat z nastavení Androidu znovu zkontroluje oprávnění. Omezený přístup nezničí
  metadata ani vztahy dočasně nepřístupných médií.

## Nastavení

**Alba → Zobrazovat systémová alba** pouze zapíná/vypíná celou systémovou sekci
na obrazovce Alba; výchozí stav je zapnuto. Fotky, videa, vlastní a skrytá alba ani
MediaStore tím nejsou změněné. Systémová alba se v aplikaci nemažou.
**Řazení alb** nabízí Název / Nejnovější / Počet položek, připnutá alba jsou vždy
první. Výchozí řazení zůstává dosavadní Nejnovější (podle vytvoření alba).

**O aplikaci** obsahuje verzi a podíly: **5 % puppy Shiny** za obecný nápad
a **95 % Mister puppy - Dark** za dopracování, úsilí, výpočetní výkon a zkušenosti.

Všechny nabízené volby mají zapojenou akci: tmavý/světlý/systémový vzhled, hustota,
řazení, kvalita náhledů, dvojité klepnutí, přejetí, automatické přehrávání videa,
biometrický zámek, zamčení nyní, zabezpečení telefonu, správa oprávnění, obnova
knihovny, koš, vyčištění náhledů, export/import a obnovení výchozího zobrazení.
Změny se ukládají a přežijí restart.

Záloha JSON obsahuje alba, vazby, skrytý stav a běžná nastavení; **nekopíruje fotografie
ani videa**. Je určená pro média se stejnými identifikátory na stejném telefonu.
Je nešifrovaná a může obsahovat názvy skrytých alb. Import zachovává existující data,
nevytváří znovu již importovaná alba a nemění zabezpečení. Obnovení výchozího zobrazení
nesmaže alba, skrytí ani koš.

## Místní vývoj a krátké kontroly

S Android SDK/JDK a připojeným telefonem nebo emulátorem:

```sh
cd artifacts/galerie-mobile
corepack pnpm android
```

Tento příkaz vytvoří místní debug aplikaci s vývojovým serverem. Pro samostatnou APK
používejte EAS profil `preview`. Z kořene repozitáře lze ověřit zdroje:

```sh
corepack pnpm --filter @workspace/galerie-mobile typecheck
corepack pnpm --filter @workspace/galerie-mobile test
cd artifacts/galerie-mobile
corepack pnpm exec expo export --platform android --output-dir .expo/validation-export
```

Testy ověřují skutečnou hostitelskou SQLite a datovou logiku. Android export ověřuje
JavaScript a assety, není to APK ani ověření na telefonu.

Designové tokeny jsou v `artifacts/galerie-design-system/tokens.json`; po změně spusťte
`corepack pnpm --filter @workspace/galerie-design-system tokens` a přidejte generovaný
soubor. Ostatní webové/API workspace balíčky nejsou součástí běhu Galerie.
