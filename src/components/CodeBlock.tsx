"use client";

import { useState, ComponentPropsWithoutRef } from "react";

export default function CodeBlock({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"code">) {
  const [copied, setCopied] = useState(false);
  const isBlock =
    className?.includes("hljs") || className?.includes("language-");
  const codeText = String(children).replace(/\n$/, "");

  if (!isBlock) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }

  return (
    <div className="code-block-wrapper">
      <code className={className} {...rest}>
        {children}
      </code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(codeText);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="code-copy-btn flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 text-xs transition"
      >
        {copied ? (
          <>
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy
          </>
        )}
      </button>
    </div>
  );
}
