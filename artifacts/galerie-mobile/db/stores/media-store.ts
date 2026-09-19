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
  trashed_at: number | null;
  native_trashed: 0 | 1;
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

export type MediaQueryOptions = {
  query?: string;
  sort?: "newest" | "oldest" | "name";
  includeHidden?: boolean;
};

function searchPattern(query?: string): string {
  return `%${(query ?? "").trim().replace(/[\\%_]/g, "\\$&")}%`;
}
function mediaOrder(options?: MediaQueryOptions, alias = ""): string {
  if (options?.sort === "oldest")
    return `${alias}creation_time ASC, ${alias}id ASC`;
  if (options?.sort === "name")
    return `${alias}filename COLLATE NOCASE ASC, ${alias}id DESC`;
  return `${alias}creation_time DESC, ${alias}id DESC`;
}

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
  getExcludedMediaIds(): Promise<Set<string>> {
    return databaseTask(
      this.db,
      async (db) =>
        new Set(
          (
            await db.getAllAsync<{ media_id: string }>(
              "SELECT media_id FROM media_items WHERE is_hidden=1 OR trashed_at IS NOT NULL",
            )
          ).map((row) => row.media_id),
        ),
    );
  }
  getTrashedMediaIds(): Promise<Set<string>> {
    return databaseTask(
      this.db,
      async (db) =>
        new Set(
          (
            await db.getAllAsync<{ media_id: string }>(
              "SELECT media_id FROM media_items WHERE trashed_at IS NOT NULL",
            )
          ).map((row) => row.media_id),
        ),
    );
  }
  getSystemTrashedMediaIds(): Promise<Set<string>> {
    return databaseTask(
      this.db,
      async (db) =>
        new Set(
          (
            await db.getAllAsync<{ media_id: string }>(
              "SELECT media_id FROM media_items WHERE native_trashed=1",
            )
          ).map((row) => row.media_id),
        ),
    );
  }
  getHiddenAlbumMediaIds(albumId: number): Promise<Set<string>> {
    return databaseTask(
      this.db,
      async (db) =>
        new Set(
          (
            await db.getAllAsync<{ media_id: string }>(
              `SELECT m.media_id FROM media_items m
        JOIN media_albums ma ON ma.media_item_id=m.id
        JOIN albums a ON a.id=ma.album_id
        WHERE a.id=? AND a.type='hidden' AND m.is_hidden=1
          AND m.is_available=1 AND m.trashed_at IS NULL`,
              [albumId],
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
          // Restoring is explicit: a visible item cannot remain inside a hidden album.
          // Normal album relationships are retained, so restoration puts it back there.
          if (!hidden) {
            await db.runAsync(
              `DELETE FROM media_albums WHERE media_item_id=(
                SELECT id FROM media_items WHERE media_id=?
              ) AND album_id IN (SELECT id FROM albums WHERE type='hidden')`,
              [id],
            );
          }
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
    options?: MediaQueryOptions,
  ): Promise<MediaItemRow[]> {
    return databaseTask(this.db, (db) =>
      db.getAllAsync<MediaItemRow>(
        `SELECT m.* FROM media_items m
      JOIN media_albums ma ON ma.media_item_id=m.id JOIN albums a ON a.id=ma.album_id
      WHERE ma.album_id=? AND m.is_hidden=(a.type='hidden') AND m.is_available=1
        AND m.trashed_at IS NULL AND COALESCE(m.filename,'') LIKE ? ESCAPE '\\'
      ORDER BY ${mediaOrder(options, "m.")} LIMIT ? OFFSET ?`,
        [albumId, searchPattern(options?.query), limit, offset],
      ),
    );
  }
  getHiddenMedia(
    limit = 60,
    offset = 0,
    options?: MediaQueryOptions,
  ): Promise<MediaItemRow[]> {
    return databaseTask(this.db, (db) =>
      db.getAllAsync<MediaItemRow>(
        `SELECT * FROM media_items
      WHERE is_hidden=1 AND is_available=1 AND trashed_at IS NULL
        AND COALESCE(filename,'') LIKE ? ESCAPE '\\'
      ORDER BY ${mediaOrder(options)} LIMIT ? OFFSET ?`,
        [searchPattern(options?.query), limit, offset],
      ),
    );
  }
  getTrashedMedia(
    limit = 60,
    offset = 0,
    options?: MediaQueryOptions,
  ): Promise<MediaItemRow[]> {
    return databaseTask(this.db, (db) =>
      db.getAllAsync<MediaItemRow>(
        `SELECT * FROM media_items WHERE trashed_at IS NOT NULL AND is_available=1
        ${options?.includeHidden ? "" : "AND is_hidden=0"}
        AND COALESCE(filename,'') LIKE ? ESCAPE '\\'
      ORDER BY ${options?.sort ? mediaOrder(options) : "trashed_at DESC, id DESC"}
      LIMIT ? OFFSET ?`,
        [searchPattern(options?.query), limit, offset],
      ),
    );
  }
  getLegacyTrashedMedia(options?: MediaQueryOptions): Promise<MediaItemRow[]> {
    return databaseTask(this.db, (db) =>
      db.getAllAsync<MediaItemRow>(
        `SELECT * FROM media_items WHERE trashed_at IS NOT NULL
          AND native_trashed=0 AND is_available=1
          AND COALESCE(filename,'') LIKE ? ESCAPE '\\'
          ORDER BY ${mediaOrder(options)}`,
        [searchPattern(options?.query)],
      ),
    );
  }
  async syncNativeTrash(
    states: { id: string; isTrashed: boolean }[],
    isCurrent = () => true,
    notify = true,
  ): Promise<void> {
    if (!states.length) return;
    let changed = 0;
    await databaseTask(this.db, async (db) => {
      if (!isCurrent()) return;
      await db.withTransactionAsync(async () => {
        for (const state of states) {
          if (!isCurrent()) throw new Error("Obnova knihovny byla přerušena.");
          // Leave a legacy local-trash marker untouched when MediaStore says
          // ordinary media. Only a previous native trash marker may auto-clear.
          changed += (
            await db.runAsync(
              state.isTrashed
                ? `UPDATE media_items SET native_trashed=1, trashed_at=COALESCE(trashed_at,?)
                    WHERE media_id=? AND (native_trashed=0 OR trashed_at IS NULL)`
                : `UPDATE media_items SET native_trashed=0, trashed_at=NULL
                    WHERE media_id=? AND native_trashed=1`,
              state.isTrashed ? [Date.now(), state.id] : [state.id],
            )
          ).changes;
        }
        if (!isCurrent()) throw new Error("Obnova knihovny byla přerušena.");
      });
    });
    if (changed && notify) notifyLibraryChanged();
  }
  async setTrashedBatch(mediaIds: string[], trashed: boolean): Promise<void> {
    if (!mediaIds.length) return;
    await databaseTask(this.db, async (db) => {
      const now = Date.now();
      await db.withTransactionAsync(async () => {
        for (const id of new Set(mediaIds)) {
          // Repeated trash actions keep the original timestamp; restoration keeps
          // the former hidden flag and all album links. Phone files are untouched.
          const result = await db.runAsync(
            trashed
              ? "UPDATE media_items SET trashed_at=COALESCE(trashed_at,?) WHERE media_id=?"
              : "UPDATE media_items SET trashed_at=?,native_trashed=0 WHERE media_id=?",
            [trashed ? now : null, id],
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
  getHiddenMediaCount(): Promise<number> {
    return databaseTask(
      this.db,
      async (db) =>
        (
          await db.getFirstAsync<{ count: number }>(
            "SELECT COUNT(*) AS count FROM media_items WHERE is_hidden=1 AND is_available=1 AND trashed_at IS NULL",
          )
        )?.count ?? 0,
    );
  }
  getTrashedMediaCount(options?: MediaQueryOptions): Promise<number> {
    return databaseTask(
      this.db,
      async (db) =>
        (
          await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) AS count FROM media_items WHERE trashed_at IS NOT NULL AND is_available=1
              ${options?.includeHidden ? "" : "AND is_hidden=0"}
              AND COALESCE(filename,'') LIKE ? ESCAPE '\\'`,
            [searchPattern(options?.query)],
          )
        )?.count ?? 0,
    );
  }
  getMediaCountByAlbum(albumId: number): Promise<number> {
    return databaseTask(
      this.db,
      async (db) =>
        (
          await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) AS count FROM media_items m
        JOIN media_albums ma ON ma.media_item_id=m.id JOIN albums a ON a.id=ma.album_id
        WHERE a.id=? AND m.is_hidden=(a.type='hidden') AND m.is_available=1 AND m.trashed_at IS NULL`,
            [albumId],
          )
        )?.count ?? 0,
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
