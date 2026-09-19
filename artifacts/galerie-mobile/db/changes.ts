let revision = 0;
const listeners = new Set<() => void>();
export function notifyLibraryChanged(): void {
  revision += 1;
  for (const listener of listeners) listener();
}
export const getLibraryRevision = () => revision;
export function subscribeLibrary(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
