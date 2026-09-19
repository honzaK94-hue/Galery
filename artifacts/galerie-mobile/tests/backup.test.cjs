const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
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
const { initDatabase } = require("../db/schema.ts");
const { exportAlbumBackup, importAlbumBackup } = require("../db/backup.ts");
function adapter() {
  const raw = new DatabaseSync(":memory:");
  return {
    close: () => raw.close(),
    execAsync: async (sql) => raw.exec(sql),
    runAsync: async (sql, values = []) => {
      const result = raw.prepare(sql).run(...values);
      return {
        changes: result.changes,
        lastInsertRowId: result.lastInsertRowid,
      };
    },
    getFirstAsync: async (sql, values = []) =>
      raw.prepare(sql).get(...values) ?? null,
    getAllAsync: async (sql, values = []) => raw.prepare(sql).all(...values),
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

test("backup roundtrip is additive, idempotent, preserves hidden/native trash and rolls back invalid imports", async (t) => {
  const source = adapter();
  const target = adapter();
  t.after(() => {
    source.close();
    target.close();
  });
  await initDatabase(source);
  await initDatabase(target);
  await source.execAsync(`
    INSERT INTO albums(id,name,type) VALUES(1,'Same','normal'),(2,'Same','normal'),(3,'Private','hidden');
    INSERT INTO media_items(id,media_id,uri,filename,is_hidden) VALUES
      (1,'100','content://media/100','hidden.jpg',1),
      (2,'101','content://media/101','visible.jpg',0),
      (3,'102','content://media/102','new.jpg',0);
    INSERT INTO media_albums(media_item_id,album_id) VALUES(1,3),(2,1),(3,2);
    UPDATE albums SET is_pinned=1,preferred_cover_media_id='101' WHERE id=1;
    INSERT INTO app_settings(key,value) VALUES('density','compact'),('vault_enabled','true'),
      ('showSystemAlbums','false'),('albumSort','count');
  `);
  const backup = await exportAlbumBackup(source);
  assert.equal(backup.sourceId, (await exportAlbumBackup(source)).sourceId);
  const expectedSettings = {
    density: "compact",
    showSystemAlbums: "false",
    albumSort: "count",
  };
  assert.deepEqual(backup.settings, expectedSettings);
  assert.equal(backup.albums[0].pinned, true);
  assert.equal(backup.albums[0].preferredCoverMediaId, "101");
  await source.execAsync("UPDATE albums SET name='Later rename' WHERE id=1");
  await importAlbumBackup(source, backup);
  assert.equal((await source.getAllAsync("SELECT id FROM albums")).length, 3);
  assert.equal(
    (await source.getFirstAsync("SELECT name FROM albums WHERE id=1")).name,
    "Later rename",
  );
  const legacyBackup = {
    ...backup,
    albums: backup.albums.map(
      ({ pinned, preferredCoverMediaId, ...album }) => album,
    ),
  };
  await importAlbumBackup(source, legacyBackup);
  assert.equal(
    (await source.getFirstAsync("SELECT is_pinned FROM albums WHERE id=1"))
      .is_pinned,
    1,
  );
  assert.equal(
    (
      await source.getFirstAsync(
        "SELECT preferred_cover_media_id FROM albums WHERE id=1",
      )
    ).preferred_cover_media_id,
    "101",
  );
  await target.execAsync(`
    INSERT INTO albums(id,name) VALUES(1,'Keep');
    INSERT INTO media_items(id,media_id,uri,filename,is_hidden,native_trashed,trashed_at) VALUES
      (1,'100','content://media/100','renamed.jpg',1,1,1234),
      (2,'101','content://media/101','visible.jpg',1,0,NULL);
    INSERT INTO media_albums(media_item_id,album_id) VALUES(1,1);
    INSERT INTO app_settings(key,value) VALUES('vault_enabled','true');
  `);
  assert.deepEqual(await importAlbumBackup(target, backup), {
    albums: 3,
    media: 3,
    settings: expectedSettings,
  });
  await importAlbumBackup(target, backup);
  const albums = await target.getAllAsync("SELECT * FROM albums");
  assert.equal(albums.length, 4);
  assert.equal(albums.filter((album) => album.name === "Same").length, 2);
  const pinned = albums.find((album) => album.is_pinned);
  assert.equal(pinned.name, "Same");
  assert.equal(pinned.preferred_cover_media_id, "101");
  const rows = await target.getAllAsync(
    "SELECT * FROM media_items ORDER BY id",
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].filename, "renamed.jpg");
  assert.equal(rows[0].native_trashed, 1);
  assert.equal(rows[0].trashed_at, 1234);
  assert.equal(rows[1].is_hidden, 1);
  assert.equal(rows[2].is_available, 0);
  assert.equal(
    (await target.getAllAsync("SELECT * FROM media_albums")).length,
    4,
  );
  const before = await target.getAllAsync(
    "SELECT * FROM app_settings ORDER BY key",
  );
  await assert.rejects(
    importAlbumBackup(target, {
      ...backup,
      settings: { vault_enabled: "false" },
    }),
  );
  await assert.rejects(
    importAlbumBackup(target, {
      ...backup,
      links: [{ mediaId: "999", albumId: 1 }],
    }),
  );
  await assert.rejects(
    importAlbumBackup(target, {
      ...backup,
      albums: backup.albums.map((album) => ({
        ...album,
        preferredCoverMediaId: "100",
      })),
    }),
  );
  await target.execAsync(`CREATE TRIGGER reject_backup_link BEFORE INSERT ON media_albums
    BEGIN SELECT RAISE(ABORT,'simulated write failure'); END;`);
  await assert.rejects(
    importAlbumBackup(target, { ...backup, sourceId: "foreign-backup-origin" }),
  );
  assert.equal((await target.getAllAsync("SELECT * FROM albums")).length, 4);
  assert.deepEqual(
    await target.getAllAsync("SELECT * FROM app_settings ORDER BY key"),
    before,
  );
  assert.equal(
    (
      await target.getFirstAsync(
        "SELECT value FROM app_settings WHERE key='vault_enabled'",
      )
    ).value,
    "true",
  );
  assert.deepEqual(await target.getAllAsync("PRAGMA foreign_key_check"), []);
});
