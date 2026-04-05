"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback, DragEvent } from "react";
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
  const [isDragging, setIsDragging] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showUserMenu]);

  async function fetchDocuments() {
    const res = await fetch("/api/documents");
    if (res.ok) {
      const data = await res.json();
      setDocuments(data);
    }
  }

  async function uploadFile(file: File) {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please select a PDF file");
      return;
    }
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file);
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

  // Filter out duplicate processing documents - only show ready ones, or processing if no ready version exists
  const visibleDocuments = documents.filter((doc) => {
    if (doc.status === "processing") {
      const hasReadyVersion = documents.some(
        (d) => d.fileName === doc.fileName && d.status === "ready"
      );
      return !hasReadyVersion;
    }
    return true;
  });

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 mt-3 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const selectedDocName = documents.find((d) => d._id === selectedDoc)?.fileName;

  return (
    <div
      className="h-screen flex bg-gray-50"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-10 text-center shadow-2xl border-2 border-dashed border-indigo-400">
            <svg className="w-16 h-16 mx-auto text-indigo-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg font-semibold text-slate-800">Drop your PDF here</p>
            <p className="text-sm text-slate-500 mt-1">Release to upload</p>
          </div>
        </div>
      )}

      {/* Sidebar - Dark theme */}
      <div className="w-72 bg-slate-900 flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white">DocMind</h1>
              <p className="text-xs text-slate-400 truncate">{session.user?.name}</p>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div className="p-3">
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
          />
          {uploading ? (
            <div className="rounded-xl bg-slate-800 p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-300">Uploading...</span>
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full upload-progress-bar" />
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-sm font-medium border border-slate-700 hover:border-slate-600 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload PDF
            </button>
          )}
        </div>

        {/* Document List */}
        <div className="px-3 mb-2">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">Documents</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5 sidebar-scroll">
          {visibleDocuments.length === 0 ? (
            <div className="text-center mt-8 px-4">
              <svg className="w-10 h-10 mx-auto text-slate-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-500">No documents yet</p>
              <p className="text-xs text-slate-600 mt-1">Upload a PDF to get started</p>
            </div>
          ) : (
            visibleDocuments.map((doc) => (
              <button
                key={doc._id}
                onClick={() => handleSelectDoc(doc._id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-start gap-2.5 group ${
                  selectedDoc === doc._id
                    ? "bg-indigo-500/20 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {/* File icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  selectedDoc === doc._id
                    ? "bg-indigo-500/30"
                    : "bg-slate-800 group-hover:bg-slate-700"
                }`}>
                  <svg className={`w-4 h-4 ${selectedDoc === doc._id ? "text-indigo-400" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-[13px]">{doc.fileName}</p>
                  <p className={`text-xs mt-0.5 ${selectedDoc === doc._id ? "text-indigo-300/70" : "text-slate-600"}`}>
                    {doc.pageCount} pages
                    {doc.status !== "ready" && (
                      <span className="ml-1 text-amber-400/80">
                        ({doc.status})
                      </span>
                    )}
                  </p>
                </div>
                {/* Selected indicator */}
                {selectedDoc === doc._id && (
                  <div className="w-1 h-8 bg-indigo-400 rounded-full shrink-0 mt-0.5" />
                )}
              </button>
            ))
          )}
        </div>

        {/* User profile bar */}
        <div className="relative border-t border-slate-700/50" ref={userMenuRef}>
          {/* Popup menu */}
          {showUserMenu && (
            <div className="absolute bottom-full left-2 right-2 mb-1.5 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-800 truncate">{session.user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{session.user?.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Log out
              </button>
            </div>
          )}

          {/* Profile button */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-2.5 p-3 hover:bg-slate-800 transition"
          >
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {session.user?.name?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium text-slate-200 truncate">{session.user?.name}</p>
            </div>
            <svg className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${showUserMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Chat Area - White theme */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {selectedDoc ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-3.5 shrink-0 flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-gray-800 truncate text-[15px]">
                  {selectedDocName}
                </h2>
                <p className="text-xs text-gray-400">
                  Ask questions about this document
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 chat-scroll" style={{ background: "linear-gradient(to bottom, #f8fafc, #ffffff)" }}>
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-300"
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
                    </div>
                    <p className="text-base font-medium text-gray-500">Start a conversation</p>
                    <p className="text-sm mt-1 text-gray-400">Ask a question about this document</p>
                  </div>
                </div>
              )}

              <div className="max-w-3xl mx-auto space-y-5">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {/* AI avatar */}
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-1">
                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    )}

                    <div
                      className={`max-w-[75%] ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm shadow-indigo-200"
                          : "bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none text-gray-700">
                          {msg.content ? (
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          ) : (
                            isStreaming && i === messages.length - 1 && (
                              <div className="flex items-center gap-1 py-1">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full typing-dot" />
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full typing-dot" />
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full typing-dot" />
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      )}

                      {/* Sources - collapsible */}
                      {msg.sources && msg.sources.length > 0 && msg.content && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() =>
                              setExpandedSource(
                                expandedSource === i * 1000 ? null : i * 1000
                              )
                            }
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition"
                          >
                            <svg className={`w-3 h-3 transition-transform ${expandedSource !== null && Math.floor(expandedSource / 1000) === i ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""}
                          </button>

                          {expandedSource !== null && Math.floor(expandedSource / 1000) === i && (
                            <div className="mt-2 space-y-1.5">
                              {msg.sources.map((source, si) => (
                                <button
                                  key={si}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedSource(
                                      expandedSource === i * 1000 + si + 1
                                        ? i * 1000
                                        : i * 1000 + si + 1
                                    );
                                  }}
                                  className="w-full text-left"
                                >
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-medium">
                                      P.{source.pageNumber}
                                    </span>
                                    <span className="text-gray-300">
                                      score: {source.score}
                                    </span>
                                  </div>
                                  {expandedSource === i * 1000 + si + 1 && (
                                    <p className="text-xs text-gray-500 mt-1.5 pl-3 border-l-2 border-indigo-100 leading-relaxed">
                                      {source.text}
                                    </p>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* User avatar */}
                    {msg.role === "user" && (
                      <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 ml-2.5 mt-1">
                        <span className="text-white text-xs font-bold">
                          {session.user?.name?.[0]?.toUpperCase() || "U"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-gray-100 p-4 shrink-0">
              <div className="flex gap-2 max-w-3xl mx-auto items-end">
                <div className="flex-1 relative">
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-gray-50/50 text-gray-900 placeholder-gray-400 transition-all"
                    disabled={isStreaming}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shrink-0 shadow-sm shadow-indigo-200"
                >
                  {isStreaming ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state - no document selected */
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-gray-100">
                <svg
                  className="w-10 h-10 text-gray-300"
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
              </div>
              <p className="text-lg font-semibold text-gray-700">
                Upload a PDF to get started
              </p>
              <p className="text-sm mt-1.5 text-gray-400">
                Select a document from the sidebar to ask questions
              </p>
              <p className="text-xs mt-4 text-gray-300">
                Or drag & drop a PDF file anywhere
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
