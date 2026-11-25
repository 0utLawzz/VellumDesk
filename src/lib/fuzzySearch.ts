import type { ManagedDocument } from '../types/document';

export interface FuzzyMatchResult<T> {
  item: T;
  score: number;
}

/**
 * Computes Damerau/Levenshtein edit distance between two lowercase strings
 * for short typo tolerance on query tokens.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Scores how well `query` fuzzy-matches `target`.
 * Returns `null` if there is no valid match, or a positive numeric score (higher = better).
 */
export function fuzzyScoreText(query: string, target: string): number | null {
  const q = query.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!q) return 1;
  if (!t) return null;

  // 1. Exact match
  if (t === q) return 1200;

  // 2. Prefix match
  if (t.startsWith(q)) return 1000 - (t.length - q.length) * 0.2;

  // 3. Direct substring match (word-boundary bonus)
  const subIdx = t.indexOf(q);
  if (subIdx !== -1) {
    const atWordStart = subIdx === 0 || /[\s\-_/.]/.test(t[subIdx - 1]);
    return (atWordStart ? 860 : 740) - subIdx * 0.5;
  }

  // 4. Ordered character subsequence matching with consecutive & boundary bonuses
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let lastMatchIdx = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      const isBoundary = ti === 0 || /[\s\-_/.]/.test(t[ti - 1]);
      consecutive = lastMatchIdx === ti - 1 ? consecutive + 1 : 1;
      score += 18 + consecutive * 12 + (isBoundary ? 20 : 0);
      if (lastMatchIdx !== -1 && ti - lastMatchIdx > 1) {
        score -= Math.min(10, (ti - lastMatchIdx - 1) * 1.5);
      }
      lastMatchIdx = ti;
      qi++;
    }
  }

  if (qi === q.length) {
    const densityBonus = (q.length / t.length) * 100;
    return Math.max(100, 320 + score + densityBonus);
  }

  // 5. Token-level typo tolerance (e.g., "contarct" -> "contract", "reprt" -> "report")
  if (q.length >= 3) {
    const words = t.split(/[\s\-_/.]+/).filter(Boolean);
    let bestTypoScore: number | null = null;
    const maxAllowedEdits = q.length >= 6 ? 2 : 1;

    for (const word of words) {
      if (Math.abs(word.length - q.length) > maxAllowedEdits) continue;
      const dist = levenshteinDistance(q, word);
      if (dist <= maxAllowedEdits) {
        const candidateScore = 260 - dist * 75 - Math.abs(word.length - q.length) * 5;
        if (bestTypoScore === null || candidateScore > bestTypoScore) {
          bestTypoScore = candidateScore;
        }
      }
    }
    if (bestTypoScore !== null) return bestTypoScore;
  }

  return null;
}

/**
 * Multi-token fuzzy filter across document title and category.
 * Every whitespace-separated query token must fuzzy-match at least one searchable field.
 */
export function fuzzyFilterDocuments(
  documents: ManagedDocument[],
  rawQuery: string
): FuzzyMatchResult<ManagedDocument>[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return documents.map((item) => ({ item, score: 0 }));
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const results: FuzzyMatchResult<ManagedDocument>[] = [];

  for (const doc of documents) {
    const categoryAliases =
      doc.category === 'contract'
        ? ['contract', 'contracts', 'legal contract', 'agreement']
        : ['report', 'reports', 'business report', 'executive report'];

    let totalScore = 0;
    let allTokensMatched = true;

    for (const token of tokens) {
      const titleScore = fuzzyScoreText(token, doc.title);
      let categoryScore: number | null = null;
      for (const alias of categoryAliases) {
        const s = fuzzyScoreText(token, alias);
        if (s !== null && (categoryScore === null || s > categoryScore)) {
          categoryScore = s;
        }
      }

      const bestTokenScore = Math.max(
        titleScore !== null ? titleScore * 1.15 : -1,
        categoryScore !== null ? categoryScore : -1
      );

      if (bestTokenScore < 0) {
        allTokensMatched = false;
        break;
      }
      totalScore += bestTokenScore;
    }

    if (allTokensMatched) {
      // Bonus when the full query string matches the full title closely
      const fullTitleBonus = fuzzyScoreText(trimmed, doc.title);
      results.push({
        item: doc,
        score: totalScore + (fullTitleBonus ?? 0) * 0.5,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
