chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setOptions({
    path: "sidepanel.html",
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
    // Forward to side panel or handle directly
    sendResponse({ ok: true });
  }
  return true;
});
