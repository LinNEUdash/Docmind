import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { dbConnect } from "@/lib/mongodb";
import { Document } from "@/models/Document";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET!,
    });
    if (!token?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const documents = await Document.find(
      { userId: token.email },
      { chunks: 0 }
    ).sort({ createdAt: -1 });

    return NextResponse.json(documents);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch documents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
