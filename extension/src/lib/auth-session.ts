import { storageRemove, storageSet, type StorageAreaLike } from "./chrome-storage";
import { STORAGE_KEYS } from "./messages";

export async function persistFirebaseIdToken(
  storageArea: StorageAreaLike,
  token: string | null,
): Promise<void> {
  if (token) {
    await storageSet(storageArea, { [STORAGE_KEYS.firebaseIdToken]: token });
    return;
  }

  await storageRemove(storageArea, STORAGE_KEYS.firebaseIdToken);
}
