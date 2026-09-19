import type { SQLiteDatabase } from "expo-sqlite";
import { z } from "zod";
import { databaseTask } from "./queue";
import { notifyLibraryChanged } from "./changes";
import type { MediaItemRow } from "./stores/media-store";

export const MAX_ALBUM_BACKUP_BYTES = 32 * 1024 * 1024;
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const albumId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const mediaId = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine((value) => value.length < 19 || value <= "9223372036854775807");
const settingsSchema = z
  .object({
    sort: z.enum(["newest", "oldest", "name"]).optional(),
    density: z.enum(["comfortable", "compact", "overview"]).optional(),
    appearance: z.enum(["dark", "light", "system"]).optional(),
    thumbnailQuality: z.enum(["balanced", "high"]).optional(),
    swipeEnabled: z.enum(["true", "false"]).optional(),
    doubleTapEnabled: z.enum(["true", "false"]).optional(),
    videoAutoplay: z.enum(["true", "false"]).optional(),
    showSystemAlbums: z.enum(["true", "false"]).optional(),
    albumSort: z.enum(["newest", "name", "count"]).optional(),
  })
  .strict();
const backupSchema = z
  .object({
    format: z.literal("galerie-albums"),
    version: z.literal(1),
    sourceId: z.string().regex(/^[a-zA-Z0-9_-]{8,96}$/),
    createdAt: integer,
    albums: z
      .array(
        z
          .object({
            id: albumId,
            name: z.string().trim().min(1).max(80),
            type: z.enum(["normal", "hidden"]),
            createdAt: integer,
            updatedAt: integer,
            pinned: z.boolean().optional(),
            preferredCoverMediaId: mediaId.nullable().optional(),
          })
          .strict(),
      )
      .max(10000),
    media: z
      .array(
        z
          .object({
            mediaId,
            uri: z
              .string()
              .min(1)
              .max(4096)
              .regex(/^(file|content):\/\//),
            filename: z.string().max(1024),
            mediaType: z.enum(["photo", "video"]),
            creationTime: integer.nullable(),
            width: integer.nullable(),
            height: integer.nullable(),
            duration: z.number().finite().nonnegative().max(1e9).nullable(),
            hidden: z.boolean(),
          })
          .strict(),
      )
      .max(100000),
    links: z.array(z.object({ mediaId, albumId }).strict()).max(500000),
    settings: settingsSchema,
  })
  .strict();
export type AlbumBackup = z.infer<typeof backupSchema>;

function validateBackup(input: unknown): AlbumBackup {
  let text: string | undefined;
  try {
    text = JSON.stringify(input);
  } catch {
    /* Cyclic/unserializable input is invalid. */
  }
  // This is an additional in-process guard. The file reader also rejects large
  // byte lengths before loading JSON into memory.
  if (!text || text.length > MAX_ALBUM_BACKUP_BYTES)
    throw new Error("Záloha je neplatná nebo příliš velká (maximum 32 MB).");
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success)
    throw new Error("Soubor není podporovaná záloha alb Galerie.");
  const value = parsed.data;
  const albums = new Set(value.albums.map((album) => album.id));
  const media = new Set(value.media.map((item) => item.mediaId));
  if (albums.size !== value.albums.length || media.size !== value.media.length)
    throw new Error("Záloha obsahuje duplicitní identifikátory.");
  const links = new Set<string>();
  for (const link of value.links) {
    const key = `${link.albumId}:${link.mediaId}`;
    if (!albums.has(link.albumId) || !media.has(link.mediaId) || links.has(key))
      throw new Error("Záloha obsahuje neplatné vazby mezi médii a alby.");
    links.add(key);
  }
  const photos = new Set(
    value.media
      .filter((item) => item.mediaType === "photo")
      .map((item) => item.mediaId),
  );
  for (const album of value.albums) {
    if (
      album.preferredCoverMediaId &&
      (!photos.has(album.preferredCoverMediaId) ||
        !links.has(`${album.id}:${album.preferredCoverMediaId}`))
    )
      throw new Error(
        "Zvolený obal v záloze není fotografie z příslušného alba.",
      );
  }
  return value;
}

