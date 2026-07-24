# Assistant Sémantique Local

Application web de chatbot avec recherche sémantique (RAG) fonctionnant entièrement en local grâce à **Ollama**.

## Architecture

```
semantic-chat/
├── docs/              ← Vos fichiers .txt / .md à indexer
├── public/
│   └── index.html     ← Interface chat (HTML+CSS+JS, aucune dépendance front)
├── src/
│   ├── server.js      ← Serveur Express (API REST + SSE streaming)
│   ├── ollama.js      ← Client Ollama (embeddings + chat)
│   ├── vectorStore.js ← Base vectorielle in-memory + cosine similarity
│   └── indexer.js     ← Découpe & indexe TXT/MD/PDF
├── data/
│   └── vectorStore.json  ← Persistance des embeddings (créé automatiquement)
└── package.json
```

## Prérequis

1. **Node.js 18+** — [nodejs.org](https://nodejs.org)
2. **Ollama** installé et démarré — [ollama.com](https://ollama.com)
3. Les modèles Ollama requis :
   ```bash
   ollama pull nomic-embed-text   # embeddings
   ollama pull llama3             # réponses
   ```

## Installation

```bash
cd semantic-chat
npm install
```

## Démarrage

```bash
npm start
# ou en mode watch (redémarre auto)
npm run dev
```

Ouvrir **http://localhost:3000** dans votre navigateur.

## Utilisation

### Ajouter des documents
- **Dossier `docs/`** : placez vos fichiers `.txt` ou `.md` dans ce dossier. Ils sont indexés automatiquement au démarrage. Cliquez **↻ Ré-indexer docs/** pour recharger après modifications.
- **Upload PDF** : glissez-déposez un fichier PDF sur la zone à gauche, ou cliquez pour parcourir.

### Conversation
- Tapez votre question et appuyez sur **Entrée** (ou ⇧Entrée pour un saut de ligne).
- Les sources utilisées s'affichent sous forme de badges sous chaque réponse.
- Si aucun document n'est pertinent (score < 0.3), le modèle répond depuis ses connaissances générales.

## Variables d'environnement

| Variable          | Défaut                        | Description                      |
|-------------------|-------------------------------|----------------------------------|
| `PORT`            | `3000`                        | Port HTTP                        |
| `OLLAMA_BASE_URL` | `http://localhost:11434`      | URL de l'API Ollama              |
| `EMBED_MODEL`     | `nomic-embed-text`            | Modèle d'embeddings              |
| `CHAT_MODEL`      | `llama3`                      | Modèle de chat                   |
| `DOCS_DIR`        | `./docs`                      | Dossier de documents à indexer   |
| `STORE_PATH`      | `./data/vectorStore.json`     | Fichier de persistance du store  |
| `CHUNK_SIZE`      | `500`                         | Taille max d'un chunk (chars)    |
| `CHUNK_OVERLAP`   | `80`                          | Recouvrement entre chunks        |

## API REST

| Méthode   | Route                    | Description                          |
|-----------|--------------------------|--------------------------------------|
| `GET`     | `/api/status`            | Statut Ollama + statistiques         |
| `GET`     | `/api/sources`           | Liste des sources indexées           |
| `POST`    | `/api/index`             | Ré-indexe le dossier `docs/`         |
| `POST`    | `/api/upload`            | Upload + indexation d'un PDF         |
| `POST`    | `/api/chat`              | Chat SSE (streaming)                 |
| `DELETE`  | `/api/source/:name`      | Supprime une source du store         |
