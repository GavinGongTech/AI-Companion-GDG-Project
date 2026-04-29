export async function getSelectedTextFromActiveTab(): Promise<string> {
  const tabs = (await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })) as Array<{ id?: number }>;

  const tabId = tabs[0]?.id;
  if (typeof tabId !== "number") {
    return "";
  }

  const results = (await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.getSelection()?.toString() ?? "",
  })) as Array<{ result?: string }>;

  return String(results[0]?.result ?? "");
}
