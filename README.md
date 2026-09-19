# Galerie

Lokální Android galerie se čtyřmi záložkami **Fotky, Videa, Alba, Více**.
Tmavé rozhraní, časová osa fotografií, přehrávání videí, systémová i vlastní alba,
skrytá alba, koš, zoom, výběr, sdílení a mazání. Bez serveru nebo účtu v aplikaci.
Rozložení reaguje na šířku displeje a orientaci včetně skládacích telefonů.

Aktuální implementace, kontroly a zbývající ověření na telefonu:
[VERIFICATION.md](VERIFICATION.md).

## Instalace projektu

Node.js 22 a pnpm 10.26.1. Klonujte celý repozitář; aplikace používá místní designový
balíček. Nepoužívejte `npm install` a nevytvářejte druhý lockfile.

```sh
git clone https://github.com/honzaK94-hue/Galery.git
cd Galery
corepack pnpm install --frozen-lockfile
```

V PowerShellu lze místo `corepack` a `npx` psát `corepack.cmd` a `npx.cmd`,
pokud execution policy blokuje jejich PowerShell variantu.
U existujícího checkoutu nejdříve stáhněte aktuální změny pomocí `git pull`.

## Samostatná Android APK — pro používání a testování

Z kořene repozitáře:

```sh
cd artifacts/galerie-mobile
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Použijte profil **preview**: `developmentClient: false`,
`distribution: internal`, `android.buildType: apk`.
APK obsahuje aplikaci a po instalaci otevírá přímo Galerii.
Nevyžaduje Expo Go, lokální vývojový server, Bolt ani Replit.
Starý profil `development` je také aliasem tohoto samostatného profilu,
aby dřívější příkaz znovu nevytvořil Expo Development Launcher.

Projekt patří EAS týmu `shiny94s-team`; přihlášený Expo účet musí mít přístup.
Při buildu přes GitHub vyberte aktuální commit a adresář aplikace
`artifacts/galerie-mobile`. Build archiv musí obsahovat celý pnpm workspace.

Z úspěšného EAS buildu stáhněte APK do telefonu a otevřete ji; případně povolte
instalaci z použitého prohlížeče. S připojeným ADB lze použít:

```sh
adb install -r cesta-ke-stazene.apk
```

Instalujte jako aktualizaci se stejným podpisem. Odinstalování aplikace odstraní
její lokální alba, nastavení, skrytý stav a evidenci koše.

## Místní vývoj

S nainstalovaným Android SDK/JDK a připojeným telefonem nebo emulátorem:

```sh
cd artifacts/galerie-mobile
corepack pnpm android
```

Tento příkaz vytvoří místní debug aplikaci s vývojovým serverem.
Pro další spuštění serveru slouží `corepack pnpm start`.
Pro běžné testování samostatné APK používejte výše uvedený EAS profil `preview`.

## Ovládání

- **Fotky:** souvislá časová osa. Nadpisy Dnes, Včera, dnů, měsíců a let nic
  nefiltrují. Hledání vyhledává podle názvu souboru.
- **Videa:** dvě kolony, náhled, délka a nativní přehrávač s posunem a fullscreen.
- **Alba:** systémová alba telefonu a vlastní SQLite alba. Nové album může být
  normální nebo skryté; skrytá alba se v běžném seznamu nezobrazují.
- **Více:** Skryté, Koš, Nastavení, Vybrat, Třídit podle, Zobrazení a Nápověda.
  Volby řazení, hustoty a vzhledu se ukládají.
- Podržení média zapne výběr. Vybrat vše postupně načte celý aktuální seznam.
  Kontextová lišta nabízí přidání/odebrání z alba, skrytí/obnovu, koš a mazání.
- Přidání do skrytého alba zároveň médium skryje ze všech běžných pohledů.
  Smazání alba ani odebrání jeho člena nemaže originál a samo médium neodkrývá.
  Výslovná obnova skrytého média odstraní jeho vazby na skrytá alba.
- Skrytí platí **jen uvnitř Galerie**. Není to šifrovaný nebo zamčený trezor;
  jiné aplikace mají ke svým povoleným médiím nadále přístup.
- Koš je **místní koš Galerie**, nikoli systémový Android koš. Položky zůstanou
  v telefonu a lze je obnovit včetně členství v albech. Nic se nemaže automaticky.
  Až potvrzené „Smazat z telefonu“ odstraní originál i příslušné SQLite vazby.
- Prohlížeč podporuje pinch, dvojité klepnutí, posun při přiblížení a swipe
  mezi médii při oddálení. Android Back nejdřív zruší zoom nebo informace.
- Sdílení je dostupné v prohlížeči i při výběru jedné položky. Hromadné sdílení
  více souborů není implementované. Sdílení velkého videa vyžaduje místo v cache.
- Návrat z nastavení Androidu znovu zkontroluje oprávnění. Omezený přístup
  nezničí metadata ani vztahy dočasně nepřístupných médií.

## Krátké kontroly

Z kořene repozitáře:

```sh
corepack pnpm --filter @workspace/galerie-mobile typecheck
corepack pnpm --filter @workspace/galerie-design-system typecheck
corepack pnpm --filter @workspace/galerie-mobile test
cd artifacts/galerie-mobile
corepack pnpm exec expo export --platform android --output-dir .expo/validation-export
```

Testy ověřují skutečnou hostitelskou SQLite a datovou logiku; Android export
ověřuje sestavení JavaScriptu a assetů. Ani jedno nenahrazuje APK build a telefon.

Designové tokeny jsou v `artifacts/galerie-design-system/tokens.json`.
Po jejich změně spusťte
`corepack pnpm --filter @workspace/galerie-design-system tokens`
a commitněte i generovaný soubor. Ostatní webové/API workspace balíčky nejsou
součástí běhu galerie; mobilní aplikace nevyžaduje PostgreSQL ani Replit služby.
