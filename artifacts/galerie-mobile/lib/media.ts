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
  kind: "photos" | "videos" | "native" | "album" | "hidden" | "trash";
  id?: string;
  albumType?: "normal" | "hidden";
  query?: string;
  sort?: "newest" | "oldest" | "name";
};
export type PageCursor = {
  after?: string;
  offset: number;
  orderedItems?: GalleryAsset[];
  dateMerge?: {
    fallbackItems: GalleryAsset[];
    fallbackIndex: number;
    nativeItems: GalleryAsset[];
    nativeAfter?: string;
    nativeDone: boolean;
    totalCount: number;
  };
};
export type MediaPage = {
  items: GalleryAsset[];
  cursor: PageCursor;
  hasMore: boolean;
  totalCount?: number;
};
export function fromAsset(asset: MediaLibrary.Asset): GalleryAsset {
  return {
    id: asset.id,
    uri: asset.uri,
    filename: asset.filename,
    mediaType: asset.mediaType === "video" ? "video" : "photo",
    width: asset.width,
    height: asset.height,
    creationTime:
      asset.creationTime > 0 ? asset.creationTime : asset.modificationTime,
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
  if (
    source.kind === "album" ||
    source.kind === "hidden" ||
    source.kind === "trash"
  ) {
    const options = { query: source.query, sort: source.sort };
    const rows =
      source.kind === "hidden"
        ? await mediaStore.getHiddenMedia(size + 1, cursor.offset, options)
        : source.kind === "trash"
          ? await mediaStore.getTrashedMedia(size + 1, cursor.offset, options)
          : await mediaStore.getMediaItemsByAlbum(
              Number(source.id),
              size + 1,
              cursor.offset,
              options,
            );
    const totalCount = source.query
      ? undefined
      : source.kind === "hidden"
        ? await mediaStore.getHiddenMediaCount()
        : source.kind === "trash"
          ? await mediaStore.getTrashedMediaCount()
          : await mediaStore.getMediaCountByAlbum(Number(source.id));
    return {
      items: rows.slice(0, size).map(fromRow),
      cursor: { offset: cursor.offset + size },
      hasMore: rows.length > size,
      totalCount,
    };
  }
  const hidden = await mediaStore.getExcludedMediaIds();
  const query = source.query?.trim().toLocaleLowerCase("cs-CZ");
  const visible = (asset: GalleryAsset) =>
    !hidden.has(asset.id) &&
    (!query || asset.filename.toLocaleLowerCase("cs-CZ").includes(query));
  // Android's media API cannot order by filename. Scan only lightweight metadata
  // for this explicitly selected sort, then retain it in this pagination session.
  if (source.sort === "name") {
    let orderedItems = cursor.orderedItems;
    if (!orderedItems) {
      orderedItems = [];
      let after: string | undefined;
      while (isCurrent()) {
        const page = await MediaLibrary.getAssetsAsync({
          first: 500,
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
        orderedItems.push(...assets.filter(visible));
        if (!page.hasNextPage) break;
        if (!page.endCursor || page.endCursor === after)
          throw new Error("Knihovnu se nepodařilo načíst.");
        after = page.endCursor;
      }
      if (!isCurrent()) return { items: [], cursor, hasMore: false };
      const collator = new Intl.Collator("cs-CZ", {
        numeric: true,
        sensitivity: "base",
      });
      orderedItems.sort(
        (a, b) =>
          collator.compare(a.filename, b.filename) || a.id.localeCompare(b.id),
      );
    }
    return {
      items: orderedItems
        .slice(cursor.offset, cursor.offset + size)
        .filter(visible),
      cursor: { offset: cursor.offset + size, orderedItems },
      hasMore: cursor.offset + size < orderedItems.length,
      totalCount: orderedItems.length,
    };
  }
  const ascending = source.sort === "oldest";
  const cancelled = (): MediaPage => ({ items: [], cursor, hasMore: false });
  const readNative = (
    first: number,
    after: string | undefined,
    oldest: boolean,
  ) =>
    MediaLibrary.getAssetsAsync({
      first,
      after,
      ...(source.kind === "native" ? { album: source.id } : {}),
      mediaType:
        source.kind === "photos"
          ? ["photo"]
          : source.kind === "videos"
            ? ["video"]
            : ["photo", "video"],
      sortBy: [[MediaLibrary.SortBy.creationTime, oldest]],
    });
  const state = cursor.dateMerge
    ? {
        ...cursor.dateMerge,
        nativeItems: cursor.dateMerge.nativeItems.filter(visible),
      }
    : {
        fallbackItems: [] as GalleryAsset[],
        fallbackIndex: 0,
        nativeItems: [] as GalleryAsset[],
        nativeAfter: undefined as string | undefined,
        nativeDone: false,
        totalCount: 0,
      };
  if (!cursor.dateMerge) {
    // Android DATE_TAKEN may be NULL/0. Those records sort first in ASC order.
    // Probe one record; scan only that missing-date prefix, never an ordinary
    // dated library. Their fallback dates can then merge globally with the
    // native capture-date stream without loading original images.
    let prefixAfter: string | undefined;
    let first = 1;
    while (isCurrent()) {
      const page = await readNative(first, prefixAfter, true);
      if (!isCurrent()) return cancelled();
      state.totalCount = page.totalCount;
      const missing = page.assets
        .filter((asset) => !(asset.creationTime > 0))
        .map(fromAsset);
      const captured = page.assets
        .filter((asset) => asset.creationTime > 0)
        .map(fromAsset);
      const reachedCaptured = captured.length > 0;
      const reuseCaptured = ascending || !page.hasNextPage;
      await mediaStore.upsertBatch(
        [...missing, ...(reuseCaptured ? captured : [])].map(identity),
        isCurrent,
      );
      if (!isCurrent()) return cancelled();
      state.fallbackItems.push(...missing.filter(visible));
      if (reachedCaptured || !page.hasNextPage) {
        if (reuseCaptured) {
          state.nativeItems = (
            ascending ? captured : captured.reverse()
          ).filter(visible);
          state.nativeAfter = page.endCursor;
          state.nativeDone = !page.hasNextPage;
        }
        break;
      }
      if (!page.endCursor || page.endCursor === prefixAfter)
        throw new Error("Knihovnu se nepodařilo načíst.");
      prefixAfter = page.endCursor;
      first = 500;
    }
    if (!isCurrent()) return cancelled();
    state.fallbackItems.sort(
      (a, b) =>
        (ascending
          ? a.creationTime - b.creationTime
          : b.creationTime - a.creationTime) || a.id.localeCompare(b.id),
    );
  }
  const items: GalleryAsset[] = [];
  let nativeReads = 0;
  while (items.length < size && isCurrent()) {
    while (
      state.fallbackIndex < state.fallbackItems.length &&
      !visible(state.fallbackItems[state.fallbackIndex])
    )
      state.fallbackIndex++;
    // Return a partial visible page promptly; the next call continues from the
    // cached merge head instead of scanning the rest of a sparse search result.
    if (
      items.length &&
      !state.nativeItems.length &&
      !state.nativeDone &&
      nativeReads > 0
    )
      break;
    while (!state.nativeItems.length && !state.nativeDone && isCurrent()) {
      const page = await readNative(size, state.nativeAfter, ascending);
      nativeReads++;
      if (!isCurrent()) return cancelled();
      await mediaStore.upsertBatch(
        page.assets.map(fromAsset).map(identity),
        isCurrent,
      );
      if (!isCurrent()) return cancelled();
      state.nativeItems = page.assets
        .filter((asset) => asset.creationTime > 0)
        .map(fromAsset)
        .filter(visible);
      // DESC has reached the already indexed missing-date tail. ASC starts
      // after that prefix, so only the normal end-of-page flag terminates it.
      state.nativeDone =
        !page.hasNextPage ||
        (!ascending && page.assets.some((asset) => !(asset.creationTime > 0)));
      if (
        !state.nativeDone &&
        (!page.endCursor || page.endCursor === state.nativeAfter)
      )
        throw new Error("Knihovnu se nepodařilo načíst.");
      state.nativeAfter = page.endCursor;
      state.totalCount = page.totalCount;
    }
    if (!isCurrent()) return cancelled();
    const fallback = state.fallbackItems[state.fallbackIndex];
    const captured = state.nativeItems[0];
    if (!fallback && !captured) break;
    if (
      fallback &&
      (!captured ||
        (ascending
          ? fallback.creationTime <= captured.creationTime
          : fallback.creationTime >= captured.creationTime))
    ) {
      items.push(fallback);
      state.fallbackIndex++;
    } else if (captured) {
      items.push(captured);
      state.nativeItems.shift();
    }
  }
  if (!isCurrent()) return cancelled();
  return {
    items,
    cursor: { offset: cursor.offset + items.length, dateMerge: state },
    hasMore:
      state.fallbackIndex < state.fallbackItems.length ||
      state.nativeItems.length > 0 ||
      !state.nativeDone,
    totalCount: !hidden.size && !query ? state.totalCount : undefined,
  };
}
