"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import CodeBlock from "./CodeBlock";
import SourceCitation from "./SourceCitation";
import type { Message } from "@/hooks/useChatStream";

interface ChatMessageProps {
  message: Message;
  index: number;
  isLast: boolean;
  isStreaming: boolean;
  userName?: string | null;
  onPageClick: (page: number) => void;
}

export default function ChatMessage({
  message,
  index,
  isLast,
  isStreaming,
  userName,
  onPageClick,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className={`flex msg-fade-in ${message.role === "user" ? "justify-end" : "justify-start"}`}
    >
      {/* AI avatar */}
      {message.role === "assistant" && (
        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-1">
          <svg
            className="w-3.5 h-3.5 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
      )}

      <div
        className={`max-w-[75%] group relative ${
          message.role === "user"
            ? "bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm shadow-indigo-200"
            : "bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm"
        }`}
      >
        {/* Copy button for AI messages */}
        {message.role === "assistant" && message.content && (
          <button
            onClick={handleCopy}
            className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm hover:bg-gray-50"
            title="Copy response"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}

        {message.role === "assistant" ? (
          <div className="prose prose-sm max-w-none text-gray-700">
            {message.content ? (
              <>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{ code: CodeBlock }}
                >
                  {message.content}
                </ReactMarkdown>
                {isStreaming && isLast && <span className="streaming-cursor" />}
              </>
            ) : (
              isStreaming &&
              isLast && (
                <div className="flex items-center gap-1 py-1">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full typing-dot" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full typing-dot" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full typing-dot" />
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && message.content && (
          <SourceCitation
            sources={message.sources}
            messageIndex={index}
            onPageClick={onPageClick}
          />
        )}
      </div>

      {/* User avatar */}
      {message.role === "user" && (
        <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 ml-2.5 mt-1">
          <span className="text-white text-xs font-bold">
            {userName?.[0]?.toUpperCase() || "U"}
          </span>
        </div>
      )}
    </div>
  );
}
