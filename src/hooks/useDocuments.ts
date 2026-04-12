import { useState, useEffect, useRef, useCallback } from "react";

export interface DocumentItem {
  _id: string;
  fileName: string;
  pageCount: number;
  status: string;
  pdfPath?: string;
  createdAt?: string;
}

export function useDocuments(sessionReady: boolean) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    const res = await fetch("/api/documents");
    if (res.ok) {
      const data = await res.json();
      setDocuments(data);
    }
    setDocsLoading(false);
  }, []);

  useEffect(() => {
    if (sessionReady) {
      fetchDocuments();
    }
  }, [sessionReady, fetchDocuments]);

  const uploadFile = useCallback(
    async (
      file: File,
      onSuccess?: () => void,
      onError?: (msg: string) => void
    ) => {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      const supportedExts = [".pdf", ".docx", ".txt"];
      if (!file || !supportedExts.includes(ext)) {
        onError?.(`Please select a supported file (${supportedExts.join(", ")})`);
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
          onSuccess?.();
        } else {
          const error = await res.json();
          onError?.("Upload failed: " + error.error);
        }
      } catch {
        onError?.("Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [fetchDocuments]
  );

  // Filter out duplicate processing documents
  const visibleDocuments = documents.filter((doc) => {
    if (doc.status === "processing") {
      const hasReadyVersion = documents.some(
        (d) => d.fileName === doc.fileName && d.status === "ready"
      );
      return !hasReadyVersion;
    }
    return true;
  });

  return {
    documents,
    visibleDocuments,
    docsLoading,
    uploading,
    selectedDoc,
    setSelectedDoc,
    fileInputRef,
    uploadFile,
    fetchDocuments,
  };
}
