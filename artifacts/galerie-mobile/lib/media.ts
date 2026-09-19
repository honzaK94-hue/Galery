import * as MediaLibrary from "expo-media-library/legacy";
import { mediaStore, type MediaIdentity, type MediaItemRow } from "@/db";
import {
  getDeviceMedia,
  isDeviceMediaAvailable,
  queryDeviceMedia,
} from "../modules/galerie-device";

export type GalleryAsset = {
  id: string;
  uri: string;
  filename: string;
  mediaType: "photo" | "video";
  width: number;
  height: number;
  creationTime: number;
  duration: number;
  isFavorite?: boolean;
  isTrashed?: boolean;
  dateExpires?: number | null;
};
export type MediaSource = {
  kind:
    "photos" | "videos" | "native" | "album" | "hidden" | "trash" | "favorites";
  id?: string;
  albumType?: "normal" | "hidden";
  query?: string;
  sort?: "newest" | "oldest" | "name";
  includeHidden?: boolean;
};
export type PageCursor = {
  after?: string;
  offset: number;
  orderedItems?: GalleryAsset[];
  trashMerge?: {
    legacyItems: GalleryAsset[];
    legacyIndex: number;
    nativeItems: GalleryAsset[];
    nativeOffset: number;
    nativeDone: boolean;
    nativeTotal: number;
  };
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
export function fromAsset(
  asset: Pick<
    MediaLibrary.Asset,
    | "id"
    | "uri"
    | "filename"
    | "mediaType"
    | "width"
    | "height"
    | "creationTime"
    | "modificationTime"
    | "duration"
  >,
): GalleryAsset {
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
export type ResolvedMediaAsset = GalleryAsset & {
  localUri?: string;
  modificationTime: number;
  isFavorite: boolean;
  isTrashed: boolean;
  dateExpires: number | null;
};
export async function readMediaAsset(id: string): Promise<ResolvedMediaAsset> {
  if (isDeviceMediaAvailable) {
    const asset = (await getDeviceMedia([id]))[0];
    if (!asset) throw new Error("Médium již není dostupné.");
    return asset;
  }
  const asset = await MediaLibrary.getAssetInfoAsync(id);
  return {
    ...fromAsset(asset),
    localUri: asset.localUri,
    modificationTime: asset.modificationTime,
    isFavorite: !!asset.isFavorite,
    isTrashed: false,
    dateExpires: null,
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
  if (source.kind === "favorites") {
    if (!isDeviceMediaAvailable)
      throw new Error("Oblíbené vyžadují aktuální Android APK Galerie.");
    const excluded = await mediaStore.getExcludedMediaIds();
    const page = await queryDeviceMedia({
      kind: "favorites",
      offset: cursor.offset,
      limit: size,
      query: source.query,
      sort: source.sort,
      excludeIds: [...excluded],
    });
    if (!isCurrent()) return { items: [], cursor, hasMore: false };
    await mediaStore.upsertBatch(page.items.map(identity), isCurrent);
    return {
      items: page.items,
      cursor: { offset: page.nextOffset },
      hasMore: page.hasMore,
      totalCount: page.totalCount,
    };
  }
  if (source.kind === "trash" && isDeviceMediaAvailable) {
    return getTrashPage(source, cursor, isCurrent);
  }
  if (
    source.kind === "album" ||
    source.kind === "hidden" ||
    source.kind === "trash"
  ) {
    const options = {
      query: source.query,
      sort: source.sort,
      includeHidden: source.includeHidden === true,
    };
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
          ? await mediaStore.getTrashedMediaCount(options)
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

async function getTrashPage(
  source: MediaSource,
  cursor: PageCursor,
  isCurrent: () => boolean,
): Promise<MediaPage> {
  const hidden = source.includeHidden
    ? new Set<string>()
    : await mediaStore.getHiddenMediaIds();
  const options = { query: source.query, sort: source.sort };
  const compare = (a: GalleryAsset, b: GalleryAsset) => {
    if (source.sort === "name") {
      // MediaStore uses NOCASE order; do not use locale/numeric collation here
      // because both sides of a streaming merge must use the same ordering.
      const nameA = a.filename.replace(/[A-Z]/g, (char) => char.toLowerCase());
      const nameB = b.filename.replace(/[A-Z]/g, (char) => char.toLowerCase());
      if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    } else {
      const dates =
        source.sort === "oldest"
          ? a.creationTime - b.creationTime
          : b.creationTime - a.creationTime;
      if (dates) return dates;
    }
    return Number(b.id) - Number(a.id) || b.id.localeCompare(a.id);
  };
  const state = cursor.trashMerge
    ? { ...cursor.trashMerge, nativeItems: [...cursor.trashMerge.nativeItems] }
    : {
        legacyItems: (await mediaStore.getLegacyTrashedMedia(options))
          .filter((row) => !hidden.has(row.media_id))
          .map(fromRow)
          .sort(compare),
        legacyIndex: 0,
        nativeItems: [] as GalleryAsset[],
        nativeOffset: 0,
        nativeDone: false,
        nativeTotal: 0,
      };
  const excludeIds = [
    ...new Set([...hidden, ...state.legacyItems.map((item) => item.id)]),
  ];
  const items: GalleryAsset[] = [];
  while (items.length < 60 && isCurrent()) {
    while (!state.nativeItems.length && !state.nativeDone) {
      const page = await queryDeviceMedia({
        kind: "trash",
        offset: state.nativeOffset,
        limit: 60,
        query: source.query,
        sort: source.sort,
        excludeIds,
      });
      if (!isCurrent()) return { items: [], cursor, hasMore: false };
      await mediaStore.upsertBatch(page.items.map(identity), isCurrent);
      // Indexing another trash page must not invalidate and restart that same
      // pagination session. Actions/foreground reconciliation emit revisions.
      await mediaStore.syncNativeTrash(page.items, isCurrent, false);
      if (!isCurrent()) return { items: [], cursor, hasMore: false };
      state.nativeItems = page.items;
      state.nativeOffset = page.nextOffset;
      state.nativeDone = !page.hasMore;
      state.nativeTotal = page.totalCount;
    }
    const legacy = state.legacyItems[state.legacyIndex];
    const native = state.nativeItems[0];
    if (!legacy && !native) break;
    if (legacy && (!native || compare(legacy, native) <= 0)) {
      state.legacyIndex++;
      if (!hidden.has(legacy.id)) items.push(legacy);
    } else if (native) {
      state.nativeItems.shift();
      if (!hidden.has(native.id)) items.push(native);
    }
  }
  return {
    items,
    cursor: { offset: cursor.offset + items.length, trashMerge: state },
    hasMore:
      state.legacyIndex < state.legacyItems.length ||
      state.nativeItems.length > 0 ||
      !state.nativeDone,
    totalCount: state.nativeTotal + state.legacyItems.length,
  };
}
