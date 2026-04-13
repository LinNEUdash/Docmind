import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { Document } from "@/models/Document";
import { getEmbeddings, smartSplitText } from "@/lib/rag";
import { parseDocument, isSupportedFile, getSupportedExtensions, getMimeType } from "@/lib/parsers";

// Vercel serverless: allow up to 60s for large file processing
export const maxDuration = 60;

export const POST = auth(async function POST(request) {
  try {
    const session = request.auth;
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!isSupportedFile(file.name)) {
      return NextResponse.json(
        { error: `Unsupported file type. Supported: ${getSupportedExtensions().join(", ")}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseDocument(buffer, file.name);

    if (!parsed.text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    const mimeType = getMimeType(file.name) || "application/octet-stream";

    const doc = await Document.create({
      userId: session.user.email,
      fileName: file.name,
      fileSize: file.size,
      pageCount: parsed.pageCount,
      status: "processing",
      chunks: [],
      fileBuffer: buffer,
      fileMimeType: mimeType,
    });

    const textChunks = smartSplitText(parsed.text);
    const embeddings = await getEmbeddings(textChunks);

    const chunksWithEmbeddings = textChunks.map((text, i) => ({
      text,
      pageNumber: Math.floor((i / textChunks.length) * parsed.pageCount) + 1,
      embedding: embeddings[i],
    }));

    doc.chunks = chunksWithEmbeddings;
    doc.pdfPath = "mongodb"; // Flag indicating file stored in DB
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
});
