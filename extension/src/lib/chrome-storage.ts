export interface StorageAreaLike {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
  set(items: Record<string, unknown>): Promise<void> | void;
  remove(keys: string | string[]): Promise<void> | void;
}

export async function storageGet<T extends Record<string, unknown>>(
  area: StorageAreaLike,
  keys: string | string[] | Record<string, unknown>,
): Promise<T> {
  return (await Promise.resolve(area.get(keys))) as T;
}

export async function storageSet(area: StorageAreaLike, items: Record<string, unknown>): Promise<void> {
  await Promise.resolve(area.set(items));
}

export async function storageRemove(area: StorageAreaLike, keys: string | string[]): Promise<void> {
  await Promise.resolve(area.remove(keys));
}
