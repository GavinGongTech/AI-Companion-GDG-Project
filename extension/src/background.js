chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setOptions({
    path: "dist/sidepanel.html",
    enabled: true,
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) {
    void chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INGEST_PAGE") {
    sendResponse({ ok: true });
  }
  return true;
});