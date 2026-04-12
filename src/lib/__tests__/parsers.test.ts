import { describe, it, expect } from "vitest";
import { isSupportedFile, getMimeType, parseTxt, getSupportedExtensions } from "../parsers";

describe("isSupportedFile", () => {
  it("should accept PDF files", () => {
    expect(isSupportedFile("document.pdf")).toBe(true);
    expect(isSupportedFile("DOCUMENT.PDF")).toBe(true);
  });

  it("should accept DOCX files", () => {
    expect(isSupportedFile("document.docx")).toBe(true);
    expect(isSupportedFile("Report.DOCX")).toBe(true);
  });

  it("should accept TXT files", () => {
    expect(isSupportedFile("notes.txt")).toBe(true);
  });

  it("should reject unsupported files", () => {
    expect(isSupportedFile("image.png")).toBe(false);
    expect(isSupportedFile("spreadsheet.xlsx")).toBe(false);
    expect(isSupportedFile("script.js")).toBe(false);
    expect(isSupportedFile("noextension")).toBe(false);
  });
});

describe("getMimeType", () => {
  it("should return correct MIME type for PDF", () => {
    expect(getMimeType("file.pdf")).toBe("application/pdf");
  });

  it("should return correct MIME type for DOCX", () => {
    expect(getMimeType("file.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("should return correct MIME type for TXT", () => {
    expect(getMimeType("file.txt")).toBe("text/plain");
  });

  it("should return null for unsupported types", () => {
    expect(getMimeType("file.png")).toBeNull();
    expect(getMimeType("file.doc")).toBeNull();
  });
});

describe("getSupportedExtensions", () => {
  it("should return all supported extensions", () => {
    const exts = getSupportedExtensions();
    expect(exts).toContain(".pdf");
    expect(exts).toContain(".docx");
    expect(exts).toContain(".txt");
  });
});

describe("parseTxt", () => {
  it("should extract text from buffer", async () => {
    const text = "Hello, this is a test document.\nLine two.";
    const buffer = Buffer.from(text, "utf-8");
    const result = await parseTxt(buffer);
    expect(result.text).toBe(text);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });

  it("should estimate page count based on text length", async () => {
    const longText = "x".repeat(9000); // ~3 pages
    const buffer = Buffer.from(longText, "utf-8");
    const result = await parseTxt(buffer);
    expect(result.pageCount).toBe(3);
  });

  it("should handle empty text", async () => {
    const buffer = Buffer.from("", "utf-8");
    const result = await parseTxt(buffer);
    expect(result.text).toBe("");
    expect(result.pageCount).toBe(1);
  });
});
