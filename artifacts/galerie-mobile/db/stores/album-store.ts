import type { SQLiteDatabase } from 'expo-sqlite';

export type AlbumType = 'normal' | 'hidden';

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
};

class AlbumStore {
  private db: SQLiteDatabase | null = null;

  setDatabase(db: SQLiteDatabase): void {
    this.db = db;
  }

  async createAlbum(name: string, type: AlbumType = 'normal'): Promise<AlbumRow> {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    const result = await this.db.runAsync(
      `INSERT INTO albums (name, type, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [name, type, now, now],
    );
    return {
      id: result.lastInsertRowId as number,
      name,
      type,
      created_at: now,
      updated_at: now,
    };
  }

  async renameAlbum(id: number, name: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `UPDATE albums SET name = ?, updated_at = ? WHERE id = ?`,
      [name, Date.now(), id],
    );
  }

  async deleteAlbum(id: number): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(`DELETE FROM albums WHERE id = ?`, [id]);
  }

  async getAlbums(type: AlbumType = 'normal'): Promise<AlbumWithCount[]> {
    if (!this.db) return [];
    return this.db.getAllAsync<AlbumWithCount>(
      `SELECT a.*,
         (SELECT COUNT(*) FROM media_albums ma WHERE ma.album_id = a.id) AS photo_count,
         (SELECT m.media_id FROM media_albums ma
          INNER JOIN media_items m ON m.id = ma.media_item_id
          WHERE ma.album_id = a.id
          ORDER BY m.creation_time DESC LIMIT 1) AS cover_media_id
       FROM albums a
       WHERE a.type = ?
       ORDER BY a.created_at DESC`,
      [type],
    );
  }

  async getAlbumById(id: number): Promise<AlbumRow | null> {
    if (!this.db) return null;
    return this.db.getFirstAsync<AlbumRow>(
      `SELECT * FROM albums WHERE id = ?`,
      [id],
    );
  }

  async addMediaToAlbum(mediaItemId: number, albumId: number): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT OR IGNORE INTO media_albums (media_item_id, album_id) VALUES (?, ?)`,
      [mediaItemId, albumId],
    );
  }

  async addMediaBatchToAlbum(mediaItemIds: number[], albumId: number): Promise<void> {
    if (!this.db || mediaItemIds.length === 0) return;
    await this.db.withTransactionAsync(async () => {
      for (const mediaItemId of mediaItemIds) {
        await this.db!.runAsync(
          `INSERT OR IGNORE INTO media_albums (media_item_id, album_id) VALUES (?, ?)`,
          [mediaItemId, albumId],
        );
      }
    });
  }

  async removeMediaFromAlbum(mediaItemId: number, albumId: number): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `DELETE FROM media_albums WHERE media_item_id = ? AND album_id = ?`,
      [mediaItemId, albumId],
    );
  }

  async getAlbumIdsForMedia(mediaItemId: number): Promise<number[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync<{ album_id: number }>(
      `SELECT album_id FROM media_albums WHERE media_item_id = ?`,
      [mediaItemId],
    );
    return rows.map((r) => r.album_id);
  }
}

export const albumStore = new AlbumStore();
