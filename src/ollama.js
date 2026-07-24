/**
 * Thin wrapper around the local Ollama HTTP API.
 * Assumes Ollama is running at http://localhost:11434
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";
const CHAT_MODEL  = process.env.CHAT_MODEL  || "llama3";

/**
 * Generate an embedding vector for a piece of text.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.embedding;
}

/**
 * Send a chat prompt and stream back the full text response.
 * @param {Array<{role:string, content:string}>} messages
 * @param {(token:string)=>void} onToken  called for each streamed token
 * @returns {Promise<string>}  full assistant reply
 */
export async function chat(messages, onToken) {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: CHAT_MODEL, messages, stream: true }),
  });
  if (!res.ok) throw new Error(`Ollama chat error ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const token = obj?.message?.content ?? "";
        if (token) { full += token; onToken(token); }
      } catch { /* ignore partial lines */ }
    }
  }
  return full;
}
