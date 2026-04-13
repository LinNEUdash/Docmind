import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { dbConnect } from "@/lib/mongodb";
import { Document } from "@/models/Document";
import { Conversation } from "@/models/Conversation";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET!,
    });
    if (!token?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { id } = await params;

    // Find and verify ownership
    const doc = await Document.findOne({
      _id: id,
      userId: token.email,
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete all conversations linked to this document
    await Conversation.deleteMany({ documentId: id, userId: token.email });

    // Delete the document from MongoDB
    await Document.deleteOne({ _id: id, userId: token.email });

    // Clean up disk file if it exists (for old uploads)
    if (doc.pdfPath && doc.pdfPath !== "mongodb") {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const filePath = path.join(process.cwd(), doc.pdfPath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Disk cleanup failure is non-critical
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Delete error:", error);
    const message =
      error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
