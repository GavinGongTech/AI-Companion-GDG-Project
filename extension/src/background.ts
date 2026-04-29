/// <reference types="chrome" />
import {
  createMessageErrorResponse,
  handleExtensionMessage,
  type BackgroundRuntimeDeps,
} from "./lib/background-runtime";
import { storageGet, storageSet } from "./lib/chrome-storage";
import { STORAGE_KEYS, type ExtensionRuntimeMessage } from "./lib/messages";

const deps: BackgroundRuntimeDeps = {
  localStorage: chrome.storage.local,
  sessionStorage: chrome.storage.session,
  sidePanel: (chrome as any).sidePanel,
  mode: (import.meta.env.MODE as "development" | "production" | "test") || "development",
};

const SIDE_PANEL_PATH = "sidepanel.html";

function configureSidePanel(): void {
  void (chrome as any).sidePanel.setOptions({
    path: SIDE_PANEL_PATH,
    enabled: true,
  });

  if ((chrome as any).sidePanel.setPanelBehavior) {
    void (chrome as any).sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  configureSidePanel();
});

configureSidePanel();

chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
  if (tab.windowId !== undefined) {
    configureSidePanel();
    void (chrome as any).sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  handleExtensionMessage(message as ExtensionRuntimeMessage, sender, deps)
    .then(sendResponse)
    .catch((err: Error) => sendResponse(createMessageErrorResponse(err)));

  return true; // keep channel open
});

chrome.runtime.onMessageExternal.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message?.type !== "AUTH_FROM_WEB") {
    return false;
  }

  const WEB_URL = import.meta.env.VITE_WEB_URL || "http://localhost:5173";
  const allowedWebOrigins = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
  try {
    allowedWebOrigins.add(new URL(WEB_URL).origin);
  } catch {
    // Ignore
  }

  const isSafeWebUrl = (url?: string) => {
    if (!url) return false;
    try {
      return allowedWebOrigins.has(new URL(url).origin);
    } catch {
      return false;
    }
  };

  if (!sender.url || !isSafeWebUrl(sender.url)) {
    sendResponse({ ok: false, error: "Unauthorized sender." });
    return false;
  }

  if (!message.token || !message.user) {
    sendResponse({ ok: false, error: "Missing auth payload." });
    return false;
  }

  storageSet(chrome.storage.session, {
    [STORAGE_KEYS.firebaseIdToken]: message.token,
    [STORAGE_KEYS.authUser]: message.user,
  })
    .then(() => sendResponse({ ok: true }))
    .catch((err: Error) => sendResponse(createMessageErrorResponse(err)));

  return true;
});
