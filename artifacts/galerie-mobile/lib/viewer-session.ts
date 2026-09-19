import type { GalleryAsset, MediaSource, PageCursor } from "./media";
let nextId = 0;
export type ViewerSession = {
  key: string;
  items: GalleryAsset[];
  source: MediaSource;
  cursor: PageCursor;
  hasMore: boolean;
};
let session: ViewerSession | null = null;
export function createViewerSession(
  items: GalleryAsset[],
  source: MediaSource,
  cursor: PageCursor,
  hasMore: boolean,
): string {
  const key = String(++nextId);
  session = { key, items: [...items], source, cursor, hasMore };
  return key;
}
export function getViewerSession(key?: string): ViewerSession | null {
  return session?.key === key ? session : null;
}
export function mediaRoute(id: string, sessionKey?: string) {
  return {
    pathname: "/media/[id]" as const,
    params: { id, ...(sessionKey ? { session: sessionKey } : {}) },
  };
}
