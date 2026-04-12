"use client";

import { useState } from "react";
import type { Source } from "@/hooks/useChatStream";

interface SourceCitationProps {
  sources: Source[];
  messageIndex: number;
  onPageClick: (page: number) => void;
}

export default function SourceCitation({
  sources,
  messageIndex,
  onPageClick,
}: SourceCitationProps) {
  const [expandedSource, setExpandedSource] = useState<number | null>(null);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <button
        onClick={() =>
          setExpandedSource(expandedSource === -1 ? null : -1)
        }
        className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expandedSource !== null ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        {sources.length} source{sources.length > 1 ? "s" : ""}
      </button>

      {expandedSource !== null && (
        <div className="mt-2 space-y-1.5">
          {sources.map((source, si) => (
            <button
              key={`${messageIndex}-${si}`}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedSource(expandedSource === si ? -1 : si);
              }}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-medium hover:bg-indigo-100 cursor-pointer transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPageClick(source.pageNumber);
                  }}
                  title="View in PDF"
                >
                  P.{source.pageNumber}
                </span>
                <span className="text-gray-300">score: {source.score}</span>
              </div>
              {expandedSource === si && (
                <p className="text-xs text-gray-500 mt-1.5 pl-3 border-l-2 border-indigo-100 leading-relaxed">
                  {source.text}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
