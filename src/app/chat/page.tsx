"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface DocumentItem {
  _id: string;
  fileName: string;
  pageCount: number;
  status: string;
}

interface Source {
  text: string;
  pageNumber: number;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [expandedSource, setExpandedSource] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchDocuments();
    }
  }, [session]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchDocuments() {
    const res = await fetch("/api/documents");
    if (res.ok) {
      const data = await res.json();
      setDocuments(data);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        await fetchDocuments();
      } else {
        const error = await res.json();
        alert("Upload failed: " + error.error);
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSelectDoc(docId: string) {
    if (docId !== selectedDoc) {
      setSelectedDoc(docId);
      setMessages([]);
      setConversationId(null);
    }
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedDoc || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDoc,
          message: userMessage,
          conversationId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err.error}` },
        ]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let currentSources: Source[] = [];

      // Add empty assistant message placeholder
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", sources: [] },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "sources") {
              currentSources = data.sources;
              if (data.conversationId) {
                setConversationId(data.conversationId);
              }
            } else if (data.type === "text") {
              assistantContent += data.text;
              const content = assistantContent;
              const sources = currentSources;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content,
                  sources,
                };
                return updated;
              });
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, selectedDoc, isStreaming, conversationId]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const selectedDocName = documents.find((d) => d._id === selectedDoc)?.fileName;

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-900">DocMind</h1>
          <p className="text-sm text-gray-500 mt-1 truncate">
            {session.user?.name}
          </p>
        </div>

        <div className="p-4">
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:bg-blue-300"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              "+ Upload PDF"
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {documents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">
              No documents yet
            </p>
          ) : (
            documents.map((doc) => (
              <button
                key={doc._id}
                onClick={() => handleSelectDoc(doc._id)}
                className={`w-full text-left p-3 rounded-lg text-sm transition ${
                  selectedDoc === doc._id
                    ? "bg-blue-50 border border-blue-200"
                    : "hover:bg-gray-50 border border-transparent"
                }`}
              >
                <p className="font-medium truncate text-gray-800">
                  {doc.fileName}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  {doc.pageCount} pages
                  {doc.status !== "ready" && (
                    <span className="ml-1 text-yellow-500">
                      ({doc.status})
                    </span>
                  )}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedDoc ? (
          <>
            {/* Header */}
            <div className="bg-white border-b px-6 py-3 shrink-0">
              <h2 className="font-medium text-gray-800 truncate">
                {selectedDocName}
              </h2>
              <p className="text-xs text-gray-400">
                Ask questions about this document
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <svg
                      className="w-12 h-12 mx-auto mb-3 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <p>Ask a question about this document</p>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5"
                        : "bg-white border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none text-gray-800">
                        <ReactMarkdown>{msg.content || (isStreaming && i === messages.length - 1 ? "Thinking..." : "")}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && msg.content && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-400 mb-2">
                          Sources
                        </p>
                        <div className="space-y-1">
                          {msg.sources.map((source, si) => (
                            <button
                              key={si}
                              onClick={() =>
                                setExpandedSource(
                                  expandedSource === i * 100 + si
                                    ? null
                                    : i * 100 + si
                                )
                              }
                              className="w-full text-left"
                            >
                              <div className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700">
                                <span className="bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                                  Page {source.pageNumber}
                                </span>
                                <span className="text-gray-400">
                                  relevance: {source.score}
                                </span>
                              </div>
                              {expandedSource === i * 100 + si && (
                                <p className="text-xs text-gray-500 mt-1 pl-2 border-l-2 border-blue-100">
                                  {source.text}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t p-4 shrink-0">
              <div className="flex gap-3 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask a question about this document..."
                  className="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 text-gray-900 placeholder-gray-400"
                  disabled={isStreaming}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed shrink-0"
                >
                  {isStreaming ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    "Send"
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-lg font-medium text-gray-500">
                Upload a PDF to get started
              </p>
              <p className="text-sm mt-1">
                Select a document to ask questions
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
