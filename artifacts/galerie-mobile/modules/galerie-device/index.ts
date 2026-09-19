import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export type DeviceMediaAsset = {
  id: string;
  uri: string;
  filename: string;
  mediaType: "photo" | "video";
  width: number;
  height: number;
  creationTime: number;
  modificationTime: number;
  duration: number;
  isFavorite: boolean;
  isTrashed: boolean;
  /** Android's scheduled trash expiry, in milliseconds since the epoch. */
  dateExpires: number | null;
};
export type DeviceMediaQuery = {
  kind: "all" | "trash" | "favorites";
  offset?: number;
  limit?: number;
  query?: string;
  sort?: "newest" | "oldest" | "name";
  ids?: string[];
  excludeIds?: string[];
};
export type DeviceMediaPage = {
  items: DeviceMediaAsset[];
  hasMore: boolean;
  nextOffset: number;
  totalCount: number;
};
export type DeviceMutationResult = {
  /** Includes only existing items whose requested operation has completed. */
  completedIds: string[];
  /** Earlier batches may have completed before cancellation. */
  cancelled: boolean;
};
type GalerieDeviceNative = {
  queryMedia(options: DeviceMediaQuery): Promise<DeviceMediaPage>;
  getMedia(ids: string[]): Promise<DeviceMediaAsset[]>;
  setTrashed(ids: string[], value: boolean): Promise<DeviceMutationResult>;
  setFavorite(ids: string[], value: boolean): Promise<DeviceMutationResult>;
  deleteMedia(ids: string[]): Promise<DeviceMutationResult>;
  shareMedia(ids: string[]): Promise<void>;
  setSecureScreen(value: boolean): Promise<void>;
};

const native =
  requireOptionalNativeModule<GalerieDeviceNative>("GalerieDevice");
export const isDeviceMediaAvailable =
  Platform.OS === "android" &&
  Number(Platform.Version) >= 30 &&
  native !== null;

function device(): GalerieDeviceNative {
  if (!isDeviceMediaAvailable || !native)
    throw new Error(
      "Tato funkce vyžaduje novou samostatnou APK Galerie a Android 11 nebo novější.",
    );
  return native;
}

export const queryDeviceMedia = (options: DeviceMediaQuery) =>
  device().queryMedia(options);
export const getDeviceMedia = (ids: string[]) => device().getMedia(ids);
export const setDeviceTrashed = (ids: string[], value: boolean) =>
  device().setTrashed(ids, value);
export const setDeviceFavorite = (ids: string[], value: boolean) =>
  device().setFavorite(ids, value);
export const deleteDeviceMedia = (ids: string[]) => device().deleteMedia(ids);
export const shareDeviceMedia = (ids: string[]) => device().shareMedia(ids);
export const setSecureScreen = (value: boolean) =>
  native ? native.setSecureScreen(value) : Promise.resolve();
