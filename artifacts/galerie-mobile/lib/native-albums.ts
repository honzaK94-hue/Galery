import * as MediaLibrary from "expo-media-library/legacy";
import { mediaStore } from "@/db";
export type NativeAlbumDisplay = {
  album: MediaLibrary.Album;
  title: string;
  thumbUri?: string;
  thumbVideo?: boolean;
  count: number;
};
async function mapLimited<T, R>(
  items: T[],
  action: (item: T) => Promise<R>,
): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        result[index] = await action(items[index]);
      }
    }),
  );
  return result;
}
export async function getNativeAlbums(): Promise<NativeAlbumDisplay[]> {
  const [albums, hidden] = await Promise.all([
    MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true }),
    mediaStore.getHiddenMediaIds(),
  ]);
  const hiddenCounts = new Map<string, number>();
  let unknownAlbum = false;
  await mapLimited([...hidden], async (id) => {
    try {
      const asset = await MediaLibrary.getAssetInfoAsync(id);
      if (asset.albumId)
        hiddenCounts.set(
          asset.albumId,
          (hiddenCounts.get(asset.albumId) ?? 0) + 1,
        );
      else unknownAlbum = true;
    } catch {
      /* Inaccessible hidden media is absent from native queries too. */
    }
  });
  const result = await mapLimited(albums, async (album) => {
    let after: string | undefined;
    let count = 0;
    let cover: MediaLibrary.Asset | undefined;
    // Usually one query per album. Scan only where album membership is unknown.
    do {
      const page = await MediaLibrary.getAssetsAsync({
        album,
        first: unknownAlbum ? 500 : 30,
        after,
        mediaType: ["photo", "video"],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      const visible = page.assets.filter((asset) => !hidden.has(asset.id));
      cover ??= visible[0];
      if (unknownAlbum) count += visible.length;
      else
        count = Math.max(
          0,
          page.totalCount - (hiddenCounts.get(album.id) ?? 0),
        );
      if (!page.hasNextPage || (!unknownAlbum && (cover || count === 0))) break;
      if (!page.endCursor || page.endCursor === after)
        throw new Error("Alba se nepodařilo úplně načíst.");
      after = page.endCursor;
    } while (true);
    return {
      album,
      title: album.title,
      count,
      thumbUri: cover?.uri,
      thumbVideo: cover?.mediaType === "video",
    };
  });
  return result.filter((album) => album.count > 0);
}
