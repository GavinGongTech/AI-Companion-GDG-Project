import { storageGet, storageRemove } from "./chrome-storage";
import { STORAGE_KEYS } from "./messages";

export type PendingRoute = "quiz";

export async function consumePendingRoute(): Promise<PendingRoute | null> {
  const data = await storageGet<{ navigateTo?: string }>(chrome.storage.session, [STORAGE_KEYS.navigateTo]);
  if (data.navigateTo !== "quiz") {
    return null;
  }

  await storageRemove(chrome.storage.session, STORAGE_KEYS.navigateTo);
  return "quiz";
}
