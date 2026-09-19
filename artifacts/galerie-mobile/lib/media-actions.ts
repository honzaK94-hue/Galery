import { Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { mediaStore } from "@/db";
import { notifyLibraryChanged } from "@/db/changes";
import {
  deleteDeviceMedia,
  getDeviceMedia,
  isDeviceMediaAvailable,
  setDeviceFavorite,
  setDeviceTrashed,
  shareDeviceMedia,
} from "../modules/galerie-device";
import { identity, readMediaAsset } from "./media";
import { mediaOperation } from "./media-operation";

export type MediaActionResult = { completedIds: string[]; cancelled: boolean };

export function confirmDelete(count: number): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      "Smazat z telefonu?",
      `Trvale smazat ${count} položek z telefonu i ze všech alb? Tuto akci nelze vrátit.`,
      [
        { text: "Zrušit", style: "cancel", onPress: () => resolve(false) },
        { text: "Smazat", style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

export async function deleteMediaFromPhone(
  ids: string[],
): Promise<MediaActionResult> {
  const unique = [...new Set(ids)];
  if (!unique.length || !(await confirmDelete(unique.length)))
    return { completedIds: [], cancelled: true };
  return mediaOperation(async () => {
    const result = isDeviceMediaAvailable
      ? await deleteDeviceMedia(unique)
      : (await MediaLibrary.deleteAssetsAsync(unique))
        ? { completedIds: unique, cancelled: false }
        : { completedIds: [], cancelled: true };
    // Android may accept earlier chunks and cancel a later confirmation. Keep
    // metadata for every unconfirmed ID and remove only confirmed deletions.
    if (result.completedIds.length)
      await mediaStore.deleteByMediaIds(result.completedIds);
    return result;
  });
}

export async function deleteFromPhone(ids: string[]): Promise<boolean> {
  const result = await deleteMediaFromPhone(ids);
  return result.completedIds.length === new Set(ids).size && ids.length > 0;
}

export async function setMediaTrashed(
  ids: string[],
  trashed: boolean,
): Promise<MediaActionResult> {
  const unique = [...new Set(ids)];
  if (!unique.length) return { completedIds: [], cancelled: false };
  return mediaOperation(async () => {
    if (!isDeviceMediaAvailable) {
      if (!trashed) {
        const rows = await Promise.all(
          unique.map((id) => mediaStore.getMediaItemByMediaId(id)),
        );
        const completedIds = rows
          .filter((row) => row?.trashed_at != null && !row.native_trashed)
          .map((row) => row!.media_id);
        if (completedIds.length) {
          await mediaStore.setTrashedBatch(completedIds, false);
          return { completedIds, cancelled: false };
        }
      }
      throw new Error(
        "Systémový koš vyžaduje Android 11 nebo novější a aktuální APK Galerie.",
      );
    }
    // Preserve identities before Android removes them from ordinary queries.
    const before = await getDeviceMedia(unique);
    await mediaStore.upsertBatch(before.map(identity));
    const result = await setDeviceTrashed(unique, trashed);
    if (result.completedIds.length) {
      await mediaStore.syncNativeTrash(
        result.completedIds.map((id) => ({ id, isTrashed: trashed })),
      );
      if (!trashed) {
        // Explicit restore also releases the old v2 local-only trash marker.
        await mediaStore.setTrashedBatch(result.completedIds, false);
      }
    }
    return result;
  });
}

export async function setMediaFavorite(
  ids: string[],
  favorite: boolean,
): Promise<MediaActionResult> {
  const unique = [...new Set(ids)];
  if (!unique.length) return { completedIds: [], cancelled: false };
  if (!isDeviceMediaAvailable)
    throw new Error(
      "Oblíbené vyžadují Android 11 nebo novější a aktuální APK Galerie.",
    );
  return mediaOperation(async () => {
    const result = await setDeviceFavorite(unique, favorite);
    if (result.completedIds.length) notifyLibraryChanged();
    return result;
  });
}

export async function getMediaFavorite(id: string): Promise<boolean> {
  return (await readMediaAsset(id)).isFavorite;
}

export async function shareMedia(input: string | string[]): Promise<void> {
  const ids = [...new Set(Array.isArray(input) ? input : [input])];
  if (!ids.length) return;
  if (isDeviceMediaAvailable) {
    await shareDeviceMedia(ids);
    return;
  }
  if (ids.length > 1)
    throw new Error("Hromadné sdílení vyžaduje aktuální Android APK Galerie.");
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sdílení není na tomto zařízení dostupné.");
  const asset = await MediaLibrary.getAssetInfoAsync(ids[0]);
  if (!FileSystem.cacheDirectory)
    throw new Error("Dočasný adresář není dostupný.");
  const source =
    Platform.OS === "android"
      ? await MediaLibrary.getAssetContentUriAsync(ids[0])
      : (asset.localUri ?? asset.uri);
  const extension =
    asset.filename.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] ??
    (asset.mediaType === "video" ? ".mp4" : ".jpg");
  const copy = `${FileSystem.cacheDirectory}share-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
  try {
    await FileSystem.copyAsync({ from: source, to: copy });
    await Sharing.shareAsync(copy, {
      dialogTitle: "Sdílet médium",
      mimeType: asset.mediaType === "video" ? "video/*" : "image/*",
    });
  } finally {
    await FileSystem.deleteAsync(copy, { idempotent: true }).catch(() => {});
  }
}
