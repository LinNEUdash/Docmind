import { describe, it, expect } from "vitest";
import { tokenize, BM25Index } from "../bm25";

describe("tokenize", () => {
  it("should convert text to lowercase tokens", () => {
    const tokens = tokenize("Hello World");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
  });

  it("should remove stop words", () => {
    const tokens = tokenize("this is a test of the system");
    expect(tokens).not.toContain("this");
    expect(tokens).not.toContain("is");
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("of");
    expect(tokens).not.toContain("the");
    expect(tokens).toContain("test");
    expect(tokens).toContain("system");
  });

  it("should remove punctuation", () => {
    const tokens = tokenize("hello, world! how's it going?");
    expect(tokens.every((t) => !/[,!?']/.test(t))).toBe(true);
  });

  it("should filter out single-character tokens", () => {
    const tokens = tokenize("I a x am testing");
    expect(tokens).not.toContain("x");
    expect(tokens).toContain("am");
    expect(tokens).toContain("testing");
  });

  it("should handle empty string", () => {
    const tokens = tokenize("");
    expect(tokens).toHaveLength(0);
  });

  it("should split on multiple whitespace types", () => {
    const tokens = tokenize("hello\tworld\nnew  line");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
    expect(tokens).toContain("new");
    expect(tokens).toContain("line");
  });
});

describe("BM25Index", () => {
  const documents = [
    "machine learning algorithms for data analysis",
    "deep learning neural networks architecture",
    "natural language processing with transformers",
    "machine learning and deep learning comparison",
    "database indexing and query optimization",
  ];

  it("should rank relevant documents higher", () => {
    const index = new BM25Index(documents);
    const results = index.search("machine learning", 5);
    // Documents 0 and 3 mention "machine learning"
    const topIndices = results.slice(0, 2).map((r) => r.idx);
    expect(topIndices).toContain(0);
    expect(topIndices).toContain(3);
  });

  it("should return scores in descending order", () => {
    const index = new BM25Index(documents);
    const results = index.search("neural networks deep learning", 5);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  it("should respect topK parameter", () => {
    const index = new BM25Index(documents);
    const results = index.search("machine learning", 2);
    expect(results).toHaveLength(2);
  });

  it("should return 0 score for irrelevant queries", () => {
    const index = new BM25Index(documents);
    const results = index.search("basketball sports", 5);
    // All scores should be 0 since no documents match
    expect(results.every((r) => r.score === 0)).toBe(true);
  });

  it("should handle single-document corpus", () => {
    const index = new BM25Index(["hello world"]);
    const results = index.search("hello", 1);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("should give higher scores to documents with more query term matches", () => {
    const index = new BM25Index(documents);
    const results = index.search("machine learning", 5);
    // Document 3 has both "machine" and "learning" + "deep" and "learning"
    // Document 0 has "machine" and "learning"
    const doc0Score = results.find((r) => r.idx === 0)?.score || 0;
    const doc4Score = results.find((r) => r.idx === 4)?.score || 0;
    expect(doc0Score).toBeGreaterThan(doc4Score);
  });
});
