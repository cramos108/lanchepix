export function uniqueById<T extends { id: string }>(
  items: T[] | undefined | null,
): T[] {
  return Array.from(new Map((items ?? []).map((item) => [item.id, item])).values());
}
