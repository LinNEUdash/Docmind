export interface ParseResult {
  text: string;
  pageCount: number;
}

const SUPPORTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MIME_MAP);
}

export function isSupportedFile(fileName: string): boolean {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return ext in EXTENSION_MIME_MAP;
}

export function getMimeType(fileName: string): string | null {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return EXTENSION_MIME_MAP[ext] || null;
}

export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return { text: data.text, pageCount: data.numpages };
}

export async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  // Estimate page count: ~3000 characters per page
  const pageCount = Math.max(1, Math.ceil(text.length / 3000));
  return { text, pageCount };
}

export async function parseTxt(buffer: Buffer): Promise<ParseResult> {
  const text = buffer.toString("utf-8");
  // Estimate page count: ~3000 characters per page
  const pageCount = Math.max(1, Math.ceil(text.length / 3000));
  return { text, pageCount };
}

export async function parseDocument(
  buffer: Buffer,
  fileName: string
): Promise<ParseResult> {
  const mimeType = getMimeType(fileName);
  if (!mimeType || !SUPPORTED_TYPES.has(mimeType)) {
    throw new Error(
      `Unsupported file type. Supported formats: ${getSupportedExtensions().join(", ")}`
    );
  }

  switch (mimeType) {
    case "application/pdf":
      return parsePDF(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return parseDocx(buffer);
    case "text/plain":
      return parseTxt(buffer);
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
