import * as MediaLibrary from "expo-media-library/legacy";
import { mediaStore, type MediaIdentity, type MediaItemRow } from "@/db";

export type GalleryAsset = {
  id: string;
  uri: string;
  filename: string;
  mediaType: "photo" | "video";
  width: number;
  height: number;
  creationTime: number;
  duration: number;
};
export type MediaSource = {
  kind: "photos" | "videos" | "native" | "album" | "hidden";
  id?: string;
};
export type PageCursor = { after?: string; offset: number };
export type MediaPage = {
  items: GalleryAsset[];
  cursor: PageCursor;
  hasMore: boolean;
};
export function fromAsset(asset: MediaLibrary.Asset): GalleryAsset {
  return {
    id: asset.id,
    uri: asset.uri,
    filename: asset.filename,
    mediaType: asset.mediaType === "video" ? "video" : "photo",
    width: asset.width,
    height: asset.height,
    creationTime: asset.creationTime,
    duration: asset.duration,
  };
}
export function fromRow(row: MediaItemRow): GalleryAsset {
  return {
    id: row.media_id,
    uri: row.uri,
    filename: row.filename ?? "",
    mediaType: row.media_type,
    width: row.width ?? 0,
    height: row.height ?? 0,
    creationTime: row.creation_time ?? 0,
    duration: row.duration ?? 0,
  };
}
export function identity(asset: GalleryAsset): MediaIdentity {
  return {
    mediaId: asset.id,
    uri: asset.uri,
    filename: asset.filename,
    mediaType: asset.mediaType,
    width: asset.width,
    height: asset.height,
    creationTime: asset.creationTime,
    duration: asset.duration,
  };
}
export async function getMediaPage(
  source: MediaSource,
  cursor: PageCursor = { offset: 0 },
  isCurrent = () => true,
): Promise<MediaPage> {
  const size = 60;
  if (source.kind === "album" || source.kind === "hidden") {
    const rows =
      source.kind === "hidden"
        ? await mediaStore.getHiddenMedia(size + 1, cursor.offset)
        : await mediaStore.getMediaItemsByAlbum(
            Number(source.id),
            size + 1,
            cursor.offset,
          );
    return {
      items: rows.slice(0, size).map(fromRow),
      cursor: { offset: cursor.offset + size },
      hasMore: rows.length > size,
    };
  }
  const hidden = await mediaStore.getHiddenMediaIds();
  let after = cursor.after;
  let hasMore = true;
  let items: GalleryAsset[] = [];
  // Continue over fully hidden pages rather than displaying a false empty state.
  while (hasMore && items.length === 0 && isCurrent()) {
    const page = await MediaLibrary.getAssetsAsync({
      first: size,
      after,
      ...(source.kind === "native" ? { album: source.id } : {}),
      mediaType:
        source.kind === "photos"
          ? ["photo"]
          : source.kind === "videos"
            ? ["video"]
            : ["photo", "video"],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    if (!isCurrent()) return { items: [], cursor, hasMore: false };
    const assets = page.assets.map(fromAsset);
    await mediaStore.upsertBatch(assets.map(identity), isCurrent);
    items = assets.filter((item) => !hidden.has(item.id));
    if (page.hasNextPage && page.endCursor === after)
      throw new Error("Knihovnu se nepodařilo načíst.");
    after = page.endCursor;
    hasMore = page.hasNextPage;
  }
  return {
    items,
    cursor: { after, offset: cursor.offset + items.length },
    hasMore,
  };
}
