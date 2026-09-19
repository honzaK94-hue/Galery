# Galerie

Místní Android galerie: fotografie, videa, alba telefonu, vlastní SQLite alba,
skrytá média, prohlížeč s přiblížením, mazání a sdílení. Bez serveru a účtu uvnitř
aplikace. Fáze 10 (vizuální redesign) není součástí těchto změn.

Stav implementace, výsledky kontrol a všech 34 přejímacích scénářů:
[VERIFICATION.md](VERIFICATION.md). Testy na fyzickém Fold 8 a skutečný EAS APK build
zatím nejsou potvrzené. JavaScript export není APK.

## Instalace

Ověřeno s Node.js 22.19.0 a pnpm 10.26.1. Klonujte celý repozitář, protože mobilní
aplikace používá místní designový balíček. Příkazy níže fungují bez Bolt/Replit.
V PowerShellu lze použít `corepack.cmd` a `npx.cmd`, pokud execution policy blokuje
jejich `.ps1` variantu.

```sh
git clone https://github.com/honzaK94-hue/Galery.git
cd Galery
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @workspace/galerie-design-system tokens
```

Používejte pnpm, nevytvářejte `package-lock.json` příkazem `npm install`.
Současný npm a pnpm lockfile dříve způsoboval nesprávnou instalaci na EAS a chybu
„expo package was not found / Failed to resolve plugin expo-router“.
`pnpm-lock.yaml` se mění pouze package managerem.

## Vývojový build a spuštění

Expo Go neposkytuje prostředí potřebné pro úplné ověření galerie. Použijte vlastní
vývojový build. EAS příkazy spouštějte ve složce mobilní aplikace:

```sh
cd artifacts/galerie-mobile
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
corepack pnpm start
```

Nainstalujte vývojovou APK z výsledku buildu, spusťte ji v telefonu a připojte ji
k vypsanému Metro serveru. Počítač i telefon musí mít dostupné síťové spojení.
S místním Android SDK a JDK lze alternativně použít `corepack pnpm android`.

## Samostatná Android APK

```sh
cd artifacts/galerie-mobile
corepack pnpm exec expo config --type public
npx eas-cli@latest build --platform android --profile preview
```

Profil `preview` vytváří samostatnou interně distribuovanou APK bez Metro serveru.
Profil `development` obsahuje vývojový klient. Projekt je propojený s EAS týmem
`shiny94s-team`; přihlášený Expo účet musí mít k tomuto projektu přístup.
Při sestavení přes GitHub nastavte adresář aplikace na `artifacts/galerie-mobile`
a vyberte aktuální commit. Celý pnpm workspace musí být součástí build archivu.
EAS používá pnpm 10.26.1 uvedený v `eas.json`.

APK stáhněte z dokončeného EAS buildu do telefonu a otevřete ji. Android může
požadovat povolení instalace z použitého prohlížeče/správce souborů. S ADB:

```sh
adb install -r cesta-ke-stazene.apk
```

Aktualizaci instalujte se stejným podpisem. Neodinstalovávejte aplikaci, chcete-li
zachovat její vlastní alba a skrytý stav v SQLite.

## Používání

- Podržení média zapne výběr; další klepnutí přidávají/odebírají položky.
- „Vybrat vše“ stránkuje celý aktuální seznam. Spodní lišta nabízí odpovídající akce.
- „Moje alba“ jsou virtuální SQLite alba; „Alba telefonu“ čte Android.
- Smazání vlastního alba ani odebrání položky z alba nemaže soubory v telefonu.
- „Smazat z telefonu“ vyžaduje potvrzení; může následovat další systémový dialog.
- Skrytá média jsou v Nastavení → Skrytá média. Skrytí platí pouze uvnitř Galerie;
  nejde o šifrovaný trezor ani o skrytí před jinými aplikacemi.
- Fotografie podporují pinch, dvojité klepnutí, posun při přiblížení a přejetí na
  sousední médium při oddálení. Android Back nejdřív zruší přiblížení / informace.
- Videa používají nativní ovládání přehrávání, posunu a celé obrazovky.
- Sdílení je dostupné z prohlížeče i pro jednu vybranou položku. Více souborů
  najednou se nesdílí. Soubor se dočasně zkopíruje do cache pro Android share sheet.
- Po změně oprávnění v Android Settings se přístup a knihovna znovu zkontrolují.
  Omezený přístup nezpůsobí smazání vztahů k dočasně nepřístupným médiím.

## Kontroly

Z kořene repozitáře:

```sh
corepack pnpm --filter @workspace/galerie-mobile typecheck
corepack pnpm --filter @workspace/galerie-design-system typecheck
corepack pnpm --filter @workspace/galerie-mobile test
cd artifacts/galerie-mobile
npx expo-doctor
corepack pnpm exec expo install --check
corepack pnpm exec expo export --platform android --output-dir .expo/validation-export
```

Testy používají skutečnou SQLite přes vestavěné `node:sqlite` v Node 22 a simulované
Media Library odpovědi pro stránkování. Nenahrazují zkoušku nativních oprávnění,
gest, video kodeků, mazání a sdílení v telefonu. Expo příkazy nepatří do kořene
monorepa; tam balíček `expo` záměrně není přímou závislostí.

Generátor designových tokenů čte `artifacts/galerie-design-system/tokens.json`.
Po změně tokenů spusťte `corepack pnpm --filter @workspace/galerie-design-system tokens`
a commitněte také vygenerovaný soubor.

Ostatní webové/API/databázové workspace balíčky nejsou součástí běhu galerie.
Mobilní aplikace nevyžaduje PostgreSQL, Bolt ani Replit účet či službu.
