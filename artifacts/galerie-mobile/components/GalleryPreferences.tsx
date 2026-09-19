import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import { settingsStore } from "@/db";
import {
  setAppearancePreference,
  type AppearancePreference,
} from "@workspace/galerie-design-system/hooks/use-colors";

export type GallerySort = "newest" | "oldest" | "name";
export type GalleryDensity = "comfortable" | "compact" | "overview";
export type ThumbnailQuality = "balanced" | "high";
type Library = "photos" | "videos";
type Preferences = {
  sort: GallerySort;
  density: GalleryDensity;
  appearance: AppearancePreference;
  thumbnailQuality: ThumbnailQuality;
  swipeEnabled: boolean;
  doubleTapEnabled: boolean;
  videoAutoplay: boolean;
  setThumbnailQuality: (value: ThumbnailQuality) => void;
  setSwipeEnabled: (value: boolean) => void;
  setDoubleTapEnabled: (value: boolean) => void;
  setVideoAutoplay: (value: boolean) => void;
  setSort: (value: GallerySort) => void;
  setDensity: (value: GalleryDensity) => void;
  setAppearance: (value: AppearancePreference) => void;
  lastLibrary: Library;
  setLastLibrary: (value: Library) => void;
  selectionRequest: number;
  selectionTarget: Library;
  requestSelection: (target: Library) => void;
};
const Context = createContext<Preferences | null>(null);
export function GalleryPreferences({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sort, updateSort] = useState<GallerySort>("newest");
  const [density, updateDensity] = useState<GalleryDensity>("comfortable");
  const [appearance, updateAppearance] = useState<AppearancePreference>("dark");
  const [thumbnailQuality, updateQuality] = useState<ThumbnailQuality>("high");
  const [swipeEnabled, updateSwipe] = useState(true);
  const [doubleTapEnabled, updateDoubleTap] = useState(true);
  const [videoAutoplay, updateAutoplay] = useState(false);
  const [lastLibrary, setLastLibrary] = useState<Library>("photos");
  const [selectionRequest, setSelectionRequest] = useState(0);
  const [selectionTarget, setSelectionTarget] = useState<Library>("photos");
  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== "web")
      void (async () => {
        try {
          const [
            storedSort,
            storedDensity,
            storedAppearance,
            quality,
            swipe,
            doubleTap,
            autoplay,
          ] = await Promise.all([
            settingsStore.getSetting("sort"),
            settingsStore.getSetting("density"),
            settingsStore.getSetting("appearance"),
            settingsStore.getSetting("thumbnailQuality"),
            settingsStore.getSetting("swipeEnabled"),
            settingsStore.getSetting("doubleTapEnabled"),
            settingsStore.getSetting("videoAutoplay"),
          ]);
          if (cancelled) return;
          if (quality === "balanced" || quality === "high")
            updateQuality(quality);
          updateSwipe(swipe !== "false");
          updateDoubleTap(doubleTap !== "false");
          updateAutoplay(autoplay === "true");
          if (
            storedSort === "newest" ||
            storedSort === "oldest" ||
            storedSort === "name"
          )
            updateSort(storedSort);
          if (
            storedDensity === "comfortable" ||
            storedDensity === "compact" ||
            storedDensity === "overview"
          )
            updateDensity(storedDensity);
          if (
            storedAppearance === "dark" ||
            storedAppearance === "light" ||
            storedAppearance === "system"
          ) {
            updateAppearance(storedAppearance);
            setAppearancePreference(storedAppearance);
          }
        } catch {
          Alert.alert(
            "Nastavení",
            "Uložené nastavení se nepodařilo načíst. Používá se výchozí zobrazení.",
          );
        }
      })();
    return () => {
      cancelled = true;
    };
  }, []);
  const persist = useCallback((key: string, value: string) => {
    if (Platform.OS !== "web")
      void settingsStore
        .setSetting(key, value)
        .catch(() =>
          Alert.alert("Nastavení se neuložilo", "Zkuste volbu provést znovu."),
        );
  }, []);
  const setSort = useCallback(
    (value: GallerySort) => {
      updateSort(value);
      persist("sort", value);
    },
    [persist],
  );
  const setDensity = useCallback(
    (value: GalleryDensity) => {
      updateDensity(value);
      persist("density", value);
    },
    [persist],
  );
  const setAppearance = useCallback(
    (value: AppearancePreference) => {
      updateAppearance(value);
      setAppearancePreference(value);
      persist("appearance", value);
    },
    [persist],
  );
  const requestSelection = useCallback((target: Library) => {
    setSelectionTarget(target);
    setSelectionRequest((value) => value + 1);
  }, []);
  const setThumbnailQuality = useCallback(
    (value: ThumbnailQuality) => {
      updateQuality(value);
      persist("thumbnailQuality", value);
    },
    [persist],
  );
  const setSwipeEnabled = useCallback(
    (value: boolean) => {
      updateSwipe(value);
      persist("swipeEnabled", String(value));
    },
    [persist],
  );
  const setDoubleTapEnabled = useCallback(
    (value: boolean) => {
      updateDoubleTap(value);
      persist("doubleTapEnabled", String(value));
    },
    [persist],
  );
  const setVideoAutoplay = useCallback(
    (value: boolean) => {
      updateAutoplay(value);
      persist("videoAutoplay", String(value));
    },
    [persist],
  );
  const value = useMemo(
    () => ({
      sort,
      density,
      appearance,
      thumbnailQuality,
      swipeEnabled,
      doubleTapEnabled,
      videoAutoplay,
      setThumbnailQuality,
      setSwipeEnabled,
      setDoubleTapEnabled,
      setVideoAutoplay,
      setSort,
      setDensity,
      setAppearance,
      lastLibrary,
      setLastLibrary,
      selectionRequest,
      selectionTarget,
      requestSelection,
    }),
    [
      sort,
      density,
      appearance,
      thumbnailQuality,
      swipeEnabled,
      doubleTapEnabled,
      videoAutoplay,
      setThumbnailQuality,
      setSwipeEnabled,
      setDoubleTapEnabled,
      setVideoAutoplay,
      setSort,
      setDensity,
      setAppearance,
      lastLibrary,
      selectionRequest,
      selectionTarget,
      requestSelection,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useGalleryPreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("GalleryPreferences chybí.");
  return value;
}
export const sortLabels: Record<GallerySort, string> = {
  newest: "Nejnovější",
  oldest: "Nejstarší",
  name: "Název",
};
export const densityLabels: Record<GalleryDensity, string> = {
  comfortable: "Pohodlné",
  compact: "Kompaktní",
  overview: "Přehled",
};
