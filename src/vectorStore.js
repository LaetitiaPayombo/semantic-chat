/**
 * In-memory vector store with cosine-similarity search.
 * No external dependencies — embeddings live in RAM and are persisted
 * to a JSON file on disk so they survive restarts.
 */

import fs from "node:fs";
import path from "node:path";

const STORE_PATH = process.env.STORE_PATH || "./data/vectorStore.json";

/** @type {Array<{id:string, source:string, chunk:string, vector:number[]}>} */
let store = [];

// ─── Persistence ────────────────────────────────────────────────────────────

export function loadFromDisk() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
      console.error(`[vectorStore] Loaded ${store.length} chunks from disk.`);
    }
  } catch (e) {
    console.error("[vectorStore] Could not load store:", e.message);
  }
}

export function saveToDisk() {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store));
  } catch (e) {
    console.error("[vectorStore] Could not save store:", e.message);
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Add a chunk + its embedding vector.
 * @param {{id:string, source:string, chunk:string, vector:number[]}} entry
 */
export function addChunk(entry) {
  // Replace existing entry with the same id
  store = store.filter((e) => e.id !== entry.id);
  store.push(entry);
}

/** Remove all chunks belonging to a source file. */
export function removeSource(source) {
  store = store.filter((e) => e.source !== source);
}

/** Return all indexed source names (deduped). */
export function listSources() {
  return [...new Set(store.map((e) => e.source))];
}

export function getStoreSize() {
  return store.length;
}

// ─── Search ──────────────────────────────────────────────────────────────────

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

/**
 * Return the top-k most similar chunks to the query vector.
 * @param {number[]} queryVector
 * @param {number} k
 * @returns {Array<{source:string, chunk:string, score:number}>}
 */
export function search(queryVector, k = 5) {
  return store
    .map((e) => ({ source: e.source, chunk: e.chunk, score: cosineSim(queryVector, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
