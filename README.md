# Second Brain (GraphRAG + MCP)

Local knowledge base: Markdown notes under `docs/`, synced into Neo4j, queried from Cursor via MCP tools.

See `spec.md` for the full catalog schema (namespaces, notes, `recommendations.md`, wiki-links).

## Prerequisites

- **Node.js 20+**
- **Docker** with Compose (`docker-compose` or `docker compose`)

## First run

```bash
npm install
docker-compose up -d    # or: docker compose up -d
```

Wait until Neo4j is healthy (about 40s on first boot while APOC downloads), then load the catalog:

```bash
npm run sync
```

Open the Neo4j Browser at [http://localhost:7474](http://localhost:7474) — sign in as `neo4j` / `password123`.

### Cursor MCP

This repo includes `.cursor/mcp.json`. Reload the Cursor window (or restart MCP) so the **sbrain** server appears with five tools:

- `search_by_namespace`
- `get_document_graph`
- `get_recommendations`
- `semantic_search`
- `trigger_sync`

Neo4j must be running and the catalog synced before tools return useful results.

### Chat UI (browser)

A local Next.js app runs a LangGraph agent that calls the same `lib/kb-tools.js` helpers as MCP (not through MCP). Conversation memory uses LangGraph **MemorySaver** in the Node process — restarting the chat server clears threads.

```bash
cp .env.example .env   # set OPENAI_API_KEY (and Neo4j vars if needed)
npm run chat           # http://127.0.0.1:3000
```

Neo4j must be up and the catalog synced for KB search tools to return useful results. Cursor MCP remains available in parallel for IDE chat.

**Voice mode (Głos):** In the sidebar, switch from **Czat** to **Głos** (Chrome recommended). Grant microphone access once, then speak naturally — after ~1.2 s of silence the transcript is sent automatically. Replies are read aloud (learning body only; Źródła tables and markdown are stripped for TTS). You can interrupt the agent by speaking again. Headphones reduce echo from the speaker. Firefox/Safari STT is not supported.

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run sync` | Parse `docs/`, embed bodies locally (Xenova), wipe-reload Neo4j |
| `npm run chat` | Start the local chat UI (`web/`, LangGraph + streaming) |
| `npm run mcp` | Start the MCP server on STDIO (Cursor does this automatically) |
| `npm test` | Parser unit tests (no Docker) |
| `npm run test:integration` | Graph + tool tests (requires Neo4j up) |

## Conventions

- **Root namespace** id is the empty string `""` (`docs/`).
- **`recommendations.md`** is optional at every folder level.
- **Internal wiki-links** are paths relative to `docs/` without `.md`, e.g. `[[sailing/basics/wind]]`.

## Reset local Neo4j data

If Bolt auth fails after changing `NEO4J_AUTH`, the existing volume still holds the old password:

```bash
docker-compose down -v
docker-compose up -d
npm run sync
```

## Environment

Copy `.env.example` to `.env` if you need non-default Bolt credentials. Defaults match `docker-compose.yml`.
