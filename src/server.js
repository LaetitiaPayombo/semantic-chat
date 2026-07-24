/**
 * Express backend for the semantic chat assistant.
 *
 * Routes
 *   GET  /              → serve public/index.html
 *   GET  /api/status    → Ollama reachability + store stats
 *   GET  /api/sources   → list indexed document names
 *   POST /api/index     → trigger re-indexing of docs/ folder
 *   POST /api/upload    → upload a PDF and index it
 *   POST /api/chat      → SSE stream: user message → RAG → LLM reply
 *   DELETE /api/source/:name → remove a source from the store
 */

import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadFromDisk, listSources, search, getStoreSize } from "./vectorStore.js";
import { indexDocsFolder, indexPdfBuffer } from "./indexer.js";
import { embed, chat } from "./ollama.js";
import { removeSource, saveToDisk } from "./vectorStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PORT = process.env.PORT || 3000;

// ─── App setup ───────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Multer: memory storage for uploaded PDFs (max 20 MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health / status
app.get("/api/status", async (_req, res) => {
  let ollamaOk = false;
  try {
    const r = await fetch((process.env.OLLAMA_BASE_URL || "http://localhost:11434") + "/api/tags");
    ollamaOk = r.ok;
  } catch { /* offline */ }
  res.json({
    ollama: ollamaOk,
    chunks: getStoreSize(),
    sources: listSources().length,
  });
});

// List indexed sources
app.get("/api/sources", (_req, res) => {
  res.json({ sources: listSources() });
});

// Trigger indexing of docs/ folder
app.post("/api/index", async (_req, res) => {
  try {
    await indexDocsFolder();
    res.json({ ok: true, chunks: getStoreSize(), sources: listSources() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload & index a PDF
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  if (req.file.mimetype !== "application/pdf" && !req.file.originalname.endsWith(".pdf")) {
    return res.status(400).json({ error: "Only PDF files are accepted" });
  }
  try {
    await indexPdfBuffer(req.file.originalname, req.file.buffer);
    res.json({ ok: true, source: req.file.originalname, chunks: getStoreSize() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove a source
app.delete("/api/source/:name", (req, res) => {
  removeSource(decodeURIComponent(req.params.name));
  saveToDisk();
  res.json({ ok: true, sources: listSources() });
});

// Main chat endpoint — SSE streaming
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    // 1. Embed the last user message
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) throw new Error("No user message found");

    const queryVec = await embed(lastUser.content);

    // 2. Retrieve top-5 relevant chunks
    const results = search(queryVec, 5);
    const hasContext = results.length > 0 && results[0].score > 0.3;

    if (hasContext) {
      const contextBlock = results
        .map((r, i) => `[Source ${i + 1}: ${r.source}]\n${r.chunk}`)
        .join("\n\n---\n\n");
      send("sources", { items: results.map((r) => ({ source: r.source, score: r.score.toFixed(3) })) });

      // 3. Inject context as system message
      const systemPrompt = `You are a helpful assistant. Answer the user's question using ONLY the context below.
If the answer is not in the context, say so clearly.

CONTEXT:
${contextBlock}`;

      const augmentedMessages = [{ role: "system", content: systemPrompt }, ...messages];
      await chat(augmentedMessages, (token) => send("token", { token }));
    } else {
      // No relevant context — answer from general knowledge
      send("sources", { items: [] });
      const fallbackMessages = [
        { role: "system", content: "You are a helpful assistant. No specific documents were found relevant to this question. Answer from your general knowledge." },
        ...messages,
      ];
      await chat(fallbackMessages, (token) => send("token", { token }));
    }

    send("done", {});
  } catch (e) {
    send("error", { message: e.message });
  } finally {
    res.end();
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

loadFromDisk();

app.listen(PORT, () => {
  console.error(`[server] Running at http://localhost:${PORT}`);
  console.error(`[server] Indexing docs/ folder…`);
  indexDocsFolder().catch((e) => console.error("[server] Indexing error:", e.message));
});
