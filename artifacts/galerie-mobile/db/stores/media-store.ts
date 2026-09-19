import type { SQLiteDatabase } from "expo-sqlite";
import { databaseTask } from "../queue";
import { notifyLibraryChanged } from "../changes";

export type MediaType = "photo" | "video";
export type MediaItemRow = {
  id: number;
  media_id: string;
  uri: string;
  filename: string | null;
  media_type: MediaType;
  creation_time: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  first_seen_at: number;
  last_seen_at: number;
  is_hidden: 0 | 1;
  is_available: 0 | 1;
};
export type MediaIdentity = {
  mediaId: string;
  uri: string;
  filename: string;
  mediaType: MediaType;
  creationTime: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

export class MediaStore {
  private db: SQLiteDatabase | null = null;
  setDatabase(db: SQLiteDatabase): void {
    this.db = db;
  }

  async upsertBatch(
    identities: MediaIdentity[],
    isCurrent = () => true,
  ): Promise<void> {
    if (!identities.length) return;
    await databaseTask(this.db, async (db) => {
      if (!isCurrent()) return;
      const now = Date.now();
      await db.withTransactionAsync(async () => {
        for (const item of identities) {
          if (!isCurrent()) throw new Error("Načítání bylo přerušeno.");
          await db.runAsync(
            `INSERT INTO media_items
            (media_id, uri, filename, media_type, creation_time, width, height, duration, first_seen_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(media_id) DO UPDATE SET uri=excluded.uri, filename=excluded.filename,
              media_type=excluded.media_type, creation_time=excluded.creation_time,
              width=excluded.width, height=excluded.height, duration=excluded.duration,
              last_seen_at=excluded.last_seen_at, is_available=1`,
            [
              item.mediaId,
              item.uri,
              item.filename,
              item.mediaType,
              item.creationTime,
              item.width ?? null,
              item.height ?? null,
              item.duration ?? null,
              now,
              now,
            ],
          );
        }
        if (!isCurrent()) throw new Error("Načítání bylo přerušeno.");
      });
    });
  }

  getHiddenMediaIds(): Promise<Set<string>> {
    return databaseTask(
      this.db,
      async (db) =>
        new Set(
          (
            await db.getAllAsync<{ media_id: string }>(
              "SELECT media_id FROM media_items WHERE is_hidden=1",
            )
          ).map((row) => row.media_id),
        ),
    );
  }
  setHidden(mediaId: string, hidden: boolean): Promise<void> {
    return this.setHiddenBatch([mediaId], hidden);
  }
  async setHiddenBatch(mediaIds: string[], hidden: boolean): Promise<void> {
    await databaseTask(this.db, async (db) => {
      await db.withTransactionAsync(async () => {
        for (const id of new Set(mediaIds)) {
          const result = await db.runAsync(
            "UPDATE media_items SET is_hidden=? WHERE media_id=?",
            [hidden ? 1 : 0, id],
          );
          if (!result.changes)
            throw new Error(
              "Položka není v místní databázi. Obnovte seznam a zkuste to znovu.",
            );
        }
      });
    });
    notifyLibraryChanged();
  }

  getMediaItemIdsByMediaIds(mediaIds: string[]): Promise<Map<string, number>> {
    return databaseTask(this.db, async (db) => {
      const result = new Map<string, number>();
      for (let offset = 0; offset < mediaIds.length; offset += 400) {
        const batch = mediaIds.slice(offset, offset + 400);
        const rows = await db.getAllAsync<{ media_id: string; id: number }>(
          `SELECT media_id,id FROM media_items WHERE media_id IN (${batch.map(() => "?").join(",")})`,
          batch,
        );
        for (const row of rows) result.set(row.media_id, row.id);
      }
      return result;
    });
  }
  getMediaItemByMediaId(id: string): Promise<MediaItemRow | null> {
    return databaseTask(this.db, (db) =>
      db.getFirstAsync<MediaItemRow>(
        "SELECT * FROM media_items WHERE media_id=?",
        [id],
      ),
    );
  }
  getMediaItemsByAlbum(
    albumId: number,
    limit = 60,
    offset = 0,
  ): Promise<MediaItemRow[]> {
    return databaseTask(this.db, (db) =>
      db.getAllAsync<MediaItemRow>(
        `SELECT m.* FROM media_items m
      JOIN media_albums ma ON ma.media_item_id=m.id WHERE ma.album_id=? AND m.is_hidden=0 AND m.is_available=1
      ORDER BY m.creation_time DESC, m.id DESC LIMIT ? OFFSET ?`,
        [albumId, limit, offset],
      ),
    );
  }
  getHiddenMedia(limit = 60, offset = 0): Promise<MediaItemRow[]> {
    return databaseTask(this.db, (db) =>
      db.getAllAsync<MediaItemRow>(
        `SELECT * FROM media_items
      WHERE is_hidden=1 AND is_available=1 ORDER BY creation_time DESC, id DESC LIMIT ? OFFSET ?`,
        [limit, offset],
      ),
    );
  }
  async getMediaUriByMediaId(id: string): Promise<string | null> {
    return (await this.getMediaItemByMediaId(id))?.uri ?? null;
  }
  getAllMediaIds(): Promise<string[]> {
    return databaseTask(this.db, async (db) =>
      (
        await db.getAllAsync<{ media_id: string }>(
          "SELECT media_id FROM media_items",
        )
      ).map((r) => r.media_id),
    );
  }
  async deleteByMediaIds(ids: string[]): Promise<number> {
    const changes = await databaseTask(this.db, async (db) => {
      let count = 0;
      await db.withTransactionAsync(async () => {
        for (let offset = 0; offset < ids.length; offset += 400) {
          const batch = ids.slice(offset, offset + 400);
          count += (
            await db.runAsync(
              `DELETE FROM media_items WHERE media_id IN (${batch.map(() => "?").join(",")})`,
              batch,
            )
          ).changes;
        }
      });
      return count;
    });
    if (changes) notifyLibraryChanged();
    return changes;
  }

  // Limited access preserves inaccessible items and their album/hidden state.
  async reconcile(
    currentIds: Set<string>,
    canPrune: boolean,
    isCurrent = () => true,
    knownIds?: Set<string>,
  ): Promise<number> {
    const changes = await databaseTask(this.db, async (db) => {
      let changed = 0;
      const rows = await db.getAllAsync<{
        media_id: string;
        is_available: number;
      }>("SELECT media_id,is_available FROM media_items");
      await db.withTransactionAsync(async () => {
        for (const row of rows) {
          if (!isCurrent()) throw new Error("Obnova knihovny byla přerušena.");
          if (knownIds && !knownIds.has(row.media_id)) continue;
          const available = currentIds.has(row.media_id);
          if (!available && canPrune)
            changed += (
              await db.runAsync("DELETE FROM media_items WHERE media_id=?", [
                row.media_id,
              ])
            ).changes;
          else if (row.is_available !== Number(available))
            changed += (
              await db.runAsync(
                "UPDATE media_items SET is_available=? WHERE media_id=?",
                [Number(available), row.media_id],
              )
            ).changes;
        }
        if (!isCurrent()) throw new Error("Obnova knihovny byla přerušena.");
      });
      return changed;
    });
    if (changes) notifyLibraryChanged();
    return changes;
  }
  deleteOrphanedMedia(currentIds: Set<string>): Promise<number> {
    return this.reconcile(currentIds, true);
  }
}
export const mediaStore = new MediaStore();
