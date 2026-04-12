"use client";

import { useRef, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import type { DocumentItem } from "@/hooks/useDocuments";

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  documents: DocumentItem[];
  docsLoading: boolean;
  uploading: boolean;
  selectedDoc: string | null;
  onSelectDoc: (docId: string) => void;
  onUploadClick: () => void;
  onClearConversation: () => void;
  hasMessages: boolean;
}

export default function Sidebar({
  userName,
  userEmail,
  documents,
  docsLoading,
  uploading,
  selectedDoc,
  onSelectDoc,
  onUploadClick,
  onClearConversation,
  hasMessages,
}: SidebarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showUserMenu]);

  return (
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
            <p className="text-xs text-slate-400 truncate">{userName}</p>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div className="p-3">
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
            onClick={onUploadClick}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-sm font-medium border border-slate-700 hover:border-slate-600 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Document
          </button>
        )}
      </div>

      {/* Document List */}
      <div className="px-3 mb-2">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">
          Documents
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5 sidebar-scroll">
        {docsLoading ? (
          <div className="space-y-1 px-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 animate-pulse">
                <div className="w-8 h-8 bg-slate-800 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-800 rounded w-3/4" />
                  <div className="h-2 bg-slate-800/60 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center mt-8 px-4">
            <svg className="w-10 h-10 mx-auto text-slate-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-slate-500">No documents yet</p>
            <p className="text-xs text-slate-600 mt-1">Upload a document to get started</p>
          </div>
        ) : (
          documents.map((doc) => (
            <button
              key={doc._id}
              onClick={() => onSelectDoc(doc._id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-start gap-2.5 group ${
                selectedDoc === doc._id
                  ? "bg-indigo-500/20 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  selectedDoc === doc._id
                    ? "bg-indigo-500/30"
                    : "bg-slate-800 group-hover:bg-slate-700"
                }`}
              >
                <svg
                  className={`w-4 h-4 ${selectedDoc === doc._id ? "text-indigo-400" : "text-slate-500"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate text-[13px]">{doc.fileName}</p>
                <p className={`text-xs mt-0.5 ${selectedDoc === doc._id ? "text-indigo-300/70" : "text-slate-600"}`}>
                  {doc.pageCount} pages
                  {doc.createdAt && (
                    <span className="ml-1">&middot; {formatDate(doc.createdAt)}</span>
                  )}
                  {doc.status !== "ready" && (
                    <span className="ml-1 text-amber-400/80">({doc.status})</span>
                  )}
                </p>
              </div>
              {selectedDoc === doc._id && (
                <div className="w-1 h-8 bg-indigo-400 rounded-full shrink-0 mt-0.5" />
              )}
            </button>
          ))
        )}
      </div>

      {/* User profile bar */}
      <div className="relative border-t border-slate-700/50" ref={userMenuRef}>
        {showUserMenu && (
          <div className="absolute bottom-full left-2 right-2 mb-1.5 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-800 truncate">{userName}</p>
              <p className="text-xs text-gray-400 truncate">{userEmail}</p>
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  onClearConversation();
                  setShowUserMenu(false);
                }}
                disabled={!hasMessages}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear conversation
              </button>
            </div>
            <div className="border-t border-gray-100 py-1">
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Log out
              </button>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center gap-2.5 p-3 hover:bg-slate-800 transition"
        >
          <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {userName?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-medium text-slate-200 truncate">{userName}</p>
          </div>
          <svg
            className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${showUserMenu ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