async function sourceId(db: SQLiteDatabase): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key='backup_source_id'",
  );
  if (row && /^[a-zA-Z0-9_-]{8,96}$/.test(row.value)) return row.value;
  // An origin identifier for idempotent restore, never a key or credential.
  const value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  await db.runAsync(
    "INSERT INTO app_settings(key,value) VALUES('backup_source_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [value],
  );
  return value;
}

export function exportAlbumBackup(db: SQLiteDatabase): Promise<AlbumBackup> {
  return databaseTask(db, async (connection) => {
    let backup: AlbumBackup | undefined;
    await connection.withTransactionAsync(async () => {
      const origin = await sourceId(connection);
      const albums = await connection.getAllAsync<{
        id: number;
        name: string;
        type: "normal" | "hidden";
        created_at: number;
        updated_at: number;
        is_pinned: number;
        preferred_cover_media_id: string | null;
      }>(`SELECT a.id,a.name,a.type,a.created_at,a.updated_at,a.is_pinned,
        (SELECT m.media_id FROM media_albums ma JOIN media_items m ON m.id=ma.media_item_id
          WHERE ma.album_id=a.id AND m.media_id=a.preferred_cover_media_id AND m.media_type='photo'
          LIMIT 1) AS preferred_cover_media_id FROM albums a ORDER BY a.id`);
      const media = await connection.getAllAsync<MediaItemRow>(
        "SELECT m.* FROM media_items m WHERE m.is_hidden=1 OR EXISTS(SELECT 1 FROM media_albums ma WHERE ma.media_item_id=m.id) ORDER BY m.id",
      );
      const links = await connection.getAllAsync<{
        mediaId: string;
        albumId: number;
      }>(
        "SELECT m.media_id AS mediaId,ma.album_id AS albumId FROM media_albums ma JOIN media_items m ON m.id=ma.media_item_id ORDER BY ma.album_id,m.id",
      );
      const settings: Record<string, string> = {};
      for (const key of Object.keys(settingsSchema.shape)) {
        const setting = await connection.getFirstAsync<{ value: string }>(
          "SELECT value FROM app_settings WHERE key=?",
          [key],
        );
        if (setting) settings[key] = setting.value;
      }
      backup = validateBackup({
        format: "galerie-albums",
        version: 1,
        sourceId: origin,
        createdAt: Date.now(),
        albums: albums.map((album) => ({
          id: album.id,
          name: album.name,
          type: album.type,
          createdAt: album.created_at,
          updatedAt: album.updated_at,
          pinned: !!album.is_pinned,
          preferredCoverMediaId: album.preferred_cover_media_id,
        })),
        media: media.map((item) => ({
          mediaId: item.media_id,
          uri: item.uri,
          filename: item.filename ?? "",
          mediaType: item.media_type,
          creationTime: item.creation_time,
          width: item.width,
          height: item.height,
          duration: item.duration,
          hidden: !!item.is_hidden,
        })),
        links,
        settings,
      });
    });
    return backup!;
  });
}

