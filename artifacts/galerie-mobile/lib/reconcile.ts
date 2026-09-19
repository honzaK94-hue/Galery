type Permission = {
  granted: boolean;
  accessPrivileges?: "all" | "limited" | "none";
};
type Page = {
  assets: { id: string }[];
  hasNextPage: boolean;
  endCursor: string;
};

// A failed, cancelled, partial, or re-authorized scan must never delete DB data.
export async function scanLibrary(options: {
  getPermission: () => Promise<Permission>;
  getPage: (after?: string) => Promise<Page>;
  isCurrent: () => boolean;
  requiredIds?: Set<string>;
}): Promise<{ ids: Set<string>; canPrune: boolean } | null> {
  const before = await options.getPermission();
  if (!before.granted && before.accessPrivileges !== "limited") return null;
  const ids = new Set<string>();
  const remaining = options.requiredIds ? new Set(options.requiredIds) : null;
  let after: string | undefined;
  do {
    if (!options.isCurrent()) return null;
    const page = await options.getPage(after);
    for (const asset of page.assets) {
      ids.add(asset.id);
      remaining?.delete(asset.id);
    }
    if (remaining?.size === 0) break;
    if (!page.hasNextPage) break;
    if (!page.endCursor || page.endCursor === after)
      throw new Error("Knihovnu se nepodařilo úplně načíst.");
    after = page.endCursor;
  } while (true);
  const current = await options.getPermission();
  if (
    !options.isCurrent() ||
    current.granted !== before.granted ||
    current.accessPrivileges !== before.accessPrivileges
  )
    return null;
  return {
    ids,
    canPrune: current.granted && current.accessPrivileges === "all",
  };
}
