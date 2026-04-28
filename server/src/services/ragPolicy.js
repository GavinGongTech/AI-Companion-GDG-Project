/**
 * Decide whether we should retrieve course chunks for a query.
 *
 * Without this, tiny/non-academic prompts can still "nearest-neighbor" into
 * unrelated ingested notes and look like a broken/static template response.
 */
export function shouldUseCourseRag(text) {
  const q = String(text ?? "").trim();
  if (!q) return false;

  if (q.length < 24) {
    const looksAcademic =
      /(derive|prove|integral|differentiat|limit|series|matrix|vector|theorem|homework|problem|quiz|exam|lecture|chapter)/i.test(
        q,
      ) || /[=∫∑√^_]/.test(q) || /\d+\s*[+\-*/^]/.test(q);
    if (!looksAcademic) return false;
  }

  return true;
}
