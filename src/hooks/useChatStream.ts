import { useState, useRef, useEffect, useCallback } from "react";

export interface Source {
  text: string;
  pageNumber: number;
  score: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export function useChatStream(selectedDoc: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset when document changes
  const resetChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  const doStreamChat = useCallback(
    async (userMessage: string) => {
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
    },
    [selectedDoc, conversationId]
  );

  const handleQuickSend = useCallback(
    (text: string) => {
      if (!selectedDoc || isStreaming) return;
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setIsStreaming(true);
      doStreamChat(text);
    },
    [selectedDoc, isStreaming, doStreamChat]
  );

  const handleSend = useCallback(() => {
    if (!input.trim() || !selectedDoc || isStreaming) return;
    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);
    doStreamChat(userMessage);
  }, [input, selectedDoc, isStreaming, doStreamChat]);

  return {
    messages,
    setMessages,
    input,
    setInput,
    isStreaming,
    conversationId,
    setConversationId,
    chatEndRef,
    resetChat,
    handleQuickSend,
    handleSend,
  };
}
