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
const store = {
  getHiddenMediaIds: async () => hidden,
  getExcludedMediaIds: async () => hidden,
  getHiddenMediaCount: async () => rows.length,
  getTrashedMediaCount: async () => rows.length,
  getMediaCountByAlbum: async () => rows.length,
  upsertBatch: async (items) => written.push(...items),
  getHiddenMedia: async (limit, offset) => rows.slice(offset, offset + limit),
  getTrashedMedia: async (limit, offset) => rows.slice(offset, offset + limit),
  getMediaItemsByAlbum: async (_id, limit, offset) =>
    rows.slice(offset, offset + limit),
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
    const first = await getMediaPage({ kind, id: "1" });
    const second = await getMediaPage({ kind, id: "1" }, first.cursor);
    const third = await getMediaPage({ kind, id: "1" }, second.cursor);
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
