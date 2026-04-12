import { GoogleGenerativeAI } from "@google/generative-ai";
import { BM25Index } from "./bm25";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- Types ---

export interface Chunk {
  text: string;
  pageNumber: number;
  embedding: number[];
}

export interface ScoredChunk {
  text: string;
  pageNumber: number;
  score: number;
}

// --- Embedding ---

export async function getEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// --- Text Splitting ---

/** Basic fixed-size chunking with overlap */
export function splitText(
  text: string,
  chunkSize = 1000,
  overlap = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

/** Smart paragraph-aware chunking that preserves semantic boundaries */
export function smartSplitText(
  text: string,
  chunkSize = 1000,
  overlap = 200
): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    // If adding this paragraph would exceed chunkSize
    if (currentChunk.length + trimmed.length + 2 > chunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }

      // If a single paragraph exceeds chunkSize, split by sentences
      if (trimmed.length > chunkSize) {
        const sentences = trimmed.match(/[^.!?]+[.!?]+\s*/g) || [trimmed];
        let sentenceChunk = "";
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length > chunkSize) {
            if (sentenceChunk.length > 0) {
              chunks.push(sentenceChunk.trim());
            }
            // If a single sentence exceeds chunkSize, use fixed-size fallback
            if (sentence.length > chunkSize) {
              let start = 0;
              while (start < sentence.length) {
                chunks.push(
                  sentence.slice(start, start + chunkSize).trim()
                );
                start += chunkSize - overlap;
              }
              sentenceChunk = "";
            } else {
              sentenceChunk = sentence;
            }
          } else {
            sentenceChunk += sentence;
          }
        }
        currentChunk = sentenceChunk;
      } else {
        currentChunk = trimmed;
      }
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Add overlap context between chunks
  if (overlap > 0 && chunks.length > 1) {
    const overlappedChunks: string[] = [chunks[0]];
    for (let i = 1; i < chunks.length; i++) {
      const prevText = chunks[i - 1];
      const overlapText = prevText.slice(-overlap).trim();
      overlappedChunks.push(overlapText + "\n\n" + chunks[i]);
    }
    return overlappedChunks;
  }

  return chunks;
}

// --- Vector Similarity ---

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

export function findRelevantChunks(
  queryEmbedding: number[],
  chunks: Chunk[],
  topK = 5
): ScoredChunk[] {
  const scored = chunks.map((chunk) => ({
    text: chunk.text,
    pageNumber: chunk.pageNumber,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// --- Hybrid Search (BM25 + Vector) with Reciprocal Rank Fusion ---

export function hybridSearch(
  queryEmbedding: number[],
  query: string,
  chunks: Chunk[],
  topK = 10,
  rrfK = 60
): ScoredChunk[] {
  // Vector search ranking
  const vectorScored = chunks.map((chunk, idx) => ({
    idx,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  vectorScored.sort((a, b) => b.score - a.score);

  // BM25 keyword search ranking
  const bm25Index = new BM25Index(chunks.map((c) => c.text));
  const bm25Results = bm25Index.search(query, chunks.length);

  // Build rank maps (index -> rank position, 0-based)
  const vectorRankMap = new Map<number, number>();
  vectorScored.forEach((item, rank) => vectorRankMap.set(item.idx, rank));

  const bm25RankMap = new Map<number, number>();
  bm25Results.forEach((item, rank) => bm25RankMap.set(item.idx, rank));

  // Reciprocal Rank Fusion
  const fusedScores = new Map<number, number>();
  const allIndices = new Set([
    ...vectorRankMap.keys(),
    ...bm25RankMap.keys(),
  ]);

  for (const idx of allIndices) {
    let score = 0;
    const vectorRank = vectorRankMap.get(idx);
    if (vectorRank !== undefined) {
      score += 1 / (rrfK + vectorRank + 1);
    }
    const bm25Rank = bm25RankMap.get(idx);
    if (bm25Rank !== undefined) {
      score += 1 / (rrfK + bm25Rank + 1);
    }
    fusedScores.set(idx, score);
  }

  // Sort by fused score and return top-K
  const sorted = Array.from(fusedScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK);

  return sorted.map(([idx, score]) => ({
    text: chunks[idx].text,
    pageNumber: chunks[idx].pageNumber,
    score: Math.round(score * 10000) / 10000,
  }));
}

// --- Reranking with LLM ---

export async function rerankChunks(
  query: string,
  chunks: ScoredChunk[],
  topK = 5
): Promise<ScoredChunk[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a relevance scoring assistant. Rate the relevance of each text passage to the given query on a scale of 0-10.

Query: "${query}"

${chunks.map((c, i) => `[Passage ${i}]: ${c.text.slice(0, 500)}`).join("\n\n")}

Return ONLY a JSON array of scores in order, e.g. [8, 3, 7, ...]. No explanation.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    // Extract JSON array from response
    const match = responseText.match(/\[[\d\s,.]+\]/);
    if (!match) return chunks.slice(0, topK);

    const scores: number[] = JSON.parse(match[0]);
    const reranked = chunks
      .map((chunk, i) => ({
        ...chunk,
        score: scores[i] !== undefined ? scores[i] / 10 : chunk.score,
      }))
      .sort((a, b) => b.score - a.score);

    return reranked.slice(0, topK);
  } catch {
    // Fallback: return original order if reranking fails
    return chunks.slice(0, topK);
  }
}
