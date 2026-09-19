import type { SQLiteDatabase } from "expo-sqlite";
import { databaseTask } from "../queue";
import { notifyLibraryChanged } from "../changes";

export type AlbumType = "normal" | "hidden";
export type AlbumRow = {
  id: number;
  name: string;
  type: AlbumType;
  created_at: number;
  updated_at: number;
};
export type AlbumWithCount = AlbumRow & {
  photo_count: number;
  cover_media_id: string | null;
  cover_uri: string | null;
  cover_type: string | null;
};
export type AddMediaResult = {
  added: number;
  alreadyPresent: number;
  failed: number;
};

export class AlbumStore {
  private db: SQLiteDatabase | null = null;
  setDatabase(db: SQLiteDatabase): void {
    this.db = db;
  }
  async createAlbum(
    name: string,
    type: AlbumType = "normal",
  ): Promise<AlbumRow> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80)
      throw new Error("Název alba musí mít 1 až 80 znaků.");
    const album = await databaseTask(this.db, async (db) => {
      const now = Date.now();
      const result = await db.runAsync(
        "INSERT INTO albums (name,type,created_at,updated_at) VALUES (?,?,?,?)",
        [trimmed, type, now, now],
      );
      return {
        id: result.lastInsertRowId,
        name: trimmed,
        type,
        created_at: now,
        updated_at: now,
      };
    });
    notifyLibraryChanged();
    return album;
  }
  async renameAlbum(id: number, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80)
      throw new Error("Název alba musí mít 1 až 80 znaků.");
    await databaseTask(this.db, async (db) => {
      const result = await db.runAsync(
        "UPDATE albums SET name=?,updated_at=? WHERE id=?",
        [trimmed, Date.now(), id],
      );
      if (!result.changes) throw new Error("Album už neexistuje.");
    });
    notifyLibraryChanged();
  }
  async deleteAlbum(id: number): Promise<void> {
    await databaseTask(this.db, (db) =>
      db.runAsync("DELETE FROM albums WHERE id=?", [id]),
    );
    notifyLibraryChanged();
  }
  getAlbums(type: AlbumType = "normal"): Promise<AlbumWithCount[]> {
    return databaseTask(this.db, (db) =>
      db.getAllAsync<AlbumWithCount>(
        `SELECT a.*,
      (SELECT COUNT(*) FROM media_albums ma JOIN media_items m ON m.id=ma.media_item_id
        WHERE ma.album_id=a.id AND m.is_hidden=0 AND m.is_available=1) AS photo_count,
      cover.media_id AS cover_media_id, cover.uri AS cover_uri, cover.media_type AS cover_type
      FROM albums a LEFT JOIN media_items cover ON cover.id=(
        SELECT m.id FROM media_albums ma JOIN media_items m ON m.id=ma.media_item_id
        WHERE ma.album_id=a.id AND m.is_hidden=0 AND m.is_available=1
        ORDER BY m.creation_time DESC,m.id DESC LIMIT 1)
      WHERE a.type=? ORDER BY a.created_at DESC,a.id DESC`,
        [type],
      ),
    );
  }
  getAlbumById(id: number): Promise<AlbumRow | null> {
    return databaseTask(this.db, (db) =>
      db.getFirstAsync<AlbumRow>("SELECT * FROM albums WHERE id=?", [id]),
    );
  }
  addMediaToAlbum(
    mediaItemId: number,
    albumId: number,
  ): Promise<AddMediaResult> {
    return this.addMediaBatchToAlbum([mediaItemId], albumId);
  }
  async addMediaBatchToAlbum(
    ids: number[],
    albumId: number,
  ): Promise<AddMediaResult> {
    const result = await databaseTask(this.db, async (db) => {
      const counts: AddMediaResult = { added: 0, alreadyPresent: 0, failed: 0 };
      await db.withTransactionAsync(async () => {
        if (
          !(await db.getFirstAsync("SELECT id FROM albums WHERE id=?", [
            albumId,
          ]))
        )
          throw new Error("Album už neexistuje.");
        for (const id of new Set(ids)) {
          if (
            !(await db.getFirstAsync(
              "SELECT id FROM media_items WHERE id=? AND is_available=1",
              [id],
            ))
          ) {
            counts.failed++;
            continue;
          }
          const row = await db.runAsync(
            "INSERT OR IGNORE INTO media_albums (media_item_id,album_id) VALUES (?,?)",
            [id, albumId],
          );
          if (row.changes) counts.added++;
          else counts.alreadyPresent++;
        }
      });
      return counts;
    });
    if (result.added) notifyLibraryChanged();
    return result;
  }
  removeMediaFromAlbum(id: number, albumId: number): Promise<void> {
    return this.removeMediaBatchFromAlbum([id], albumId);
  }
  async removeMediaBatchFromAlbum(
    ids: number[],
    albumId: number,
  ): Promise<void> {
    await databaseTask(this.db, async (db) => {
      await db.withTransactionAsync(async () => {
        for (const id of new Set(ids))
          await db.runAsync(
            "DELETE FROM media_albums WHERE media_item_id=? AND album_id=?",
            [id, albumId],
          );
      });
    });
    notifyLibraryChanged();
  }
  getAlbumIdsForMedia(id: number): Promise<number[]> {
    return databaseTask(this.db, async (db) =>
      (
        await db.getAllAsync<{ album_id: number }>(
          "SELECT album_id FROM media_albums WHERE media_item_id=?",
          [id],
        )
      ).map((r) => r.album_id),
    );
  }
}
export const albumStore = new AlbumStore();
