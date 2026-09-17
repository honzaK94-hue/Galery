import type { SQLiteDatabase } from 'expo-sqlite';

export type MediaType = 'photo' | 'video';

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

class MediaStore {
  private db: SQLiteDatabase | null = null;

  setDatabase(db: SQLiteDatabase): void {
    this.db = db;
  }

  async upsertBatch(identities: MediaIdentity[]): Promise<void> {
    if (!this.db || identities.length === 0) return;
    const now = Date.now();
    await this.db.withTransactionAsync(async () => {
      for (const item of identities) {
        await this.db!.runAsync(
          `INSERT INTO media_items (media_id, uri, filename, media_type, creation_time, width, height, duration, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(media_id, filename) DO UPDATE SET
             uri = excluded.uri,
             last_seen_at = excluded.last_seen_at,
             width = excluded.width,
             height = excluded.height,
             duration = excluded.duration`,
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
    });
  }

  async getHiddenMediaIds(): Promise<Set<string>> {
    if (!this.db) return new Set();
    const rows = await this.db.getAllAsync<{ media_id: string }>(
      `SELECT media_id FROM media_items WHERE is_hidden = 1`,
    );
    return new Set(rows.map((r) => r.media_id));
  }

  async setHidden(mediaId: string, hidden: boolean): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `UPDATE media_items SET is_hidden = ? WHERE media_id = ?`,
      [hidden ? 1 : 0, mediaId],
    );
  }

  async setHiddenBatch(mediaIds: string[], hidden: boolean): Promise<void> {
    if (!this.db || mediaIds.length === 0) return;
    const val = hidden ? 1 : 0;
    await this.db.withTransactionAsync(async () => {
      for (const id of mediaIds) {
        await this.db!.runAsync(
          `UPDATE media_items SET is_hidden = ? WHERE media_id = ?`,
          [val, id],
        );
      }
    });
  }

  async getMediaItemIdsByMediaIds(mediaIds: string[]): Promise<Map<string, number>> {
    if (!this.db || mediaIds.length === 0) return new Map();
    const placeholders = mediaIds.map(() => '?').join(',');
    const rows = await this.db.getAllAsync<{ media_id: string; id: number }>(
      `SELECT media_id, id FROM media_items WHERE media_id IN (${placeholders})`,
      mediaIds,
    );
    return new Map(rows.map((r) => [r.media_id, r.id]));
  }

  async getMediaItemByMediaId(mediaId: string): Promise<MediaItemRow | null> {
    if (!this.db) return null;
    return this.db.getFirstAsync<MediaItemRow>(
      `SELECT * FROM media_items WHERE media_id = ?`,
      [mediaId],
    );
  }

  async getMediaItemsByAlbum(albumId: number): Promise<MediaItemRow[]> {
    if (!this.db) return [];
    return this.db.getAllAsync<MediaItemRow>(
      `SELECT m.* FROM media_items m
       INNER JOIN media_albums ma ON ma.media_item_id = m.id
       WHERE ma.album_id = ? AND m.is_hidden = 0
       ORDER BY m.creation_time DESC`,
      [albumId],
    );
  }

  async getMediaUriByMediaId(mediaId: string): Promise<string | null> {
    if (!this.db) return null;
    const row = await this.db.getFirstAsync<{ uri: string }>(
      `SELECT uri FROM media_items WHERE media_id = ?`,
      [mediaId],
    );
    return row?.uri ?? null;
  }

  async getAllMediaIds(): Promise<string[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync<{ media_id: string }>(
      `SELECT media_id FROM media_items`,
    );
    return rows.map((r) => r.media_id);
  }

  async deleteOrphanedMedia(currentMediaIds: Set<string>): Promise<number> {
    if (!this.db) return 0;
    const allRows = await this.db.getAllAsync<{ id: number; media_id: string }>(
      `SELECT id, media_id FROM media_items`,
    );
    const orphanIds: number[] = [];
    for (const row of allRows) {
      if (!currentMediaIds.has(row.media_id)) {
        orphanIds.push(row.id);
      }
    }
    if (orphanIds.length === 0) return 0;
    await this.db.withTransactionAsync(async () => {
      for (const id of orphanIds) {
        await this.db!.runAsync(`DELETE FROM media_items WHERE id = ?`, [id]);
      }
    });
    return orphanIds.length;
  }
}

export const mediaStore = new MediaStore();
