import { describe, it, expect } from "vitest";
import {
  splitText,
  smartSplitText,
  cosineSimilarity,
  findRelevantChunks,
  hybridSearch,
  type Chunk,
} from "../rag";

describe("splitText", () => {
  it("should split text into chunks of specified size", () => {
    const text = "a".repeat(2500);
    const chunks = splitText(text, 1000, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBe(1000);
  });

  it("should handle text shorter than chunk size", () => {
    const chunks = splitText("short text", 1000, 200);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("short text");
  });

  it("should apply overlap between chunks", () => {
    const text = "a".repeat(2000);
    const chunks = splitText(text, 1000, 200);
    // With overlap of 200, second chunk starts at position 800
    expect(chunks.length).toBe(3);
  });

  it("should return empty array for empty text", () => {
    const chunks = splitText("", 1000, 200);
    expect(chunks).toHaveLength(0);
  });
});

describe("smartSplitText", () => {
  it("should split by paragraphs", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    const chunks = smartSplitText(text, 1000, 0);
    expect(chunks).toHaveLength(1); // All fit in one chunk
    expect(chunks[0]).toContain("First paragraph");
    expect(chunks[0]).toContain("Third paragraph");
  });

  it("should split into multiple chunks when paragraphs exceed chunk size", () => {
    const para1 = "A".repeat(600);
    const para2 = "B".repeat(600);
    const text = `${para1}\n\n${para2}`;
    const chunks = smartSplitText(text, 800, 0);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain("A");
    expect(chunks[1]).toContain("B");
  });

  it("should split long paragraphs by sentences", () => {
    const longPara =
      "This is sentence one. This is sentence two. This is sentence three. " +
      "This is sentence four. This is sentence five. This is sentence six. " +
      "This is sentence seven. This is sentence eight. This is sentence nine. " +
      "This is sentence ten. This is sentence eleven. This is sentence twelve. " +
      "This is sentence thirteen. This is sentence fourteen. This is sentence fifteen.";
    // Make it exceed chunkSize
    const text = longPara.repeat(5);
    const chunks = smartSplitText(text, 200, 0);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("should handle empty text", () => {
    const chunks = smartSplitText("", 1000, 0);
    expect(chunks).toHaveLength(0);
  });

  it("should preserve text content without losing data", () => {
    const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
    const chunks = smartSplitText(text, 1000, 0);
    const joined = chunks.join(" ");
    expect(joined).toContain("Paragraph one");
    expect(joined).toContain("Paragraph two");
    expect(joined).toContain("Paragraph three");
  });
});

describe("cosineSimilarity", () => {
  it("should return 1 for identical vectors", () => {
    const vec = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
  });

  it("should return 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0);
  });

  it("should return -1 for opposite vectors", () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
  });

  it("should handle zero vectors gracefully", () => {
    const zero = [0, 0, 0];
    const vec = [1, 2, 3];
    expect(cosineSimilarity(zero, vec)).toBe(0);
  });

  it("should be commutative", () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a));
  });

  it("should handle normalized vectors correctly", () => {
    const a = [1 / Math.sqrt(2), 1 / Math.sqrt(2)];
    const b = [1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1 / Math.sqrt(2));
  });
});

describe("findRelevantChunks", () => {
  const chunks: Chunk[] = [
    { text: "about cats", pageNumber: 1, embedding: [1, 0, 0] },
    { text: "about dogs", pageNumber: 2, embedding: [0, 1, 0] },
    { text: "about birds", pageNumber: 3, embedding: [0, 0, 1] },
    { text: "about cats and dogs", pageNumber: 4, embedding: [0.7, 0.7, 0] },
  ];

  it("should return top-K most similar chunks", () => {
    const queryEmbedding = [1, 0, 0]; // Most similar to "cats"
    const results = findRelevantChunks(queryEmbedding, chunks, 2);
    expect(results).toHaveLength(2);
    expect(results[0].text).toBe("about cats");
  });

  it("should sort by score descending", () => {
    const queryEmbedding = [0.5, 0.5, 0];
    const results = findRelevantChunks(queryEmbedding, chunks, 4);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  it("should respect topK parameter", () => {
    const queryEmbedding = [1, 0, 0];
    const results = findRelevantChunks(queryEmbedding, chunks, 1);
    expect(results).toHaveLength(1);
  });

  it("should include pageNumber in results", () => {
    const queryEmbedding = [0, 1, 0]; // Most similar to "dogs"
    const results = findRelevantChunks(queryEmbedding, chunks, 1);
    expect(results[0].pageNumber).toBe(2);
  });
});

describe("hybridSearch", () => {
  const chunks: Chunk[] = [
    { text: "machine learning algorithms", pageNumber: 1, embedding: [1, 0, 0] },
    { text: "deep neural networks", pageNumber: 2, embedding: [0, 1, 0] },
    { text: "natural language processing", pageNumber: 3, embedding: [0, 0, 1] },
    { text: "machine learning with neural networks", pageNumber: 4, embedding: [0.6, 0.6, 0] },
  ];

  it("should return results combining BM25 and vector scores", () => {
    const queryEmbedding = [1, 0, 0]; // Vector: most similar to chunk 0
    const results = hybridSearch(queryEmbedding, "machine learning", chunks, 4);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(4);
  });

  it("should respect topK parameter", () => {
    const queryEmbedding = [1, 0, 0];
    const results = hybridSearch(queryEmbedding, "machine learning", chunks, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("should rank results by fused score descending", () => {
    const queryEmbedding = [0.5, 0.5, 0];
    const results = hybridSearch(queryEmbedding, "neural networks", chunks, 4);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  it("should boost chunks that rank high in both BM25 and vector search", () => {
    // "machine learning" matches chunk 0 and 3 by keyword
    // embedding [0.7, 0.3, 0] is closest to chunk 0 and chunk 3 by vector
    const queryEmbedding = [0.7, 0.3, 0];
    const results = hybridSearch(queryEmbedding, "machine learning", chunks, 2);
    // Chunk 0 ("machine learning algorithms") should rank high in both
    const topTexts = results.map((r) => r.text);
    expect(topTexts).toContain("machine learning algorithms");
  });
});
