const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    }).outputText,
    filename,
  );
let hidden = new Set();
let pages = [];
let calls = [];
let written = [];
let rows = [];
let nativeAlbums = [];
let infos = {};
let sourceAssets = null;
let deviceEnabled = false;
let deviceAssets = [];
let deviceCalls = [];
const store = {
  getHiddenMediaIds: async () => hidden,
  getExcludedMediaIds: async () => hidden,
  getHiddenMediaCount: async () => rows.length,
  getTrashedMediaCount: async (options) =>
    rows.filter((row) => options?.includeHidden || !row.is_hidden).length,
  getMediaCountByAlbum: async () => rows.length,
  upsertBatch: async (items) => written.push(...items),
  getHiddenMedia: async (limit, offset) => rows.slice(offset, offset + limit),
  getTrashedMedia: async (limit, offset, options) =>
    rows
      .filter((row) => options?.includeHidden || !row.is_hidden)
      .slice(offset, offset + limit),
  getLegacyTrashedMedia: async () => rows,
  syncNativeTrash: async () => {},
  getMediaItemsByAlbum: async (_id, limit, offset) =>
    rows.slice(offset, offset + limit),
};
const deviceMedia = {
  get isDeviceMediaAvailable() {
    return deviceEnabled;
  },
  getDeviceMedia: async (ids) =>
    deviceAssets.filter((item) => ids.includes(item.id)),
  queryDeviceMedia: async (options) => {
    deviceCalls.push(options);
    const filtered = deviceAssets.filter(
      (item) =>
        (options.kind === "trash"
          ? item.isTrashed
          : item.isFavorite && !item.isTrashed) &&
        !options.excludeIds?.includes(item.id) &&
        (!options.query || item.filename.includes(options.query)),
    );
    filtered.sort((a, b) =>
      options.sort === "oldest"
        ? a.creationTime - b.creationTime
        : b.creationTime - a.creationTime,
    );
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 60;
    return {
      items: filtered.slice(offset, offset + limit),
      totalCount: filtered.length,
      nextOffset: offset + limit,
      hasMore: offset + limit < filtered.length,
    };
  },
};
const mediaLibrary = {
  SortBy: { creationTime: "creationTime" },
  getAssetsAsync: async (options) => {
    calls.push(options);
    if (sourceAssets) {
      const ascending = options.sortBy[0][1];
      const scoped = sourceAssets.filter(
        (item) =>
          options.mediaType.includes(item.mediaType) &&
          (!options.album || item.albumId === options.album),
      );
      scoped.sort(
        (a, b) =>
          (ascending
            ? a.creationTime - b.creationTime
            : b.creationTime - a.creationTime) || a.id.localeCompare(b.id),
      );
      const start = Number(options.after || 0);
      const end = Math.min(scoped.length, start + options.first);
      return {
        assets: scoped.slice(start, end),
        hasNextPage: end < scoped.length,
        endCursor: String(end),
        totalCount: scoped.length,
      };
    }
    const result = pages.shift();
    if (!result) throw new Error("unexpected page");
    return result;
  },
  getAlbumsAsync: async () => nativeAlbums,
  getAssetInfoAsync: async (id) => {
    if (!infos[id]) throw new Error("missing");
    return infos[id];
  },
};
const original = Module._load;
Module._load = function (name, ...rest) {
  if (name === "expo-media-library/legacy") return mediaLibrary;
  if (name === "@/db") return { mediaStore: store };
  if (name === "../modules/galerie-device") return deviceMedia;
  return original.call(this, name, ...rest);
};
const { getMediaPage } = require("../lib/media.ts");
const { getNativeAlbums } = require("../lib/native-albums.ts");
Module._load = original;
const asset = (id, mediaType = "photo") => ({
  id,
  uri: `file:///${id}`,
  filename: id,
  mediaType,
  width: 100,
  height: 100,
  duration: 0,
  creationTime: 1,
});
const page = (ids, hasNextPage = false, endCursor = ids.at(-1) ?? "empty") => ({
  assets: ids.map((id) => asset(id)),
  hasNextPage,
  endCursor,
  totalCount: ids.length,
});
test.beforeEach(() => {
  hidden = new Set();
  pages = [];
  calls = [];
  written = [];
  rows = [];
  nativeAlbums = [];
  infos = {};
  sourceAssets = null;
  deviceEnabled = false;
  deviceAssets = [];
  deviceCalls = [];
});

