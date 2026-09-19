import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { DB_NAME, initDatabase } from "./schema";
import { albumStore } from "./stores/album-store";
import { mediaStore } from "./stores/media-store";
import { settingsStore } from "./stores/settings-store";

let _db: SQLite.SQLiteDatabase | null = null;
let _openPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let _initPromise: Promise<void> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  if (!_openPromise) {
    _openPromise = SQLite.openDatabaseAsync(DB_NAME)
      .then((db) => {
        _db = db;
        return db;
      })
      .catch((error) => {
        _openPromise = null;
        throw error;
      });
  }
  return _openPromise;
}

export async function ensureDatabaseReady(): Promise<SQLite.SQLiteDatabase> {
  const db = await getDatabase();
  if (!_initPromise) {
    _initPromise = initDatabase(db)
      .then(() => {
        albumStore.setDatabase(db);
        mediaStore.setDatabase(db);
        settingsStore.setDatabase(db);
      })
      .catch((error) => {
        _initPromise = null;
        throw error;
      });
  }
  await _initPromise;
  return db;
}

export function isDatabaseAvailable(): boolean {
  return Platform.OS !== "web";
}
