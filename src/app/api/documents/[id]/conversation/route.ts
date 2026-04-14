import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { Conversation } from "@/models/Conversation";

export const GET = auth(async function GET(
  request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = request.auth;
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { id: documentId } = await params;

    // Find the most recent conversation for this document and user
    const conversation = await Conversation.findOne({
      userId: session.user.email,
      documentId,
    }).sort({ updatedAt: -1 });

    if (!conversation || conversation.messages.length === 0) {
      return NextResponse.json({ conversationId: null, messages: [] });
    }

    return NextResponse.json({
      conversationId: conversation._id,
      messages: conversation.messages.map(
        (m: { role: string; content: string; sources?: { text: string; pageNumber: number }[] }) => ({
          role: m.role,
          content: m.content,
          sources: m.sources || [],
        })
      ),
    });
  } catch (error: unknown) {
    console.error("Conversation fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
