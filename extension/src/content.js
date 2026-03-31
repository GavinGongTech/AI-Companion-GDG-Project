/**
 * Passive ingestion hook: runs on matched pages (e.g. Brightspace).
 * Replace with DOM scraping / signals to your ingestion API when ready.
 */
const ATTR = "data-study-flow-content";

if (!document.documentElement.getAttribute(ATTR)) {
  document.documentElement.setAttribute(ATTR, "1");
  console.info("[Study Flow] Content script loaded on", window.location.href);
}