test("Android favorites exclude hidden/local trash and reflect external favorite changes", async () => {
  deviceEnabled = true;
  hidden = new Set(["private", "local-trash"]);
  deviceAssets = ["private", "local-trash", "visible", "system-trash"].map(
    (id) => ({
      ...asset(id),
      isFavorite: true,
      isTrashed: id === "system-trash",
    }),
  );
  assert.deepEqual(
    (await getMediaPage({ kind: "favorites" })).items.map((item) => item.id),
    ["visible"],
  );
  deviceAssets.find((item) => item.id === "visible").isFavorite = false;
  assert.equal((await getMediaPage({ kind: "favorites" })).totalCount, 0);
  assert.deepEqual(deviceCalls[0].excludeIds, ["private", "local-trash"]);
});

test("system and legacy trash merge across pages in order without hidden leaks", async () => {
  deviceEnabled = true;
  hidden = new Set(["99", "120"]);
  deviceAssets = Array.from({ length: 100 }, (_, index) => ({
    ...asset(String(index)),
    creationTime: index * 2,
    isTrashed: true,
  }));
  rows = Array.from({ length: 30 }, (_, index) => ({
    media_id: String(100 + index),
    uri: "content://media/legacy",
    filename: `legacy-${index}`,
    media_type: "photo",
    creation_time: index * 2 + 1,
  }));
  const collected = [];
  let cursor;
  let hasMore = true;
  while (hasMore) {
    const page = await getMediaPage({ kind: "trash" }, cursor);
    assert.equal(page.totalCount, 128);
    collected.push(...page.items);
    cursor = page.cursor;
    hasMore = page.hasMore;
  }
  assert.equal(collected.length, 128);
  assert.equal(new Set(collected.map((item) => item.id)).size, 128);
  assert.ok(collected.every((item) => !hidden.has(item.id)));
  assert.deepEqual(
    collected.map((item) => item.creationTime),
    collected.map((item) => item.creationTime).sort((a, b) => b - a),
  );
});
test("normal pages skip completely hidden pages and retain pagination", async () => {
  hidden = new Set(["hidden"]);
  pages = [
    page(["hidden"], true, "probe"),
    page(["hidden"], true),
    page(["visible"], true),
  ];
  const result = await getMediaPage({ kind: "photos" });
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["visible"],
  );
  assert.equal(result.hasMore, true);
  assert.equal(calls[2].after, "hidden");
  assert.deepEqual(calls[0].mediaType, ["photo"]);
  assert.equal(written.length, 2);
});
test("video and native album queries request correct scope and exclude hidden IDs", async () => {
  pages = [page(["v"])];
  await getMediaPage({ kind: "videos" });
  assert.deepEqual(calls[0].mediaType, ["video"]);
  hidden = new Set(["secret"]);
  pages = [page(["secret", "p"])];
  const result = await getMediaPage({ kind: "native", id: "42" });
  assert.equal(calls[1].album, "42");
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["p"],
  );
});
test("permission invalidation during native load prevents SQLite upsert", async () => {
  pages = [page(["p"])];
  let checks = 0;
  const result = await getMediaPage(
    { kind: "photos" },
    { offset: 0 },
    () => ++checks === 1,
  );
  assert.equal(written.length, 0);
  assert.equal(result.items.length, 0);
});
test("hidden, trash and custom album pages use lookahead without duplicates", async () => {
  rows = Array.from({ length: 121 }, (_, index) => ({
    id: index,
    media_id: String(index),
    media_type: "photo",
    uri: "file:///a",
    filename: "a",
    is_hidden: 1,
    is_available: 1,
  }));
  for (const kind of ["hidden", "album", "trash"]) {
    const first = await getMediaPage({ kind, id: "1", includeHidden: true });
    const second = await getMediaPage(
      { kind, id: "1", includeHidden: true },
      first.cursor,
    );
    const third = await getMediaPage(
      { kind, id: "1", includeHidden: true },
      second.cursor,
    );
    assert.equal(first.items.length, 60);
    assert.equal(second.items.length, 60);
    assert.equal(third.items.length, 1);
    assert.equal(third.hasMore, false);
    assert.equal(
      new Set(
        [...first.items, ...second.items, ...third.items].map(
          (item) => item.id,
        ),
      ).size,
      121,
    );
  }
});

