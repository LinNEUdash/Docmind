import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { dbConnect } from "@/lib/mongodb";
import { Document } from "@/models/Document";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function splitText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function parsePDF(
  buffer: Buffer
): Promise<{ text: string; numpages: number }> {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return { text: data.text, numpages: data.numpages };
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET!,
    });
    if (!token?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await parsePDF(buffer);

    if (!pdfData.text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from PDF" },
        { status: 400 }
      );
    }

    const doc = await Document.create({
      userId: token.email,
      fileName: file.name,
      fileSize: file.size,
      pageCount: pdfData.numpages,
      status: "processing",
      chunks: [],
    });

    const textChunks = splitText(pdfData.text);
    const chunksWithEmbeddings = [];

    for (let i = 0; i < textChunks.length; i++) {
      const embedding = await getEmbedding(textChunks[i]);
      chunksWithEmbeddings.push({
        text: textChunks[i],
        pageNumber:
          Math.floor((i / textChunks.length) * pdfData.numpages) + 1,
        embedding,
      });
    }

    doc.chunks = chunksWithEmbeddings;
    doc.status = "ready";
    await doc.save();

    return NextResponse.json({
      id: doc._id,
      fileName: doc.fileName,
      pageCount: doc.pageCount,
      chunkCount: chunksWithEmbeddings.length,
      status: "ready",
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
