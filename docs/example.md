# Exemple de document de connaissances

Ce fichier est un exemple de document que l'assistant utilisera comme contexte.

## Présentation

L'assistant sémantique est une application web qui combine :
- Un **chatbot** basé sur un modèle de langage local (llama3 via Ollama)
- Une **recherche sémantique** sur vos documents personnels

## Comment fonctionne la recherche sémantique ?

La recherche sémantique fonctionne en trois étapes :

1. **Indexation** : chaque document est découpé en morceaux (chunks) de ~500 caractères. Chaque chunk est transformé en un vecteur numérique (embedding) par le modèle `nomic-embed-text`.

2. **Recherche** : quand vous posez une question, elle est elle aussi transformée en vecteur. L'application calcule la similarité cosinus entre votre question et tous les chunks indexés.

3. **Génération** : les 5 chunks les plus proches sémantiquement sont injectés dans le prompt système du modèle llama3, qui génère une réponse contextualisée.

## Avantages du mode local

- **Confidentialité totale** : aucune donnée ne quitte votre machine
- **Pas de coût d'API** : tout tourne sur votre CPU/GPU local
- **Personnalisable** : vous choisissez vos modèles et vos documents

## Formats supportés

- Fichiers texte (.txt) et Markdown (.md) → placés dans le dossier `docs/`
- PDF → uploadés via l'interface web (glisser-déposer ou clic)

## Astuces

- Pour de meilleures performances, utilisez des chunks courts et précis dans vos documents.
- Vous pouvez supprimer une source depuis la liste à gauche de l'interface.
- Les embeddings sont persistés dans `data/vectorStore.json` et rechargés au redémarrage.
