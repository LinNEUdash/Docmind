import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { Document } from "@/models/Document";
import { Conversation } from "@/models/Conversation";

export const DELETE = auth(async function DELETE(
  request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = request.auth;
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { id } = await params;

    // Find and verify ownership
    const doc = await Document.findOne({
      _id: id,
      userId: session.user.email,
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete all conversations linked to this document
    await Conversation.deleteMany({ documentId: id, userId: session.user.email });

    // Delete the document from MongoDB
    await Document.deleteOne({ _id: id, userId: session.user.email });

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
});
