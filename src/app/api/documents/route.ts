import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { Document } from "@/models/Document";

export const GET = auth(async function GET(request) {
  try {
    const session = request.auth;
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const documents = await Document.find(
      { userId: session.user.email },
      { chunks: 0 }
    ).sort({ createdAt: -1 });

    return NextResponse.json(documents);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch documents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
