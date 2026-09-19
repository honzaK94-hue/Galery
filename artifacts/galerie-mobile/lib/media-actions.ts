import { Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { mediaStore } from "@/db";
import { deleteMedia } from "./delete-media";

export function confirmDelete(count: number): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      "Smazat z telefonu?",
      `Trvale smazat ${count} položek z telefonu i ze všech alb?`,
      [
        { text: "Zrušit", style: "cancel", onPress: () => resolve(false) },
        { text: "Smazat", style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export async function deleteFromPhone(ids: string[]): Promise<boolean> {
  if (!(await confirmDelete(ids.length))) return false;
  return deleteMedia(
    ids,
    (unique) => MediaLibrary.deleteAssetsAsync(unique),
    (unique) => mediaStore.deleteByMediaIds(unique),
  );
}
export async function shareMedia(id: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sdílení není na tomto zařízení dostupné.");
  const asset = await MediaLibrary.getAssetInfoAsync(id);
  if (!FileSystem.cacheDirectory)
    throw new Error("Dočasný adresář není dostupný.");
  const source =
    Platform.OS === "android"
      ? await MediaLibrary.getAssetContentUriAsync(id)
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
