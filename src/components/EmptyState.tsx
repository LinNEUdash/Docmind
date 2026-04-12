"use client";

interface EmptyStateProps {
  onQuickSend: (text: string) => void;
}

const SUGGESTIONS = [
  {
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    text: "Summarize this document",
  },
  {
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    text: "What are the key points?",
  },
  {
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    text: "Find all dates and deadlines",
  },
  {
    icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    text: "Explain the main argument",
  },
];

export default function EmptyState({ onQuickSend }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="max-w-lg w-full px-4">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-7 h-7 text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-700">
            What would you like to know?
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Choose a suggestion or type your own question
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {SUGGESTIONS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onQuickSend(item.text)}
              className="text-left p-3.5 rounded-xl border border-gray-150 bg-white hover:bg-gray-50 hover:border-gray-200 transition-all group shadow-sm"
            >
              <svg
                className="w-4 h-4 text-indigo-400 mb-2 group-hover:text-indigo-500 transition"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d={item.icon}
                />
              </svg>
              <p className="text-sm text-gray-600 group-hover:text-gray-800 transition leading-snug">
                {item.text}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
