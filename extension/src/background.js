const WEB_URL = import.meta.env.VITE_WEB_URL || "http://localhost:5173";
const allowedWebOrigins = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);

try {
  allowedWebOrigins.add(new URL(WEB_URL).origin);
} catch {
  // Ignore invalid config here; the sign-in page will surface the bad URL.
}

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

function isSafeWebUrl(url) {
  try {
    const parsed = new URL(url);
    return allowedWebOrigins.has(parsed.origin);
  } catch {
    return false;
  }
}

function isSafeApiUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INGEST_PAGE") {
    // Store extracted content for the side panel to pick up
    chrome.storage.session.set({
      lastIngestedContent: message.payload,
    });

    // Forward to backend API for ingestion
    ingestToBackend(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));

    return true; // keep channel open for async sendResponse
  }

  if (message.type === "OPEN_ASK") {
    // Store the selected text so Ask page can pre-fill it
    chrome.storage.session.set({
      prefillAsk: message.payload?.selectedText || "",
    });
    // Open the side panel
    if (sender.tab?.windowId !== undefined) {
      void chrome.sidePanel.open({ windowId: sender.tab.windowId });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "OPEN_QUIZ") {
    if (sender.tab?.windowId !== undefined) {
      void chrome.sidePanel.open({ windowId: sender.tab.windowId });
    }
    chrome.storage.session.set({ navigateTo: "quiz" });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type !== "AUTH_FROM_WEB" && message?.type !== "SIGN_OUT_FROM_WEB") {
    return false;
  }

  if (!sender.url || !isSafeWebUrl(sender.url)) {
    sendResponse({ ok: false, error: "Unauthorized sender." });
    return false;
  }

  if (message.type === "SIGN_OUT_FROM_WEB") {
    Promise.all([
      chrome.storage.session.remove(["firebaseIdToken", "authUser"]),
      chrome.storage.local.set({ extensionSignedOut: true }),
    ])
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (!message.token || !message.user) {
    sendResponse({ ok: false, error: "Missing auth payload." });
    return false;
  }

  chrome.storage.session
    .set({
      firebaseIdToken: message.token,
      authUser: message.user,
    })
    .then(() => chrome.storage.local.remove("extensionSignedOut"))
    .then(() => {
      sendResponse({ ok: true });
      if (message.closeAfterAuth && sender.tab?.id) {
        void chrome.tabs.remove(sender.tab.id);
      }
    })
    .catch((err) => sendResponse({ ok: false, error: err.message }));

  return true;
});

async function ingestToBackend(payload) {
  // Read API URL and auth token from storage
  const data = await chrome.storage.local.get(["apiUrl"]);
  const apiUrl = (data.apiUrl || "http://localhost:3000").replace(/\/+$/, "");
  if (!isSafeApiUrl(apiUrl)) {
    throw new Error("Unsafe API URL configuration. Use HTTPS (or localhost for local development).");
  }

  // Try to get the Firebase ID token stored by the side panel auth flow
  const session = await chrome.storage.session.get(["firebaseIdToken"]);
  const token = session.firebaseIdToken;
  if (!token) {
    // User not signed in yet — skip silent ingestion
    return;
  }

  const res = await fetch(`${apiUrl}/api/v1/ingest/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      courseId: payload.courseName || "general",
      rawContent: payload.rawContent,
      sourcePlatform: payload.sourcePlatform,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
}
