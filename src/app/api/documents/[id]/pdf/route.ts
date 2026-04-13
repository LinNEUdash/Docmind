import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { Document } from "@/models/Document";

export const GET = auth(async function GET(
  request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = request.auth;
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    await dbConnect();

    const { id } = await params;
    const doc = await Document.findOne({
      _id: id,
      userId: session.user.email,
    }).select("fileBuffer fileMimeType pdfPath");

    if (!doc) {
      return new Response("Not found", { status: 404 });
    }

    // Serve from MongoDB buffer
    if (doc.fileBuffer) {
      const contentType = doc.fileMimeType || "application/pdf";
      return new Response(doc.fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Fallback: try reading from disk (for old uploads before migration)
    if (doc.pdfPath && doc.pdfPath !== "mongodb") {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), doc.pdfPath);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        return new Response(fileBuffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline",
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }

    return new Response("File not found", { status: 404 });
  } catch {
    return new Response("Internal error", { status: 500 });
  }
});
