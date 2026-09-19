# Galery

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-tq3urzqn)

## Instalace a Android APK

Projekt je pnpm monorepo. Používejte pnpm 10.26.1; nevytvářejte
`package-lock.json` pomocí npm install. Expo při současné přítomnosti npm a pnpm
lockfilů vybere npm, které zde nenainstaluje závislosti mobilní aplikace.

Z kořene celého repozitáře:

```sh
corepack pnpm install --frozen-lockfile
cd artifacts/galerie-mobile
corepack pnpm exec expo config --type public
npx eas-cli@latest build --platform android --profile development
```

EAS příkazy spouštějte ze složky `artifacts/galerie-mobile`, kde je `eas.json`.
Profil `development` vytváří samostatně instalovatelnou Android APK.
Při spuštění buildu přes propojený GitHub repozitář nastavte stejnou složku jako
kořen aplikace a vyberte aktuální commit větve `main`.
