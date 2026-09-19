// Native consent dialogs background the Activity and trigger MediaStore events.
// Invalidate reconciliation before opening them, and refresh only after both the
// native result and its SQLite bookkeeping have finished.
let pending = 0;
let revision = 0;
const listeners = new Set<() => void>();
export const isMediaOperationPending = () => pending > 0;
export const getMediaOperationRevision = () => revision;
export function subscribeMediaOperations(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export async function mediaOperation<T>(action: () => Promise<T>): Promise<T> {
  pending++;
  revision++;
  listeners.forEach((listener) => listener());
  try {
    return await action();
  } finally {
    pending--;
    revision++;
    listeners.forEach((listener) => listener());
  }
}
