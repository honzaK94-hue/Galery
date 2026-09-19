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
export type AlbumSort = "name" | "newest" | "count";
type Library = "photos" | "videos";
type Preferences = {
  ready: boolean;
  showSystemAlbums: boolean;
  albumSort: AlbumSort;
  setShowSystemAlbums: (value: boolean) => void;
  setAlbumSort: (value: AlbumSort) => void;
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
  const [ready, setReady] = useState(Platform.OS === "web");
  const [showSystemAlbums, updateShowSystemAlbums] = useState(true);
  // Preserve the existing explicit newest-created-first custom album order.
  const [albumSort, updateAlbumSort] = useState<AlbumSort>("newest");
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
            storedShowSystemAlbums,
            storedAlbumSort,
          ] = await Promise.all([
            settingsStore.getSetting("sort"),
            settingsStore.getSetting("density"),
            settingsStore.getSetting("appearance"),
            settingsStore.getSetting("thumbnailQuality"),
            settingsStore.getSetting("swipeEnabled"),
            settingsStore.getSetting("doubleTapEnabled"),
            settingsStore.getSetting("videoAutoplay"),
            settingsStore.getSetting("showSystemAlbums"),
            settingsStore.getSetting("albumSort"),
          ]);
          if (cancelled) return;
          updateShowSystemAlbums(storedShowSystemAlbums !== "false");
          if (
            storedAlbumSort === "name" ||
            storedAlbumSort === "newest" ||
            storedAlbumSort === "count"
          )
            updateAlbumSort(storedAlbumSort);
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
        } finally {
          if (!cancelled) setReady(true);
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
  const setShowSystemAlbums = useCallback(
    (value: boolean) => {
      updateShowSystemAlbums(value);
      persist("showSystemAlbums", String(value));
    },
    [persist],
  );
  const setAlbumSort = useCallback(
    (value: AlbumSort) => {
      updateAlbumSort(value);
      persist("albumSort", value);
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
      ready,
      showSystemAlbums,
      albumSort,
      setShowSystemAlbums,
      setAlbumSort,
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
      ready,
      showSystemAlbums,
      albumSort,
      setShowSystemAlbums,
      setAlbumSort,
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
export const albumSortLabels: Record<AlbumSort, string> = {
  name: "Název",
  newest: "Nejnovější",
  count: "Počet položek",
};
