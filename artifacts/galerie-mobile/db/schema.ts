import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'galerie.db';

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
}
