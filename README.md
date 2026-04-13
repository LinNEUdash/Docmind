# DocMind

AI-powered document assistant that lets you upload documents and have intelligent conversations about their content using RAG (Retrieval-Augmented Generation).

## Features

- **Multi-format document support** — Upload and analyze PDF, DOCX, and TXT files
- **Hybrid Search (BM25 + Vector)** — Combines keyword-based BM25 retrieval with semantic vector search using Reciprocal Rank Fusion (RRF)
- **LLM Reranking** — Second-pass reranking of retrieved chunks using Gemini for higher precision
- **Smart chunking** — Paragraph-aware text splitting that preserves semantic boundaries
- **Real-time streaming** — Token-by-token response streaming via Server-Sent Events (SSE)
- **Source citations** — Every answer includes page references with expandable source previews
- **PDF viewer** — Side-by-side document viewing with zoom controls and source-linked page navigation
- **Google OAuth** — Secure authentication with per-user data isolation
- **Document management** — Upload, view, and delete documents with conversation history

## Architecture

```
User Query
    |
    v
[ Smart Chunking ] ← Upload: paragraph-aware splitting + embedding generation
    |
    v
[ Hybrid Search ]
    |--- BM25 keyword search (inverted index, TF-IDF scoring)
    |--- Vector semantic search (cosine similarity on Gemini embeddings)
    |
    v
[ RRF Fusion ] ← Reciprocal Rank Fusion combines both ranking signals
    |
    v
[ LLM Reranking ] ← Gemini scores chunk relevance 0-10, re-sorts top candidates
    |
    v
[ Context Assembly ] ← Top-5 chunks + conversation history
    |
    v
[ Gemini 2.5 Flash ] → Streamed response with page citations
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Auth | NextAuth.js (Google OAuth 2.0, JWT sessions) |
| Database | MongoDB, Mongoose |
| AI/LLM | Google Gemini 2.5 Flash, Gemini Embedding 001 |
| RAG | Custom BM25 + Vector hybrid search, RRF fusion, LLM reranking |
| File Parsing | pdf-parse, mammoth (DOCX), native (TXT) |
| Testing | Vitest (47 unit tests) |
| CI/CD | GitHub Actions |

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB database (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- Google Cloud OAuth credentials
- Google Gemini API key

### Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/LinNEUdash/docmind.git
   cd docmind
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your credentials in `.env.local` (see `.env.example` for required variables).

3. **Run development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Run tests**
   ```bash
   npm test
   ```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # Google OAuth endpoints
│   │   ├── chat/                # Streaming chat with hybrid RAG
│   │   ├── documents/           # Document CRUD operations
│   │   └── upload/              # Multi-format document upload & processing
│   ├── chat/                    # Main chat interface
│   └── page.tsx                 # Login page
├── components/
│   ├── ChatMessage.tsx          # Message bubble with markdown & sources
│   ├── CodeBlock.tsx            # Syntax-highlighted code with copy
│   ├── EmptyState.tsx           # Quick suggestion cards
│   ├── PdfViewer.tsx            # Side-by-side PDF viewer
│   ├── Sidebar.tsx              # Document list & user menu
│   └── SourceCitation.tsx       # Expandable source references
├── hooks/
│   ├── useChatStream.ts         # SSE streaming & message state
│   ├── useDocuments.ts          # Document CRUD & upload logic
│   └── useToast.ts              # Toast notification state
├── lib/
│   ├── bm25.ts                  # BM25 keyword search algorithm
│   ├── mongodb.ts               # Database connection
│   ├── parsers.ts               # PDF/DOCX/TXT document parsers
│   ├── rag.ts                   # Embedding, hybrid search, reranking
│   └── __tests__/               # Unit tests (47 tests)
└── models/
    ├── Conversation.ts          # Chat history schema
    ├── Document.ts              # Document & embeddings schema
    └── User.ts                  # User schema
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload document (PDF/DOCX/TXT), parse, chunk, embed |
| GET | `/api/documents` | List user's documents |
| DELETE | `/api/documents/[id]` | Delete document and associated conversations |
| GET | `/api/documents/[id]/pdf` | Serve document file for viewer |
| POST | `/api/chat` | Query document with hybrid search + streaming response |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project on [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

File storage uses MongoDB (no disk dependency), making the app fully compatible with serverless platforms.

### Environment Variables

See [`.env.example`](.env.example) for the full list of required variables.
