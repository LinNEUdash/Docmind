import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { Document } from "@/models/Document";
import { Conversation } from "@/models/Conversation";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getEmbedding, hybridSearch } from "@/lib/rag";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Vercel serverless: allow up to 60s for large file processing
export const maxDuration = 60;

/** Check if an error is a Gemini rate-limit (429) error */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("429") || error.message.includes("Too Many Requests");
  }
  return false;
}

/** Extract retry delay (seconds) from a Gemini 429 error message */
function getRetryDelay(error: unknown): number {
  if (error instanceof Error) {
    const match = error.message.match(/retry\s*in\s*([\d.]+)/i);
    if (match) return Math.ceil(parseFloat(match[1]));
  }
  return 10; // default 10s
}

/** Sleep for a given number of milliseconds */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const POST = auth(async function POST(request) {
  try {
    const session = request.auth;
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { documentId, message, conversationId } = await request.json();
    if (!documentId || !message) {
      return new Response(
        JSON.stringify({ error: "documentId and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await dbConnect();

    const doc = await Document.findOne({
      _id: documentId,
      userId: session.user.email,
    });
    if (!doc || doc.status !== "ready") {
      return new Response(
        JSON.stringify({ error: "Document not found or not ready" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: session.user.email,
        documentId,
      });
    }
    if (!conversation) {
      conversation = await Conversation.create({
        userId: session.user.email,
        documentId,
        messages: [],
      });
    }

    // Hybrid Search: BM25 + Vector with RRF fusion
    let queryEmbedding: number[];
    try {
      queryEmbedding = await getEmbedding(message);
    } catch (embErr) {
      if (isRateLimitError(embErr)) {
        const delay = getRetryDelay(embErr);
        await sleep(Math.min(delay, 45) * 1000);
        queryEmbedding = await getEmbedding(message);
      } else {
        throw embErr;
      }
    }

    // Hybrid search already combines BM25 + vector with RRF fusion
    const relevantChunks = hybridSearch(queryEmbedding, message, doc.chunks, 5);

    // Check if document is single-page (no meaningful page distinctions)
    const isSinglePage = doc.pageCount <= 1;

    const context = relevantChunks
      .map(
        (c, i) =>
          isSinglePage
            ? `[Source ${i + 1}]\n${c.text}`
            : `[Source ${i + 1}, Page ${c.pageNumber}]\n${c.text}`
      )
      .join("\n\n");

    // Build conversation history for context (last 10 messages)
    const recentHistory = conversation.messages.slice(-10);
    const historyText = recentHistory
      .map(
        (m: { role: string; content: string }) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
      )
      .join("\n");

    const citationInstruction = isSinglePage
      ? "Do NOT include any citations, source references, or page numbers in your response. Just answer naturally."
      : "Cite your sources using [Page X] format. ONLY use the exact page numbers shown in the source headers. Do NOT infer or invent page numbers.";

    const systemPrompt = `You are DocMind, an AI document assistant. Answer questions based ONLY on the provided document context. If the context doesn't contain enough information to answer, say so clearly.

${citationInstruction}

Document: "${doc.fileName}"

Relevant excerpts from the document:
${context}

${historyText ? `Previous conversation:\n${historyText}\n` : ""}
User question: ${message}

Provide a clear, accurate answer based on the document excerpts above. ${citationInstruction}`;

    // Save user message
    conversation.messages.push({ role: "user", content: message });
    await conversation.save();

    // Stream response from Gemini with rate-limit retry
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let result;
    try {
      result = await model.generateContentStream(systemPrompt);
    } catch (genErr) {
      if (isRateLimitError(genErr)) {
        const delay = getRetryDelay(genErr);
        await sleep(Math.min(delay, 45) * 1000);
        result = await model.generateContentStream(systemPrompt);
      } else {
        throw genErr;
      }
    }

    const sources = relevantChunks.map((c) => ({
      text: c.text.slice(0, 200) + (c.text.length > 200 ? "..." : ""),
      pageNumber: c.pageNumber,
      score: Math.round(c.score * 100) / 100,
    }));

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send sources first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "sources", sources, conversationId: conversation._id })}\n\n`
            )
          );

          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              fullResponse += text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", text })}\n\n`
                )
              );
            }
          }

          // Save assistant response
          conversation.messages.push({
            role: "assistant",
            content: fullResponse,
            sources: sources.map((s) => ({
              text: s.text,
              pageNumber: s.pageNumber,
            })),
          });
          await conversation.save();

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: "Generation failed" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("Chat error:", error);

    // Friendly error message for rate limits
    if (isRateLimitError(error)) {
      const delay = getRetryDelay(error);
      return new Response(
        JSON.stringify({
          error: `API rate limit reached. Please wait ${delay} seconds and try again.`,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const message =
      error instanceof Error ? error.message : "Chat failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
