const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
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
const { initDatabase, SCHEMA_SQL } = require("../db/schema.ts");
const { MediaStore } = require("../db/stores/media-store.ts");
const { AlbumStore } = require("../db/stores/album-store.ts");
const { SettingsStore } = require("../db/stores/settings-store.ts");
const { scanLibrary } = require("../lib/reconcile.ts");
const { deleteMedia } = require("../lib/delete-media.ts");
const { mediaRoute } = require("../lib/viewer-session.ts");

function adapter(filename = ":memory:") {
  const raw = new DatabaseSync(filename);
  return {
    raw,
    close: () => raw.close(),
    execAsync: async (sql) => raw.exec(sql),
    runAsync: async (sql, params = []) => {
      const result = raw.prepare(sql).run(...params);
      return {
        changes: result.changes,
        lastInsertRowId: result.lastInsertRowid,
      };
    },
    getFirstAsync: async (sql, params = []) =>
      raw.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql, params = []) => raw.prepare(sql).all(...params),
    withTransactionAsync: async (action) => {
      raw.exec("BEGIN");
      try {
        await action();
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
async function fixture(t, filename) {
  const db = adapter(filename);
  t.after(() => db.close());
  await initDatabase(db);
  const media = new MediaStore();
  const albums = new AlbumStore();
  media.setDatabase(db);
  albums.setDatabase(db);
  return { db, media, albums };
}
const item = (mediaId, time = 1, mediaType = "photo") => ({
  mediaId,
  uri: `file:///${mediaId}.jpg`,
  filename: `${mediaId}.jpg`,
  mediaType,
  creationTime: time,
  width: 100,
  height: 100,
});
async function seed(media, albums, ids = ["a", "b"]) {
  await media.upsertBatch(ids.map((id, index) => item(id, index)));
  const album = await albums.createAlbum("Test");
  const rows = await media.getMediaItemIdsByMediaIds(ids);
  await albums.addMediaBatchToAlbum([...rows.values()], album.id);
  return { album, rows };
}
test("migration merges duplicate IDs, preserves all album links and hidden state; rerun is safe", async (t) => {
  const db = adapter();
  t.after(() => db.close());
  await db.execAsync(SCHEMA_SQL);
  await db.execAsync(`INSERT INTO albums(id,name) VALUES(1,'One'),(2,'Two');
    INSERT INTO media_items(id,media_id,uri,filename,is_hidden) VALUES(1,'same','file:///a','old',0),(2,'same','file:///a','new',1);
    INSERT INTO media_albums(media_item_id,album_id) VALUES(1,1),(2,2);`);
  await initDatabase(db);
  await initDatabase(db);
  assert.equal((await db.getAllAsync("SELECT * FROM media_items")).length, 1);
  assert.equal(
    (await db.getFirstAsync("SELECT * FROM media_items")).is_hidden,
    1,
  );
  assert.equal(
    (await db.getAllAsync("SELECT * FROM media_albums WHERE media_item_id=1"))
      .length,
    2,
  );
  assert.equal((await db.getFirstAsync("PRAGMA user_version")).user_version, 3);
  assert.deepEqual(await db.getAllAsync("PRAGMA foreign_key_check"), []);
});

test("v1 migration retains albums and settings, repairs hidden membership, and initializes local trash", async (t) => {
  const db = adapter();
  t.after(() => db.close());
  await db.execAsync(SCHEMA_SQL);
  await db.execAsync(`
    ALTER TABLE media_items ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1;
    CREATE UNIQUE INDEX idx_media_identity ON media_items(media_id);
    INSERT INTO albums(id,name,type) VALUES(1,'Normal','normal'),(2,'Private','hidden');
    INSERT INTO media_items(id,media_id,uri,filename) VALUES(1,'a','file:///a','a.jpg');
    INSERT INTO media_albums(media_item_id,album_id) VALUES(1,1),(1,2);
    INSERT INTO app_settings(key,value) VALUES('density','comfortable');
    PRAGMA user_version=1;
  `);
  await initDatabase(db);
  await initDatabase(db);
  const row = await db.getFirstAsync("SELECT * FROM media_items");
  assert.equal(row.is_hidden, 1);
  assert.equal(row.trashed_at, null);
  assert.equal((await db.getAllAsync("SELECT * FROM media_albums")).length, 2);
  assert.equal(
    (
      await db.getFirstAsync(
        "SELECT value FROM app_settings WHERE key='density'",
      )
    ).value,
    "comfortable",
  );
  assert.equal((await db.getFirstAsync("PRAGMA user_version")).user_version, 3);
  assert.deepEqual(await db.getAllAsync("PRAGMA foreign_key_check"), []);
});

test("hidden album lifecycle protects phone media and explicit unhide retains only normal memberships", async (t) => {
  const { media, albums } = await fixture(t);
  const { album: normal, rows } = await seed(media, albums);
  const hidden = await albums.createAlbum("Private", "hidden");
  assert.deepEqual(
    await albums.addMediaBatchToAlbum([...rows.values()], hidden.id),
    {
      added: 2,
      alreadyPresent: 0,
      failed: 0,
    },
  );
  assert.equal((await albums.getAlbums("normal"))[0].photo_count, 0);
  assert.equal((await albums.getAlbums("hidden"))[0].photo_count, 2);
  assert.equal((await albums.getAlbums("hidden"))[0].cover_media_id, "b");
  assert.equal((await media.getMediaItemsByAlbum(hidden.id)).length, 2);
  assert.equal(await media.getMediaCountByAlbum(hidden.id), 2);
  assert.equal(await media.getHiddenMediaCount(), 2);
  assert.deepEqual(
    await media.getHiddenAlbumMediaIds(hidden.id),
    new Set(["a", "b"]),
  );
  await assert.rejects(media.setHiddenBatch(["a", "missing"], false));
  assert.equal((await media.getMediaItemByMediaId("a")).is_hidden, 1);
  assert.deepEqual(await albums.getAlbumIdsForMedia(rows.get("a")), [
    normal.id,
    hidden.id,
  ]);
  await media.setHidden("a", false);
  assert.deepEqual(await albums.getAlbumIdsForMedia(rows.get("a")), [
    normal.id,
  ]);
  assert.equal((await albums.getAlbums("normal"))[0].photo_count, 1);
  assert.equal((await albums.getAlbums("hidden"))[0].photo_count, 1);
  await albums.removeMediaFromAlbum(rows.get("b"), hidden.id);
  assert.equal((await media.getMediaItemByMediaId("b")).is_hidden, 1);
  assert.equal((await albums.getAlbums("hidden"))[0].photo_count, 0);
  await albums.addMediaToAlbum(rows.get("b"), hidden.id);
  await albums.deleteAlbum(hidden.id);
  assert.equal((await media.getMediaItemByMediaId("b")).is_hidden, 1);
  assert.equal((await media.getAllMediaIds()).length, 2);
});

test("local trash preserves memberships and hidden flags across upserts, with safe restoration and paginated search", async (t) => {
  const { media, albums } = await fixture(t);
  const { album, rows } = await seed(media, albums);
  const hidden = await albums.createAlbum("Private", "hidden");
  await albums.addMediaToAlbum(rows.get("b"), hidden.id);
  await assert.rejects(media.setTrashedBatch(["a", "missing"], true));
  assert.equal(await media.getTrashedMediaCount(), 0);
  await media.setTrashedBatch(["a", "b"], true);
  assert.equal(await media.getTrashedMediaCount(), 1);
  assert.deepEqual(
    (await media.getTrashedMedia()).map((row) => row.media_id),
    ["a"],
  );
  assert.equal(await media.getTrashedMediaCount({ includeHidden: true }), 2);
  assert.equal(await media.getHiddenMediaCount(), 0);
  assert.equal((await media.getMediaItemsByAlbum(album.id)).length, 0);
  assert.equal((await media.getMediaItemsByAlbum(hidden.id)).length, 0);
  assert.equal((await albums.getAlbums("normal"))[0].photo_count, 0);
  assert.equal((await albums.getAlbums("hidden"))[0].cover_uri, null);
  assert.deepEqual(await media.getExcludedMediaIds(), new Set(["a", "b"]));
  const stamp = (await media.getMediaItemByMediaId("b")).trashed_at;
  await media.upsertBatch([{ ...item("b", 2), filename: "100%_trip.jpg" }]);
  assert.equal((await media.getMediaItemByMediaId("b")).trashed_at, stamp);
  assert.equal((await media.getMediaItemByMediaId("b")).is_hidden, 1);
  assert.deepEqual(
    (
      await media.getTrashedMedia(1, 0, { sort: "oldest", includeHidden: true })
    ).map((r) => r.media_id),
    ["a"],
  );
  assert.deepEqual(
    (
      await media.getTrashedMedia(1, 1, { sort: "oldest", includeHidden: true })
    ).map((r) => r.media_id),
    ["b"],
  );
  assert.deepEqual(
    (
      await media.getTrashedMedia(60, 0, { query: "%_", includeHidden: true })
    ).map((r) => r.media_id),
    ["b"],
  );
  await media.setTrashedBatch(["a", "b"], false);
  assert.equal(await media.getTrashedMediaCount(), 0);
  assert.equal(await media.getHiddenMediaCount(), 1);
  assert.equal(await media.getMediaCountByAlbum(album.id), 1);
  assert.equal(await media.getMediaCountByAlbum(hidden.id), 1);
  assert.deepEqual(await albums.getAlbumIdsForMedia(rows.get("b")), [
    album.id,
    hidden.id,
  ]);
});
test("duplicate add reports actual inserts, existing rows and missing media separately", async (t) => {
  const { media, albums } = await fixture(t);
  const { album, rows } = await seed(media, albums);
  assert.deepEqual(
    await albums.addMediaBatchToAlbum(
      [rows.get("a"), rows.get("a"), 999],
      album.id,
    ),
    { added: 0, alreadyPresent: 1, failed: 1 },
  );
  assert.equal((await albums.getAlbums())[0].photo_count, 2);
});

test("native trash reconciliation preserves hidden albums, external restore and legacy local trash", async (t) => {
  const { media, albums } = await fixture(t);
  const { album, rows } = await seed(media, albums, ["system", "legacy"]);
  const hidden = await albums.createAlbum("Private", "hidden");
  await albums.addMediaToAlbum(rows.get("system"), hidden.id);
  await media.setTrashedBatch(["legacy"], true);
  await media.syncNativeTrash([
    { id: "system", isTrashed: true },
    { id: "legacy", isTrashed: false },
  ]);
  await media.reconcile(new Set(["system", "legacy"]), true);
  assert.equal((await media.getMediaItemByMediaId("system")).native_trashed, 1);
  assert.equal((await media.getMediaItemByMediaId("system")).is_hidden, 1);
  assert.equal(await media.getHiddenMediaCount(), 0);
  assert.deepEqual(
    (await media.getLegacyTrashedMedia()).map((row) => row.media_id),
    ["legacy"],
  );
  assert.deepEqual(await albums.getAlbumIdsForMedia(rows.get("system")), [
    album.id,
    hidden.id,
  ]);
  await media.syncNativeTrash([
    { id: "system", isTrashed: false },
    { id: "legacy", isTrashed: false },
  ]);
  assert.equal((await media.getMediaItemByMediaId("system")).trashed_at, null);
  assert.ok((await media.getMediaItemByMediaId("legacy")).trashed_at);
  assert.equal(await media.getHiddenMediaCount(), 1);
  await media.reconcile(new Set(["legacy"]), true);
  assert.equal(await media.getMediaItemByMediaId("system"), null);
  assert.deepEqual(await albums.getAlbumIdsForMedia(rows.get("system")), []);
});
test("rename and deletion refresh store results without deleting media", async (t) => {
  const { media, albums, db } = await fixture(t);
  const { album } = await seed(media, albums);
  await albums.renameAlbum(album.id, "Renamed");
  assert.equal((await albums.getAlbums())[0].name, "Renamed");
  await albums.deleteAlbum(album.id);
  assert.equal((await albums.getAlbums()).length, 0);
  assert.equal((await media.getAllMediaIds()).length, 2);
  assert.equal((await db.getAllAsync("SELECT * FROM media_albums")).length, 0);
});
test("removal changes relationship, count and cover, preserving phone identity", async (t) => {
  const { media, albums } = await fixture(t);
  const { album, rows } = await seed(media, albums);
  assert.equal((await albums.getAlbums())[0].cover_media_id, "b");
  await albums.removeMediaBatchFromAlbum([rows.get("b")], album.id);
  assert.equal((await albums.getAlbums())[0].photo_count, 1);
  assert.equal((await albums.getAlbums())[0].cover_media_id, "a");
  assert.ok(await media.getMediaItemByMediaId("b"));
});
test("hide/restore updates normal album counts and covers without losing membership", async (t) => {
  const { media, albums } = await fixture(t);
  const { album } = await seed(media, albums);
  await media.setHiddenBatch(["a", "b"], true);
  assert.equal((await media.getHiddenMedia()).length, 2);
  assert.equal((await media.getMediaItemsByAlbum(album.id)).length, 0);
  assert.equal((await albums.getAlbums())[0].photo_count, 0);
  assert.equal((await albums.getAlbums())[0].cover_uri, null);
  await media.setHiddenBatch(["b"], false);
  assert.equal((await albums.getAlbums())[0].cover_media_id, "b");
  assert.equal((await media.getHiddenMediaIds()).has("a"), true);
});
test("upsert renamed media keeps identity, hidden state and membership", async (t) => {
  const { media, albums } = await fixture(t);
  const { rows } = await seed(media, albums);
  await media.setHidden("a", true);
  await media.upsertBatch([{ ...item("a"), filename: "renamed.jpg" }]);
  const row = await media.getMediaItemByMediaId("a");
  assert.equal(row.id, rows.get("a"));
  assert.equal(row.is_hidden, 1);
  assert.equal((await albums.getAlbumIdsForMedia(row.id)).length, 1);
});
test("limited access preserves hidden metadata and membership; full access removes actual orphans", async (t) => {
  const { media, albums, db } = await fixture(t);
  await seed(media, albums);
  await media.setHidden("b", true);
  await media.reconcile(new Set(["a"]), false);
  assert.equal((await media.getMediaItemByMediaId("b")).is_available, 0);
  assert.equal((await media.getHiddenMedia()).length, 0);
  assert.equal((await db.getAllAsync("SELECT * FROM media_albums")).length, 2);
  await media.reconcile(new Set(["a", "b"]), false);
  assert.equal((await media.getHiddenMedia()).length, 1);
  await media.reconcile(new Set(["a"]), true);
  assert.equal(await media.getMediaItemByMediaId("b"), null);
  assert.equal((await db.getAllAsync("SELECT * FROM media_albums")).length, 1);
});
test("cancelled reconciliation rolls back changes and ignores rows discovered after snapshot", async (t) => {
  const { media, albums } = await fixture(t);
  await seed(media, albums);
  let checks = 0;
  await assert.rejects(media.reconcile(new Set(), true, () => ++checks < 2));
  assert.equal((await media.getAllMediaIds()).length, 2);
  await media.reconcile(new Set(), true, () => true, new Set(["a"]));
  assert.deepEqual(await media.getAllMediaIds(), ["b"]);
});
test("transaction rollback and queued concurrent writes leave no partial state", async (t) => {
  const { media, albums } = await fixture(t);
  const { album, rows } = await seed(media, albums);
  await assert.rejects(media.setHiddenBatch(["a", "missing"], true));
  assert.equal((await media.getMediaItemByMediaId("a")).is_hidden, 0);
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      albums.addMediaBatchToAlbum([...rows.values()], album.id),
    ),
  );
  assert.equal(
    results.reduce((sum, value) => sum + value.added, 0),
    0,
  );
  await assert.rejects(albums.addMediaBatchToAlbum([rows.get("a")], 999));
  await albums.renameAlbum(album.id, "Queue recovered");
  assert.equal((await albums.getAlbums())[0].name, "Queue recovered");
});
test("delete cancelled/rejected by native API never edits SQLite; success cleans links only", async (t) => {
  const { media, albums, db } = await fixture(t);
  await seed(media, albums);
  const remove = (ids) => media.deleteByMediaIds(ids);
  assert.equal(await deleteMedia(["a"], async () => false, remove), false);
  await assert.rejects(
    deleteMedia(
      ["a"],
      async () => {
        throw new Error("cancelled");
      },
      remove,
    ),
  );
  assert.equal((await media.getAllMediaIds()).length, 2);
  assert.equal(
    await deleteMedia(
      ["a", "b", "a"],
      async (ids) => {
        assert.deepEqual(ids, ["a", "b"]);
        return true;
      },
      remove,
    ),
    true,
  );
  assert.equal((await db.getAllAsync("SELECT * FROM media_albums")).length, 0);
  assert.equal((await albums.getAlbums()).length, 1);
});
test("hidden, trash, settings and membership survive a real database close/reopen", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "galerie-test-"));
  const file = path.join(dir, "test.db");
  let db = adapter(file);
  try {
    await initDatabase(db);
    const media = new MediaStore();
    const albums = new AlbumStore();
    const settings = new SettingsStore();
    media.setDatabase(db);
    albums.setDatabase(db);
    settings.setDatabase(db);
    const { album } = await seed(media, albums);
    await media.setHidden("a", true);
    await media.setTrashedBatch(["b"], true);
    await settings.setSetting("density", "compact");
    db.close();
    db = adapter(file);
    await initDatabase(db);
    media.setDatabase(db);
    albums.setDatabase(db);
    settings.setDatabase(db);
    assert.equal((await media.getHiddenMedia())[0].media_id, "a");
    assert.equal((await media.getTrashedMedia())[0].media_id, "b");
    assert.equal((await media.getMediaItemsByAlbum(album.id)).length, 0);
    assert.equal(await settings.getSetting("density"), "compact");
    await media.setTrashedBatch(["b"], false);
    assert.equal((await media.getMediaItemsByAlbum(album.id)).length, 1);
  } finally {
    db.close();
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith("galerie-test-"));
    fs.rmSync(dir, { recursive: true });
  }
});
test("large batches cross parameter boundaries; album pages are disjoint and complete", async (t) => {
  const { media, albums } = await fixture(t);
  const ids = Array.from({ length: 1205 }, (_, index) => `item-${index}`);
  const { album } = await seed(media, albums, ids);
  const found = new Set();
  for (let offset = 0; offset < ids.length; offset += 60)
    for (const row of await media.getMediaItemsByAlbum(album.id, 60, offset)) {
      assert.equal(found.has(row.media_id), false);
      found.add(row.media_id);
    }
  assert.equal(found.size, ids.length);
  assert.equal((await albums.getAlbums())[0].photo_count, ids.length);
  await media.deleteByMediaIds(ids);
  assert.equal((await albums.getAlbums())[0].photo_count, 0);
});
test("scan rejects denied, changed, failed and cancelled snapshots", async () => {
  const all = { granted: true, accessPrivileges: "all" };
  const page = { assets: [{ id: "a" }], hasNextPage: false, endCursor: "a" };
  let calls = 0;
  const base = {
    getPermission: async () => all,
    getPage: async () => {
      calls++;
      return page;
    },
    isCurrent: () => true,
  };
  assert.equal(
    await scanLibrary({
      ...base,
      getPermission: async () => ({ granted: false, accessPrivileges: "none" }),
    }),
    null,
  );
  assert.equal(calls, 0);
  let n = 0;
  assert.equal(
    await scanLibrary({
      ...base,
      getPermission: async () =>
        ++n === 1 ? all : { granted: true, accessPrivileges: "limited" },
    }),
    null,
  );
  await assert.rejects(
    scanLibrary({
      ...base,
      getPage: async () => {
        throw new Error("I/O");
      },
    }),
  );
  assert.equal(await scanLibrary({ ...base, isCurrent: () => false }), null);
  const partial = await scanLibrary({
    ...base,
    getPermission: async () => ({
      granted: false,
      accessPrivileges: "limited",
    }),
  });
  assert.equal(partial.canPrune, false);
  assert.equal((await scanLibrary(base)).canPrune, true);
});
test("scan stops early when all known IDs are present and detects stalled cursor", async () => {
  const base = {
    getPermission: async () => ({ granted: true, accessPrivileges: "all" }),
    isCurrent: () => true,
  };
  let pages = 0;
  const snapshot = await scanLibrary({
    ...base,
    requiredIds: new Set(["a"]),
    getPage: async () => {
      pages++;
      return { assets: [{ id: "a" }], hasNextPage: true, endCursor: "a" };
    },
  });
  assert.equal(pages, 1);
  assert.ok(snapshot.ids.has("a"));
  await assert.rejects(
    scanLibrary({
      ...base,
      getPage: async () => ({
        assets: [],
        hasNextPage: true,
        endCursor: "same",
      }),
    }),
  );
});
test("media routing keeps special characters in structured parameters", () => {
  const id = "content://media/a/b?name=č &x=#1";
  assert.deepEqual(mediaRoute(id, "2"), {
    pathname: "/media/[id]",
    params: { id, session: "2" },
  });
});
test("token generator consumes changed source tokens and matches committed output", async () => {
  const { buildTokens } =
    await import("../../galerie-design-system/scripts/build-tokens.mjs");
  const source = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../galerie-design-system/tokens.json"),
      "utf8",
    ),
  );
  assert.equal(
    buildTokens(source),
    fs
      .readFileSync(
        path.join(
          __dirname,
          "../../galerie-design-system/src/generated/tokens.tsx",
        ),
        "utf8",
      )
      .replace(/\r\n/g, "\n"),
  );
  source.color.light.primary.$value = "#123456";
  assert.match(buildTokens(source), /#123456/);
});
