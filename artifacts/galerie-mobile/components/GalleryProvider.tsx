import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Alert, AppState, Platform } from "react-native";
import * as MediaLibrary from "expo-media-library/legacy";
import { useFocusEffect } from "expo-router";
import { mediaStore } from "@/db";
import { getLibraryRevision, subscribeLibrary } from "@/db/changes";
import { scanLibrary } from "@/lib/reconcile";
import { isExpoGo } from "./DevelopmentBuildRequired";
import {
  getDeviceMedia,
  isDeviceMediaAvailable,
} from "../modules/galerie-device";
import { identity } from "@/lib/media";
import {
  getMediaOperationRevision,
  isMediaOperationPending,
  subscribeMediaOperations,
} from "@/lib/media-operation";

type GalleryContextValue = {
  permission: MediaLibrary.PermissionResponse | null;
  requestPermission: () => Promise<void>;
  refreshPermission: () => Promise<void>;
  chooseMedia: () => Promise<void>;
  refreshLibrary: () => void;
  revision: number;
  ready: boolean;
  error: string | null;
  selectionActive: boolean;
  setSelectionActive: (value: boolean) => void;
};
const GalleryContext = createContext<GalleryContextValue | null>(null);
export function GalleryProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] =
    useState<MediaLibrary.PermissionResponse | null>(null);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionActive, setSelectionActive] = useState(false);
  const generation = useRef(0);
  const permissionRequest = useRef(0);
  const mounted = useRef(true);
  const dbRevision = useSyncExternalStore(
    subscribeLibrary,
    getLibraryRevision,
    getLibraryRevision,
  );
  const supported = Platform.OS !== "web" && !isExpoGo;
  const refreshLibrary = useCallback(() => {
    generation.current++;
    setReady(false);
    setVersion((v) => v + 1);
  }, []);
  const refreshPermission = useCallback(async () => {
    if (!supported || isMediaOperationPending()) return;
    const currentRequest = ++permissionRequest.current;
    try {
      const next = await MediaLibrary.getPermissionsAsync(false, [
        "photo",
        "video",
      ]);
      if (!mounted.current || currentRequest !== permissionRequest.current)
        return;
      if (isMediaOperationPending()) return;
      setPermission(next);
      setError(null);
      refreshLibrary();
    } catch {
      if (mounted.current && currentRequest === permissionRequest.current) {
        generation.current++;
        setPermission(null);
        setReady(false);
        setError("Nepodařilo se ověřit přístup k médiím. Zkuste to znovu.");
      }
    }
  }, [supported, refreshLibrary]);
  const requestPermission = useCallback(async () => {
    if (!supported) return;
    try {
      await MediaLibrary.requestPermissionsAsync(false, ["photo", "video"]);
      await refreshPermission();
    } catch {
      if (mounted.current)
        setError("Žádost o přístup se nepodařila. Zkuste nastavení telefonu.");
    }
  }, [supported, refreshPermission]);
  const chooseMedia = useCallback(async () => {
    try {
      await MediaLibrary.presentPermissionsPickerAsync(["photo", "video"]);
    } catch {
      Alert.alert(
        "Změna přístupu",
        "Výběr médií není dostupný. Změňte oprávnění v nastavení telefonu.",
      );
    }
    await refreshPermission();
  }, [refreshPermission]);
  useEffect(() => {
    mounted.current = true;
    void refreshPermission();
    if (!supported)
      return () => {
        mounted.current = false;
      };
    const app = AppState.addEventListener("change", (state) => {
      generation.current++;
      if (state === "active") void refreshPermission();
    });
    const unsubscribeOperation = subscribeMediaOperations(() => {
      generation.current++;
      permissionRequest.current++;
      if (!isMediaOperationPending() && AppState.currentState === "active")
        void refreshPermission();
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const media = MediaLibrary.addListener(() => {
      generation.current++;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void refreshPermission();
      }, 400);
    });
    return () => {
      mounted.current = false;
      generation.current++;
      app.remove();
      media.remove();
      unsubscribeOperation();
      clearTimeout(timer);
    };
  }, [supported, refreshPermission]);
  useEffect(() => {
    if (
      !supported ||
      !permission ||
      (!permission.granted && permission.accessPrivileges !== "limited")
    )
      return;
    const current = generation.current;
    const operationRevision = getMediaOperationRevision();
    let cancelled = false;
    const isCurrent = () =>
      !cancelled &&
      mounted.current &&
      generation.current === current &&
      !isMediaOperationPending() &&
      getMediaOperationRevision() === operationRevision;
    void (async () => {
      try {
        const knownIds = new Set(await mediaStore.getAllMediaIds());
        if (!isCurrent()) return;
        if (!knownIds.size) {
          setReady(true);
          setError(null);
          return;
        }
        if (isDeviceMediaAvailable) {
          // Ordinary MediaLibrary pages omit system trash. Query the known IDs
          // including trash before deciding whether a relationship is orphaned.
          const before = await MediaLibrary.getPermissionsAsync(false, [
            "photo",
            "video",
          ]);
          if (
            (!before.granted && before.accessPrivileges !== "limited") ||
            !isCurrent()
          )
            return;
          const ids = [...knownIds];
          const assets = [] as Awaited<ReturnType<typeof getDeviceMedia>>;
          for (let offset = 0; offset < ids.length; offset += 500) {
            assets.push(
              ...(await getDeviceMedia(ids.slice(offset, offset + 500))),
            );
            if (!isCurrent()) return;
          }
          const after = await MediaLibrary.getPermissionsAsync(false, [
            "photo",
            "video",
          ]);
          if (
            !isCurrent() ||
            before.granted !== after.granted ||
            before.accessPrivileges !== after.accessPrivileges
          )
            return;
          await mediaStore.upsertBatch(assets.map(identity), isCurrent);
          await mediaStore.syncNativeTrash(assets, isCurrent);
          await mediaStore.reconcile(
            new Set(assets.map((asset) => asset.id)),
            after.granted &&
              after.accessPrivileges !== "limited" &&
              after.accessPrivileges !== "none",
            isCurrent,
            knownIds,
          );
          if (isCurrent()) {
            setReady(true);
            setError(null);
          }
          return;
        }
        const snapshot = await scanLibrary({
          requiredIds: knownIds,
          getPermission: () =>
            MediaLibrary.getPermissionsAsync(false, ["photo", "video"]),
          getPage: (after) =>
            MediaLibrary.getAssetsAsync({
              first: 500,
              after,
              mediaType: ["photo", "video"],
              sortBy: [[MediaLibrary.SortBy.creationTime, false]],
            }),
          isCurrent,
        });
        if (!snapshot || !isCurrent()) return;
        // An older APK without our module cannot query Android system trash.
        // Preserve those identities until a capable build can verify them.
        for (const id of await mediaStore.getSystemTrashedMediaIds())
          snapshot.ids.add(id);
        if (!isCurrent()) return;
        await mediaStore.reconcile(
          snapshot.ids,
          snapshot.canPrune,
          isCurrent,
          knownIds,
        );
        if (isCurrent()) {
          setReady(true);
          setError(null);
        }
      } catch {
        if (isCurrent())
          setError(
            "Knihovnu se nepodařilo obnovit. Uložená alba zůstala zachována.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, permission, version]);
  const value = useMemo(
    () => ({
      permission,
      requestPermission,
      refreshPermission,
      chooseMedia,
      refreshLibrary,
      revision: version + dbRevision,
      ready,
      error,
      selectionActive,
      setSelectionActive,
    }),
    [
      permission,
      requestPermission,
      refreshPermission,
      chooseMedia,
      refreshLibrary,
      version,
      dbRevision,
      ready,
      error,
      selectionActive,
    ],
  );
  return (
    <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>
  );
}
export function useGallery(): GalleryContextValue {
  const context = useContext(GalleryContext);
  if (!context) throw new Error("GalleryProvider chybí.");
  return context;
}
export function useLibraryFocus(action: () => void | Promise<void>): void {
  const { revision, ready } = useGallery();
  const actionRef = useRef(action);
  actionRef.current = action;
  useFocusEffect(
    useCallback(() => {
      void actionRef.current();
    }, [revision, ready]),
  );
}
