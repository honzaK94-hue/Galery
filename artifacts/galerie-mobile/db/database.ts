import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { DB_NAME, initDatabase } from './schema';
import { albumStore } from './stores/album-store';
import { mediaStore } from './stores/media-store';
import { settingsStore } from './stores/settings-store';

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<void> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  return _db;
}

export async function ensureDatabaseReady(): Promise<SQLite.SQLiteDatabase> {
  const db = await getDatabase();
  if (!_initPromise) {
    _initPromise = initDatabase(db).then(() => {
      albumStore.setDatabase(db);
      mediaStore.setDatabase(db);
      settingsStore.setDatabase(db);
    });
  }
  await _initPromise;
  return db;
}

export function isDatabaseAvailable(): boolean {
  return Platform.OS !== 'web';
}
