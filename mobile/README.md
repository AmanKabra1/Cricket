# LocalScore — Mobile (React Native / Expo)

Spectator mobile app for Android & iOS, sharing the same backend API and type
contract as the web app.

## Stack
- Expo SDK 52 + React Native 0.76 + TypeScript
- Expo Router (file-based navigation)
- React Query (server state) + axios (with AsyncStorage JWT + refresh)
- socket.io-client (live score / commentary push)

## Run
```bash
cd mobile
npm install
npm run start          # Expo dev server; press a (Android) / i (iOS) / w (web)
npm run android        # build & open on Android emulator/device
npm run ios            # build & open on iOS simulator (macOS)
npm run typecheck      # tsc --noEmit
```

### Pointing at the backend
`app.json → expo.extra.apiBaseUrl / socketUrl`. Defaults assume the **Android
emulator** (`http://10.0.2.2:8000` → host machine). For:
- **iOS simulator**: use `http://localhost:8000`
- **physical device**: use your machine's LAN IP, e.g. `http://192.168.1.20:8000`

Run the backend (`docker compose up` at repo root) first.

## Screens
```
app/
  _layout.tsx              providers (React Query, SafeArea) + Stack
  (tabs)/_layout.tsx       bottom tabs
  (tabs)/index.tsx         dashboard (live / upcoming / recent)
  (tabs)/teams.tsx         teams list
  (tabs)/tournaments.tsx   tournaments list
  team/[id].tsx            squad
  match/[id].tsx           Match Centre — Live / Scorecard / Commentary (realtime)
src/
  lib/api.ts  lib/socket.ts  api/hooks.ts  hooks/  components/  theme.ts  types.ts
```

## Notes
- Spectator-first (no login required), matching the platform's public-read model.
  The API client already carries JWT plumbing for a future admin scoring mode.
- A native run requires Android Studio / Xcode or the Expo Go app on a device;
  `npm run typecheck` validates the codebase without a device.