export async function importAlbumBackup(
  db: SQLiteDatabase,
  input: unknown,
): Promise<{
  albums: number;
  media: number;
  settings: Record<string, string>;
}> {
  const backup = validateBackup(input);
  await databaseTask(db, async (connection) => {
    await connection.withTransactionAsync(async () => {
      const origin = await sourceId(connection);
      const albumIds = new Map<number, number>();
      const hiddenMedia = new Set(
        backup.media.filter((item) => item.hidden).map((item) => item.mediaId),
      );
      const hiddenAlbums = new Set(
        backup.albums
          .filter((album) => album.type === "hidden")
          .map((album) => album.id),
      );
      for (const link of backup.links)
        if (hiddenAlbums.has(link.albumId)) hiddenMedia.add(link.mediaId);
      for (const album of backup.albums) {
        const mappingKey = `backup:${backup.sourceId}:${album.id}`;
        const mapping = await connection.getFirstAsync<{ value: string }>(
          "SELECT value FROM app_settings WHERE key=?",
          [mappingKey],
        );
        const candidate = mapping
          ? Number(mapping.value)
          : origin === backup.sourceId
            ? album.id
            : null;
        const existing =
          candidate && Number.isSafeInteger(candidate)
            ? await connection.getFirstAsync<{ id: number; type: string }>(
                "SELECT id,type FROM albums WHERE id=?",
                [candidate],
              )
            : null;
        let localId: number;
        if (existing && existing.type === album.type) {
          // Reuse by stable origin+ID, never by display name. Keep later renames.
          localId = existing.id;
          // Legacy v1 backups omit these fields. They must not reset newer
          // choices on an existing album; current backups restore them exactly.
          if (album.pinned !== undefined)
            await connection.runAsync(
              "UPDATE albums SET is_pinned=? WHERE id=?",
              [album.pinned ? 1 : 0, localId],
            );
          if (album.preferredCoverMediaId !== undefined)
            await connection.runAsync(
              "UPDATE albums SET preferred_cover_media_id=? WHERE id=?",
              [album.preferredCoverMediaId, localId],
            );
        } else {
          const inserted = await connection.runAsync(
            "INSERT INTO albums(name,type,created_at,updated_at,is_pinned,preferred_cover_media_id) VALUES(?,?,?,?,?,?)",
            [
              album.name,
              album.type,
              album.createdAt,
              album.updatedAt,
              album.pinned ? 1 : 0,
              album.preferredCoverMediaId ?? null,
            ],
          );
          localId = inserted.lastInsertRowId;
        }
        albumIds.set(album.id, localId);
        await connection.runAsync(
          "INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          [mappingKey, String(localId)],
        );
      }
      const localMedia = new Map<string, number>();
      for (const item of backup.media) {
        const existing = await connection.getFirstAsync<{ id: number }>(
          "SELECT id FROM media_items WHERE media_id=?",
          [item.mediaId],
        );
        if (existing) {
          // Preserve current file metadata, visibility availability and trash.
          // Import may hide media, but must never reveal an existing hidden item.
          if (hiddenMedia.has(item.mediaId))
            await connection.runAsync(
              "UPDATE media_items SET is_hidden=1 WHERE id=?",
              [existing.id],
            );
          localMedia.set(item.mediaId, existing.id);
        } else {
          const now = Date.now();
          const inserted = await connection.runAsync(
            `INSERT INTO media_items(media_id,uri,filename,media_type,creation_time,width,height,duration,
              first_seen_at,last_seen_at,is_hidden,is_available) VALUES(?,?,?,?,?,?,?,?,?,?,?,0)`,
            [
              item.mediaId,
              item.uri,
              item.filename,
              item.mediaType,
              item.creationTime,
              item.width,
              item.height,
              item.duration,
              now,
              now,
              hiddenMedia.has(item.mediaId) ? 1 : 0,
            ],
          );
          localMedia.set(item.mediaId, inserted.lastInsertRowId);
        }
      }
      for (const link of backup.links)
        await connection.runAsync(
          "INSERT OR IGNORE INTO media_albums(media_item_id,album_id) VALUES(?,?)",
          [localMedia.get(link.mediaId)!, albumIds.get(link.albumId)!],
        );
      for (const [key, value] of Object.entries(backup.settings)) {
        if (value === undefined) continue;
        await connection.runAsync(
          "INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          [key, value],
        );
      }
    });
  });
  notifyLibraryChanged();
  return {
    albums: backup.albums.length,
    media: backup.media.length,
    settings: Object.fromEntries(
      Object.entries(backup.settings).filter((entry) => entry[1] !== undefined),
    ),
  };
}
