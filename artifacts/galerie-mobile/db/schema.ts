import type { SQLiteDatabase } from "expo-sqlite";

export const DB_NAME = "galerie.db";

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'normal',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_albums_type ON albums(type);

CREATE TABLE IF NOT EXISTS media_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id TEXT NOT NULL,
  uri TEXT NOT NULL,
  filename TEXT,
  media_type TEXT NOT NULL DEFAULT 'photo',
  creation_time INTEGER,
  width INTEGER,
  height INTEGER,
  duration REAL,
  first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  last_seen_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  is_hidden INTEGER NOT NULL DEFAULT 0,
  UNIQUE(media_id, filename)
);

CREATE INDEX IF NOT EXISTS idx_media_hidden ON media_items(is_hidden);
CREATE INDEX IF NOT EXISTS idx_media_creation ON media_items(creation_time DESC);

CREATE TABLE IF NOT EXISTS media_albums (
  media_item_id INTEGER NOT NULL,
  album_id INTEGER NOT NULL,
  added_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  PRIMARY KEY (media_item_id, album_id),
  FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE CASCADE,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_albums_album ON media_albums(album_id);
CREATE INDEX IF NOT EXISTS idx_media_albums_media ON media_albums(media_item_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES ('theme', 'system');
`;

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
  const version = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  if ((version?.user_version ?? 0) < 1) {
    await db.withTransactionAsync(async () => {
      // Merge old duplicate identities without losing memberships or hidden flags.
      await db.execAsync(`
        CREATE TEMP TABLE media_merge AS
          SELECT media_id, MIN(id) AS keep_id, MAX(is_hidden) AS hidden
          FROM media_items GROUP BY media_id;
        INSERT OR IGNORE INTO media_albums (media_item_id, album_id, added_at)
          SELECT mm.keep_id, ma.album_id, MIN(ma.added_at)
          FROM media_albums ma JOIN media_items m ON m.id = ma.media_item_id
          JOIN media_merge mm ON mm.media_id = m.media_id
          GROUP BY mm.keep_id, ma.album_id;
        UPDATE media_items SET is_hidden =
          (SELECT hidden FROM media_merge WHERE media_merge.media_id = media_items.media_id);
        DELETE FROM media_items WHERE id NOT IN (SELECT keep_id FROM media_merge);
        DROP TABLE media_merge;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_media_identity ON media_items(media_id);
        ALTER TABLE media_items ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1;
        PRAGMA user_version = 1;
      `);
    });
  }
  if ((version?.user_version ?? 0) < 2) {
    await db.withTransactionAsync(async () => {
      // Local trash keeps phone files and album relationships until permanent deletion.
      await db.execAsync(`
        ALTER TABLE media_items ADD COLUMN trashed_at INTEGER;
        UPDATE media_items SET is_hidden=1 WHERE id IN (
          SELECT ma.media_item_id FROM media_albums ma
          JOIN albums a ON a.id=ma.album_id WHERE a.type='hidden'
        );
        CREATE INDEX IF NOT EXISTS idx_media_visibility
          ON media_items(is_hidden,is_available,trashed_at,creation_time DESC,id DESC);
        CREATE INDEX IF NOT EXISTS idx_media_trash
          ON media_items(trashed_at DESC,id DESC) WHERE trashed_at IS NOT NULL;
        PRAGMA user_version = 2;
      `);
    });
  }
}
