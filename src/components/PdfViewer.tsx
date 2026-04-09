"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  documentId: string;
  fileName?: string;
  targetPage?: { page: number; key: number } | null;
  onClose: () => void;
}

export default function PdfViewer({
  documentId,
  fileName,
  targetPage,
  onClose,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const pdfUrl = `/api/documents/${documentId}/pdf`;

  // Track container width for fit-to-width rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setContainerWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  // Compute page width: container width minus padding, scaled
  const pageWidth = containerWidth > 0 ? (containerWidth - 32) * scale : undefined;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  // Track which page is visible
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const setPageRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el);
    } else {
      pageRefs.current.delete(pageNum);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !numPages) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = parseInt(
              entry.target.getAttribute("data-page") || "1"
            );
            setCurrentPage(pageNum);
            break;
          }
        }
      },
      { root: container, threshold: 0.5 }
    );

    pageRefs.current.forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [numPages, scale]);

  // Scroll to target page
  useEffect(() => {
    if (!targetPage) return;
    const el = pageRefs.current.get(targetPage.page);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [targetPage]);

  function handleZoomIn() {
    setScale((s) => Math.min(s + 0.25, 2.5));
  }
  function handleZoomOut() {
    setScale((s) => Math.max(s - 0.25, 0.5));
  }

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
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm font-medium truncate">
            {fileName || "Document"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Page indicator */}
          {numPages && (
            <span className="text-xs text-slate-400 mr-2">
              {currentPage} / {numPages}
            </span>
          )}

          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-700 transition text-slate-300"
            title="Zoom out"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs text-slate-400 w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-700 transition text-slate-300"
            title="Zoom in"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-700 transition text-slate-300 ml-1"
            title="Close preview"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-100"
        style={{ scrollBehavior: "smooth" }}
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-400 mt-3">Loading PDF...</p>
            </div>
          </div>
        )}

        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => setLoading(false)}
          loading=""
          className="flex flex-col items-center py-4 gap-3"
        >
          {numPages &&
            Array.from({ length: numPages }, (_, i) => (
              <div
                key={i + 1}
                ref={(el) => setPageRef(i + 1, el)}
                data-page={i + 1}
                id={`pdf-page-${i + 1}`}
                className="shadow-md bg-white"
              >
                <Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={
                    <div className="bg-white flex items-center justify-center" style={{ width: pageWidth || 595, height: (pageWidth || 595) * 1.414 }}>
                      <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                    </div>
                  }
                />
              </div>
            ))}
        </Document>
      </div>
    </div>
  );
}
