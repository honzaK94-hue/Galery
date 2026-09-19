import type { GalleryAsset } from "./media";

export type GridDensity = "comfortable" | "compact" | "overview";
export type TimelineRow =
  | { kind: "heading"; key: string; label: string }
  | { kind: "media"; key: string; items: GalleryAsset[] };

const dayFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("cs-CZ", {
  month: "long",
  year: "numeric",
});
function dayNumber(date: Date): number {
  // Calendar dates, rather than elapsed 24 hours, remain correct across DST.
  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  );
}
export function timelineGroup(
  timestamp: number,
  now = new Date(),
  density: GridDensity = "comfortable",
) {
  if (!Number.isFinite(timestamp) || timestamp <= 0)
    return { key: "unknown", label: "Bez data" };
  const date = new Date(timestamp);
  const age = dayNumber(now) - dayNumber(date);
  const year = date.getFullYear();
  const month = `${year}-${date.getMonth() + 1}`;
  if (density !== "overview" && age >= 0 && age < 30) {
    return {
      key: `${month}-${date.getDate()}`,
      label:
        age === 0 ? "Dnes" : age === 1 ? "Včera" : dayFormatter.format(date),
    };
  }
  if (year < now.getFullYear() - 1)
    return { key: String(year), label: String(year) };
  return { key: month, label: monthFormatter.format(date) };
}

// FlatList virtualizes rows and headings together. No nested, fully mounted grids.
export function createTimelineRows(
  items: GalleryAsset[],
  columns: number,
  grouped: boolean,
  density: GridDensity = "comfortable",
  now = new Date(),
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let groupKey: string | undefined;
  let pending: GalleryAsset[] = [];
  const flush = () => {
    if (pending.length)
      rows.push({
        kind: "media",
        key: `media:${pending[0].id}`,
        items: pending,
      });
    pending = [];
  };
  for (const item of items) {
    if (grouped) {
      const group = timelineGroup(item.creationTime, now, density);
      if (group.key !== groupKey) {
        flush();
        groupKey = group.key;
        rows.push({
          kind: "heading",
          key: `heading:${group.key}:${item.id}`,
          label: group.label,
        });
      }
    }
    pending.push(item);
    if (pending.length === columns) flush();
  }
  flush();
  return rows;
}

export function gridColumns(
  width: number,
  video: boolean,
  density: GridDensity,
): number {
  if (video) return 2;
  const wide = width >= 600;
  return density === "overview"
    ? wide
      ? 8
      : 5
    : density === "compact"
      ? wide
        ? 6
        : 4
      : wide
        ? 4
        : 3;
}
