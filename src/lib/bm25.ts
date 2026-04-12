// BM25 (Best Matching 25) implementation for keyword-based document retrieval

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for",
  "from", "had", "has", "have", "he", "her", "his", "how", "i",
  "if", "in", "into", "is", "it", "its", "let", "may", "no",
  "not", "of", "on", "or", "other", "she", "should", "so",
  "some", "such", "than", "that", "the", "their", "them", "then",
  "there", "these", "they", "this", "to", "was", "we", "were",
  "what", "when", "where", "which", "while", "who", "whom",
  "why", "will", "with", "would", "you", "your",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export interface BM25Result {
  idx: number;
  score: number;
}

export class BM25Index {
  private docs: string[][];
  private avgDl: number;
  private idf: Map<string, number>;
  private k1 = 1.5;
  private b = 0.75;

  constructor(documents: string[]) {
    this.docs = documents.map((doc) => tokenize(doc));
    this.avgDl =
      this.docs.reduce((sum, doc) => sum + doc.length, 0) / this.docs.length ||
      1;
    this.idf = this.computeIDF();
  }

  private computeIDF(): Map<string, number> {
    const N = this.docs.length;
    const df = new Map<string, number>();

    for (const doc of this.docs) {
      const seen = new Set<string>();
      for (const token of doc) {
        if (!seen.has(token)) {
          df.set(token, (df.get(token) || 0) + 1);
          seen.add(token);
        }
      }
    }

    const idf = new Map<string, number>();
    for (const [term, freq] of df) {
      // Standard BM25 IDF formula
      idf.set(term, Math.log((N - freq + 0.5) / (freq + 0.5) + 1));
    }
    return idf;
  }

  search(query: string, topK = 10): BM25Result[] {
    const queryTokens = tokenize(query);
    const scores: BM25Result[] = [];

    for (let i = 0; i < this.docs.length; i++) {
      const doc = this.docs[i];
      const dl = doc.length;
      let score = 0;

      // Count term frequencies in this document
      const tf = new Map<string, number>();
      for (const token of doc) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      for (const token of queryTokens) {
        const termFreq = tf.get(token) || 0;
        if (termFreq === 0) continue;

        const idfScore = this.idf.get(token) || 0;
        // BM25 scoring formula
        const numerator = termFreq * (this.k1 + 1);
        const denominator =
          termFreq + this.k1 * (1 - this.b + this.b * (dl / this.avgDl));
        score += idfScore * (numerator / denominator);
      }

      scores.push({ idx: i, score });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}