test("legacy trash filters hidden media before pagination and counts unless explicitly unlocked", async () => {
  rows = Array.from({ length: 130 }, (_, index) => ({
    media_id: String(index + 1),
    media_type: "photo",
    uri: "content://media/item",
    filename: "photo.jpg",
    is_hidden: index % 2,
  }));
  for (const includeHidden of [false, true]) {
    const collected = [];
    let cursor;
    let hasMore = true;
    while (hasMore) {
      const page = await getMediaPage({ kind: "trash", includeHidden }, cursor);
      assert.equal(page.totalCount, includeHidden ? 130 : 65);
      collected.push(...page.items);
      cursor = page.cursor;
      hasMore = page.hasMore;
    }
    assert.equal(
      new Set(collected.map((item) => item.id)).size,
      includeHidden ? 130 : 65,
    );
    if (!includeHidden)
      assert.ok(collected.every((item) => Number(item.id) % 2 === 1));
  }
  assert.equal((await getMediaPage({ kind: "trash" })).totalCount, 65);
});
test("native cover and count exclude hidden media, including fully hidden cover pages", async () => {
  nativeAlbums = [{ id: "album", title: "Camera", assetCount: 3 }];
  hidden = new Set(["h1", "h2"]);
  infos = { h1: { albumId: "album" }, h2: { albumId: "album" } };
  pages = [
    { ...page(["h1", "h2"], true), totalCount: 3 },
    { ...page(["visible"]), totalCount: 3 },
  ];
  const result = await getNativeAlbums();
  assert.equal(result[0].count, 1);
  assert.equal(result[0].thumbUri, "file:///visible");
  assert.equal(calls.length, 2);
});
test("native albums containing only hidden media disappear", async () => {
  nativeAlbums = [{ id: "album", title: "Camera", assetCount: 1 }];
  hidden = new Set(["h"]);
  infos = { h: { albumId: "album" } };
  pages = [page(["h"])];
  assert.deepEqual(await getNativeAlbums(), []);
});

test("fallback dates merge globally across pages in both directions without duplicates", async () => {
  sourceAssets = Array.from({ length: 650 }, (_, index) => ({
    ...asset(`capture-${index}`),
    creationTime: (index + 1) * 1000,
    modificationTime: 1,
  }));
  sourceAssets.push(
    ...[500, 30500, 99500, 680000].map((date, index) => ({
      ...asset(`fallback-${index}`),
      creationTime: 0,
      modificationTime: date,
    })),
  );
  for (const sort of ["newest", "oldest"]) {
    calls = [];
    let cursor = { offset: 0 };
    let more = true;
    const all = [];
    while (more) {
      const page = await getMediaPage({ kind: "photos", sort }, cursor);
      assert.ok(page.items.length <= 60);
      all.push(...page.items);
      cursor = page.cursor;
      more = page.hasMore;
    }
    assert.equal(all.length, sourceAssets.length);
    assert.equal(new Set(all.map((item) => item.id)).size, sourceAssets.length);
    const expected = sourceAssets
      .map((item) => item.creationTime || item.modificationTime)
      .sort((a, b) => (sort === "oldest" ? a - b : b - a));
    assert.deepEqual(
      all.map((item) => item.creationTime),
      expected,
    );
    // The missing-date prefix is cached rather than scanned for each page.
    assert.equal(calls.filter((call) => call.first === 1).length, 1);
  }
});

test("dated libraries need one metadata probe, while fallback search respects native scope and hidden IDs", async () => {
  sourceAssets = Array.from({ length: 2000 }, (_, index) => ({
    ...asset(`p-${index}`),
    creationTime: index + 1,
  }));
  const first = await getMediaPage({ kind: "photos" });
  assert.equal(first.items.length, 60);
  assert.deepEqual(
    calls.map((call) => call.first),
    [1, 60],
  );
  calls = [];
  hidden = new Set(["excluded"]);
  sourceAssets = [
    { ...asset("find-captured", "video"), albumId: "a", creationTime: 100 },
    {
      ...asset("find-fallback", "video"),
      albumId: "a",
      creationTime: 0,
      modificationTime: 200,
    },
    {
      ...asset("excluded", "video"),
      albumId: "a",
      filename: "find-excluded",
      creationTime: 0,
      modificationTime: 300,
    },
    {
      ...asset("outside", "video"),
      albumId: "b",
      filename: "find-outside",
      creationTime: 0,
      modificationTime: 400,
    },
    {
      ...asset("unmatched", "video"),
      albumId: "a",
      creationTime: 0,
      modificationTime: 500,
    },
  ];
  const native = await getMediaPage({ kind: "native", id: "a", query: "find" });
  assert.deepEqual(
    native.items.map((item) => item.id),
    ["find-fallback", "find-captured"],
  );
  assert.equal(native.hasMore, false);
  assert.ok(calls.every((call) => call.album === "a"));
  const video = await getMediaPage({ kind: "videos", query: "find" });
  assert.deepEqual(
    video.items.map((item) => item.id),
    ["outside", "find-fallback", "find-captured"],
  );
});
