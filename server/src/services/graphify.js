const APPROX_CHARS_PER_TOKEN = 4;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "had", "has", "have",
  "he", "her", "his", "i", "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or",
  "our", "ours", "she", "that", "the", "their", "them", "there", "they", "this", "to", "us",
  "was", "we", "were", "what", "when", "where", "which", "who", "why", "with", "you", "your",
]);

/**
 * Fast token estimate for budget enforcement without model-side counting.
 *
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  return Math.ceil(String(text ?? "").length / APPROX_CHARS_PER_TOKEN);
}

function budgetChars(maxTokens) {
  const parsed = Number(maxTokens);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed) * APPROX_CHARS_PER_TOKEN;
}

function tokenize(text) {
  const matches = String(text ?? "").toLowerCase().match(/[a-z0-9]+/g);
  if (!matches) return [];
  return matches.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function topTerms(tokens, limit = 24) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function splitUnits(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const byDivider = normalized
    .split(/\n+\s*---+\s*\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (byDivider.length > 1) return byDivider;

  const byParagraph = normalized
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (byParagraph.length > 1) return byParagraph;

  const bySentence = normalized
    .match(/[^.!?]+[.!?]?/g)
    ?.map((entry) => entry.trim())
    .filter(Boolean);
  return bySentence?.length ? bySentence : [normalized];
}

function jaccardSimilarity(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Reduce prompt text using a lightweight term-to-chunk graph:
 * chunks (nodes) are connected by shared concept terms (edges), then ranked by
 * anchor relevance + graph centrality + redundancy penalty under a token budget.
 *
 * @param {string} text
 * @param {{ anchorText?: string, maxTokens?: number }} [options]
 * @returns {string}
 */
export function graphifyPromptPart(text, options = {}) {
  const source = String(text ?? "").trim();
  if (!source) return "";

  const maxChars = budgetChars(options.maxTokens ?? 0);
  if (maxChars <= 0) return "";
  if (source.length <= maxChars) return source;

  const units = splitUnits(source);
  if (units.length === 0) return source.slice(0, maxChars).trim();

  const anchorTerms = new Set(topTerms(tokenize(options.anchorText ?? "")));
  const nodes = units.map((unit, index) => {
    const tokenSet = new Set(tokenize(unit));
    return {
      index,
      unit,
      tokenSet,
      selected: false,
    };
  });

  const termToNodeIndexes = new Map();
  for (const node of nodes) {
    for (const token of node.tokenSet) {
      if (!termToNodeIndexes.has(token)) termToNodeIndexes.set(token, []);
      termToNodeIndexes.get(token).push(node.index);
    }
  }

  const centralityScores = new Map();
  for (const node of nodes) {
    let total = 0;
    for (const token of node.tokenSet) {
      const degree = termToNodeIndexes.get(token)?.length ?? 0;
      total += Math.log1p(degree);
    }
    const avg = node.tokenSet.size > 0 ? total / node.tokenSet.size : 0;
    centralityScores.set(node.index, avg);
  }

  const selectedIndexes = [];
  const selectedTokenSets = [];
  let usedChars = 0;

  while (usedChars < maxChars) {
    let bestNode = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const node of nodes) {
      if (node.selected) continue;
      const separatorCost = selectedIndexes.length > 0 ? 2 : 0;
      if (usedChars + node.unit.length + separatorCost > maxChars) continue;

      let overlap = 0;
      if (anchorTerms.size > 0) {
        for (const token of node.tokenSet) {
          if (anchorTerms.has(token)) overlap += 1;
        }
        if (overlap === 0) continue;
      }
      const anchorScore = anchorTerms.size > 0
        ? (overlap / anchorTerms.size) * 6 + overlap
        : 0;
      const centralityScore = (centralityScores.get(node.index) ?? 0) * 1.6;
      const earlyPositionBonus = 1 / (1 + node.index);

      let redundancyPenalty = 0;
      if (selectedTokenSets.length > 0) {
        let maxSimilarity = 0;
        for (const selectedSet of selectedTokenSets) {
          maxSimilarity = Math.max(maxSimilarity, jaccardSimilarity(node.tokenSet, selectedSet));
        }
        redundancyPenalty = maxSimilarity * 3;
      }

      const score = anchorScore + centralityScore + earlyPositionBonus - redundancyPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    if (!bestNode) break;
    bestNode.selected = true;
    selectedIndexes.push(bestNode.index);
    selectedTokenSets.push(bestNode.tokenSet);
    usedChars += bestNode.unit.length + (selectedIndexes.length > 1 ? 2 : 0);
  }

  if (selectedIndexes.length === 0) {
    return source.slice(0, maxChars).trim();
  }

  const compact = selectedIndexes
    .sort((a, b) => a - b)
    .map((index) => nodes[index].unit)
    .join("\n\n")
    .trim();

  if (compact.length <= maxChars) return compact;
  return compact.slice(0, maxChars).trim();
}
