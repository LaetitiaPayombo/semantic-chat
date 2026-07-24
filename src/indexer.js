/**
 * Indexes documents into the vector store.
 * Supports: .txt, .md  (from docs/ folder) and .pdf (from buffer).
 */

import fs from "node:fs";
import path from "node:path";
import { embed } from "./ollama.js";
import { addChunk, removeSource, saveToDisk } from "./vectorStore.js";

const DOCS_DIR = process.env.DOCS_DIR || "./docs";
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || "500");   // characters
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || "80");

// ─── Chunking ────────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks.
 * @param {string} text
 * @returns {string[]}
 */
function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// ─── Embed & Store ───────────────────────────────────────────────────────────

async function indexChunks(source, chunks) {
  removeSource(source);
  for (let i = 0; i < chunks.length; i++) {
    const vector = await embed(chunks[i]);
    addChunk({ id: `${source}::${i}`, source, chunk: chunks[i], vector });
    if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
      console.error(`[indexer] ${source}: ${i + 1}/${chunks.length} chunks indexed`);
    }
  }
  saveToDisk();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Index all .txt and .md files in the docs/ folder.
 */
export async function indexDocsFolder() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`[indexer] docs folder not found: ${DOCS_DIR}`);
    return;
  }
  const files = fs.readdirSync(DOCS_DIR).filter((f) => /\.(txt|md)$/i.test(f));
  if (files.length === 0) {
    console.error("[indexer] No .txt/.md files found in docs/ folder.");
    return;
  }
  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file);
    const text = fs.readFileSync(filePath, "utf8");
    const chunks = chunkText(text);
    console.error(`[indexer] Indexing ${file} (${chunks.length} chunks)…`);
    await indexChunks(file, chunks);
  }
}

/**
 * Index a PDF from a Buffer. Requires the 'pdf-parse' npm package.
 * @param {string} filename  Original filename (used as source key)
 * @param {Buffer} buffer
 */
export async function indexPdfBuffer(filename, buffer) {
  // Dynamic import so the server still starts even if pdf-parse has quirks
  let pdfParse;
  try {
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    pdfParse = mod.default;
  } catch {
    const mod = await import("pdf-parse");
    pdfParse = mod.default;
  }
  const data = await pdfParse(buffer);
  const text = data.text;
  const chunks = chunkText(text);
  console.error(`[indexer] Indexing PDF ${filename} (${chunks.length} chunks)…`);
  await indexChunks(filename, chunks);
}

/**
 * Index plain text (e.g. pasted content from the UI).
 * @param {string} name  Label used as source key
 * @param {string} text
 */
export async function indexText(name, text) {
  const chunks = chunkText(text);
  console.error(`[indexer] Indexing text '${name}' (${chunks.length} chunks)…`);
  await indexChunks(name, chunks);
}
