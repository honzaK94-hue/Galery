import {
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const photosTable = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    objectPath: text("object_path").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    ownerObjectUnique: unique("photos_owner_object_unique").on(
      table.ownerId,
      table.objectPath,
    ),
  }),
);

export const albumsTable = pgTable("albums", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const photoAlbumsTable = pgTable(
  "photo_albums",
  {
    photoId: integer("photo_id")
      .notNull()
      .references(() => photosTable.id, { onDelete: "cascade" }),
    albumId: integer("album_id")
      .notNull()
      .references(() => albumsTable.id, { onDelete: "cascade" }),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.photoId, table.albumId] }),
  }),
);