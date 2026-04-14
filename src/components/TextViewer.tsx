"use client";

import { useState, useEffect } from "react";

interface TextViewerProps {
  documentId: string;
  fileName?: string;
  onClose: () => void;
}

export default function TextViewer({
  documentId,
  fileName,
  onClose,
}: TextViewerProps) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchText() {
      try {
        const res = await fetch(`/api/documents/${documentId}/pdf`);
        if (!res.ok) {
          setError("Failed to load document");
          setLoading(false);
          return;
        }
        const content = await res.text();
        setText(content);
      } catch {
        setError("Failed to load document");
      } finally {
        setLoading(false);
      }
    }
    fetchText();
  }, [documentId]);

  return (
    <div className="flex flex-col h-full bg-gray-50 border-l border-gray-200">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="w-4 h-4 text-slate-400 shrink-0"
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
          <span className="text-sm font-medium truncate">
            {fileName || "Document"}
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-700 transition text-slate-300"
          title="Close preview"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Text content */}
      <div className="flex-1 overflow-auto bg-white p-6">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-400 mt-3">Loading document...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
            {text}
          </pre>
        )}
      </div>
    </div>
  );
}
