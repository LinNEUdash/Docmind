"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, DragEvent } from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/hooks/useToast";
import { useDocuments } from "@/hooks/useDocuments";
import { useChatStream } from "@/hooks/useChatStream";
import Sidebar from "@/components/Sidebar";
import ChatMessage from "@/components/ChatMessage";
import EmptyState from "@/components/EmptyState";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
});
const TextViewer = dynamic(() => import("@/components/TextViewer"), {
  ssr: false,
});

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { toast, showToast, dismissToast } = useToast();
  const {
    documents,
    visibleDocuments,
    docsLoading,
    uploading,
    selectedDoc,
    setSelectedDoc,
    fileInputRef,
    uploadFile,
    deleteDocument,
  } = useDocuments(!!session);

  const {
    messages,
    setMessages,
    input,
    setInput,
    isStreaming,
    setConversationId,
    chatEndRef,
    resetChat,
    handleQuickSend,
    handleSend,
  } = useChatStream(selectedDoc);

  const [isDragging, setIsDragging] = useState(false);
  const [showPdfPanel, setShowPdfPanel] = useState(false);
  const [targetPage, setTargetPage] = useState<{ page: number; key: number } | null>(null);

  // Auth redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Auto-resize textarea
  function autoResizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  function handleSelectDoc(docId: string) {
    if (docId !== selectedDoc) {
      setSelectedDoc(docId);
      resetChat();
      setTargetPage(null);
      const doc = documents.find((d) => d._id === docId);
      setShowPdfPanel(!!doc?.pdfPath);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile(
      file,
      () => showToast("success", "Document uploaded successfully"),
      (msg) => showToast("error", msg)
    );
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
      uploadFile(
        file,
        () => showToast("success", "Document uploaded successfully"),
        (msg) => showToast("error", msg)
      );
    }
  }

  function handlePageClick(page: number) {
    setShowPdfPanel(true);
    if (isPdf) {
      setTargetPage({ page, key: Date.now() });
    }
  }

  function handleDeleteDoc(docId: string) {
    deleteDocument(
      docId,
      () => {
        showToast("success", "Document deleted");
        if (docId === selectedDoc) {
          resetChat();
          setShowPdfPanel(false);
          setTargetPage(null);
        }
      },
      (msg) => showToast("error", msg)
    );
  }

  function handleClearConversation() {
    setMessages([]);
    setConversationId(null);
  }

  const selectedDocObj = documents.find((d) => d._id === selectedDoc);
  const selectedDocName = selectedDocObj?.fileName;
  const isPdf = selectedDocObj?.fileMimeType === "application/pdf" ||
    selectedDocObj?.fileName?.toLowerCase().endsWith(".pdf");

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
            <p className="text-lg font-semibold text-slate-800">Drop your document here</p>
            <p className="text-sm text-slate-500 mt-1">Supports PDF, DOCX, TXT</p>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 msg-fade-in">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.type === "success" ? (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.message}
            <button onClick={dismissToast} className="ml-1 opacity-70 hover:opacity-100">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        accept=".pdf,.docx,.txt"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
      />

      {/* Sidebar */}
      <Sidebar
        userName={session.user?.name}
        userEmail={session.user?.email}
        documents={visibleDocuments}
        docsLoading={docsLoading}
        uploading={uploading}
        selectedDoc={selectedDoc}
        onSelectDoc={handleSelectDoc}
        onDeleteDoc={handleDeleteDoc}
        onUploadClick={() => fileInputRef.current?.click()}
        onClearConversation={handleClearConversation}
        hasMessages={messages.length > 0}
      />

      {/* Main Chat Area */}
      <div className={`flex flex-col min-w-0 bg-white ${showPdfPanel && selectedDoc ? "w-[55%]" : "flex-1"}`}>
        {selectedDoc ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-3.5 shrink-0 flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-800 truncate text-[15px]">{selectedDocName}</h2>
                <p className="text-xs text-gray-400">Ask questions about this document</p>
              </div>
              {selectedDocObj?.pdfPath && (
                <button
                  onClick={() => setShowPdfPanel(!showPdfPanel)}
                  className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                    showPdfPanel
                      ? "bg-indigo-50 text-indigo-600"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  title={showPdfPanel ? "Hide Preview" : "Show Preview"}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {showPdfPanel ? "Hide Preview" : isPdf ? "View PDF" : "View Text"}
                </button>
              )}
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-6 py-6 chat-scroll"
              style={{ background: "linear-gradient(to bottom, #f8fafc, #ffffff)" }}
            >
              {messages.length === 0 && (
                <EmptyState onQuickSend={handleQuickSend} />
              )}

              <div className="max-w-3xl mx-auto space-y-5">
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={i}
                    message={msg}
                    index={i}
                    isLast={i === messages.length - 1}
                    isStreaming={isStreaming}
                    userName={session.user?.name}
                    onPageClick={handlePageClick}
                  />
                ))}
              </div>
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-6 pb-4 pt-2 shrink-0">
              <div className="max-w-3xl mx-auto">
                <div className="border border-gray-200 rounded-2xl bg-white shadow-sm focus-within:shadow-md focus-within:border-gray-300 transition-all">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    rows={1}
                    onChange={(e) => {
                      setInput(e.target.value);
                      autoResizeTextarea();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask a question about this document..."
                    className="w-full px-5 pt-4 pb-2 text-[15px] bg-transparent text-gray-900 placeholder-gray-400 resize-none focus:outline-none leading-relaxed"
                    disabled={isStreaming}
                    style={{
                      minHeight: "52px",
                      maxHeight: "160px",
                      overflow: input.split("\n").length > 4 ? "auto" : "hidden",
                    }}
                  />
                  <div className="flex items-center justify-between px-3 pb-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
                      title="Upload document"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isStreaming}
                      className="w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {isStreaming ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* No document selected */
          <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
            <div className="text-center max-w-md px-6">
              <div className="relative mx-auto mb-8 w-32 h-32">
                <div className="absolute inset-0 bg-indigo-100/60 rounded-3xl rotate-6" />
                <div className="absolute inset-0 bg-indigo-50 rounded-3xl -rotate-3" />
                <div className="relative w-full h-full bg-white rounded-3xl border border-gray-100 flex items-center justify-center shadow-lg">
                  <svg className="w-14 h-14 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Welcome to DocMind</h2>
              <p className="text-base text-gray-500 mt-3 leading-relaxed">
                Select a document from the sidebar to start asking questions, or upload a new one.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-8 inline-flex items-center gap-2.5 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium text-sm shadow-sm shadow-indigo-200"
              >
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Document
              </button>
              <p className="text-xs text-gray-400 mt-3">
                Supports PDF, DOCX, TXT &mdash; or drag &amp; drop anywhere
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Panel */}
      {showPdfPanel && selectedDoc && (
        <div className="w-[45%] shrink-0 h-full">
          {isPdf ? (
            <PdfViewer
              documentId={selectedDoc}
              fileName={selectedDocName}
              targetPage={targetPage}
              onClose={() => setShowPdfPanel(false)}
            />
          ) : (
            <TextViewer
              documentId={selectedDoc}
              fileName={selectedDocName}
              onClose={() => setShowPdfPanel(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
