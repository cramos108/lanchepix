export function uniqueById<T extends { id: string }>(
  items: T[] | undefined | null,
): T[] {
  return Array.from(new Map((items ?? []).map((item) => [item.id, item])).values());
}

/** Collapse phantom catalog rows that slipped in with different ids. */
export function uniqueCatalogProducts<
  T extends { id: string; name: string; priceCents: number; category: string },
>(items: T[] | undefined | null): T[] {
  const byId = Array.from(new Map((items ?? []).map((item) => [item.id, item])).values());
  return Array.from(
    new Map(
      byId.map((item) => [
        `${item.name.trim().toLowerCase()}|${item.priceCents}|${item.category}`,
        item,
      ]),
    ).values(),
  );
}
