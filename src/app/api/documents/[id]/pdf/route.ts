import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { dbConnect } from "@/lib/mongodb";
import { Document } from "@/models/Document";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET!,
    });
    if (!token?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    await dbConnect();

    const { id } = await params;
    const doc = await Document.findOne({
      _id: id,
      userId: token.email,
    }).select("pdfPath");

    if (!doc || !doc.pdfPath) {
      return new Response("Not found", { status: 404 });
    }

    const filePath = path.join(process.cwd(), doc.pdfPath);
    if (!fs.existsSync(filePath)) {
      return new Response("File not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Internal error", { status: 500 });
  }
}
