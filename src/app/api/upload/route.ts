import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { dbConnect } from "@/lib/mongodb";
import { Document } from "@/models/Document";
import { getEmbedding, smartSplitText } from "@/lib/rag";
import { parseDocument, isSupportedFile, getSupportedExtensions } from "@/lib/parsers";
import fs from "fs";
import path from "path";

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

    const doc = await Document.create({
      userId: token.email,
      fileName: file.name,
      fileSize: file.size,
      pageCount: parsed.pageCount,
      status: "processing",
      chunks: [],
    });

    const textChunks = smartSplitText(parsed.text);
    const chunksWithEmbeddings = [];

    for (let i = 0; i < textChunks.length; i++) {
      const embedding = await getEmbedding(textChunks[i]);
      chunksWithEmbeddings.push({
        text: textChunks[i],
        pageNumber:
          Math.floor((i / textChunks.length) * parsed.pageCount) + 1,
        embedding,
      });
    }

    // Save original file to disk for viewer
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const fileDir = path.join(process.cwd(), "uploads", "files", token.email!);
    fs.mkdirSync(fileDir, { recursive: true });
    const filePath = path.join(fileDir, `${doc._id}${ext}`);
    fs.writeFileSync(filePath, buffer);

    doc.chunks = chunksWithEmbeddings;
    doc.pdfPath = `uploads/files/${token.email}/${doc._id}${ext}`;
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
