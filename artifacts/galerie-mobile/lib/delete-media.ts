// Keep the destructive native operation separate from SQLite bookkeeping.
export async function deleteMedia(
  ids: string[],
  nativeDelete: (ids: string[]) => Promise<boolean>,
  removeRows: (ids: string[]) => Promise<unknown>,
): Promise<boolean> {
  const unique = [...new Set(ids)];
  if (!unique.length) return false;
  if (!(await nativeDelete(unique))) return false;
  await removeRows(unique);
  return true;
}
