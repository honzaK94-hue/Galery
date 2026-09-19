import type { SQLiteDatabase } from "expo-sqlite";
// Serialize reads and writes across all stores on this SQLite connection.
const queues = new WeakMap<SQLiteDatabase, Promise<unknown>>();
export function databaseTask<T>(
  db: SQLiteDatabase | null,
  task: (db: SQLiteDatabase) => Promise<T>,
): Promise<T> {
  if (!db) return Promise.reject(new Error("Databáze není připravena."));
  const next = (queues.get(db) ?? Promise.resolve()).then(() => task(db));
  queues.set(
    db,
    next.catch(() => undefined),
  );
  return next;
}
