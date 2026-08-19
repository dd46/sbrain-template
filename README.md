# Second Brain (GraphRAG + MCP)

Local knowledge base: Markdown notes under `docs/knowledge-base/`, synced into Neo4j, queried from Cursor via MCP tools. Chat sessions live separately in `docs/conversations/`.

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
cp .env.example .env   # set TOKENROUTER_API_KEY if you want DeepSeek Pro
npm run chat           # http://127.0.0.1:3000
```

In the sidebar pick **Ollama** (local, `OPENAI_BASE_URL`) or **DeepSeek Pro** (TokenRouter, `TOKENROUTER_API_KEY`). Ollama stays the default.

Neo4j must be up and the catalog synced for KB search tools to return useful results. Cursor MCP remains available in parallel for IDE chat.

**Voice mode (Głos):** In the sidebar, switch from **Czat** to **Głos** (Chrome recommended). Choose **Przytrzymaj** (default, push-to-talk — best without headphones) or **Wolne ręce** (hands-free, ~1.2 s silence sends the message; use headphones to avoid the mic picking up the speaker). Replies are read aloud (learning body only; Źródła tables and markdown are stripped for TTS). In hands-free mode you can interrupt the agent by speaking again. Firefox/Safari STT is not supported.

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run sync` | Parse `docs/knowledge-base/`, embed bodies locally (Xenova), wipe-reload Neo4j |
| `npm run chat` | Start the local chat UI (`web/`, LangGraph + streaming) |
| `npm run mcp` | Start the MCP server on STDIO (Cursor does this automatically) |
| `npm test` | Parser unit tests (no Docker) |
| `npm run test:integration` | Graph + tool tests (requires Neo4j up) |

## Conventions

- **Root namespace** id is the empty string `""` (`docs/knowledge-base/`).
- **`recommendations.md`** is optional at every folder level.
- **Internal wiki-links** are paths relative to `docs/knowledge-base/` without `.md`, e.g. `[[sailing/basics/wind]]`.

## Reset local Neo4j data

If Bolt auth fails after changing `NEO4J_AUTH`, the existing volume still holds the old password:

```bash
docker-compose down -v
docker-compose up -d
npm run sync
```

## Environment

Copy `.env.example` to `.env` if you need non-default Bolt credentials. Defaults match `docker-compose.yml`.

Chat providers:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | Ollama (OpenAI-compatible local server) |
| `TOKENROUTER_API_KEY` | TokenRouter key for DeepSeek Pro (`https://api.tokenrouter.com/v1`, model `deepseek-v4-pro`) |
| `CHAT_PROVIDER` | Optional default: `ollama` (default) or `deepseek_pro` |
