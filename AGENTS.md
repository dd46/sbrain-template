# Repository Guidelines

Local Second Brain: Markdown notes under `docs/`, synced to Neo4j, queried from Cursor via the **sbrain** MCP server. Stack: Node.js 20+, Docker (Neo4j). See @README.md and @spec.md for the full catalog schema.

## Personal knowledge (non-app prompts)

When the user asks about **anything other than building or changing this Second Brain app**, treat `docs/` as the **source of truth** for their current knowledge — not the open web or model training data.

1. **Search the KB first.** Use MCP tools (`search_by_namespace`, `get_document_graph`, `get_recommendations`) or read files under `docs/` directly. Namespace ids are dotted folder paths (e.g. `sailing.licenses_certificates`); root is `""`.
2. **Respect note metadata.** `status` (`draft` | `consumed` | `mastered`), `summary`, `tags`, and `prerequisites` reflect what the user already knows or is learning. Align answers with that level.
3. **Follow the graph.** Use `get_document_graph` and wiki-links (`[[sailing/basics/wind]]`) to pull related notes before answering.
4. **Check recommendations.** `recommendations.md` at each namespace level lists intents the user wanted to explore — use them when the question is exploratory.
5. **Persist every answer.** Any new information you provide **must** be written to `docs/` in the same turn (create or update `.md` files per @spec.md). Do not only answer in chat. Do not ask permission — save first, then summarize what you wrote. Web search is a fallback for gaps, not a substitute for persisting the result.
6. **Sync and commit yourself.** After `docs/` edits run `npm run sync` (start Neo4j with `docker-compose up -d` if needed). Commit all changes from the turn with a concise message. **Do not push** unless the user explicitly asks.
7. **Hooks enforce this.** @.cursor/rules/kb-persist.mdc applies to every session. @.cursor/hooks.json runs `sessionStart` (inject policy) and `stop` (auto-follow-up if web research was used without a `docs/` write).

App-development prompts (MCP server, sync, tests, infra, `context/changes/`) follow the repo sections below instead.

## Project structure

| Path | Role |
|------|------|
| `docs/` | Knowledge base (namespaces, notes, `recommendations.md`) |
| `lib/` | Parser, Neo4j sync, KB query helpers |
| `mcp_server/` | MCP server (`sbrain`) |
| `scripts/sync_to_neo4j.js` | Catalog → Neo4j loader |
| `context/` | Change plans and foundation docs (app work) |

## Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `docker-compose up -d` | Start Neo4j |
| `npm run sync` | Reload graph from `docs/` |
| `npm test` | Parser unit tests (no Docker) |
| `npm run test:integration` | Graph + MCP tool tests (Neo4j required) |

Neo4j Browser: http://localhost:7474 (`neo4j` / `password123`). MCP config: @.cursor/mcp.json.

## Conventions

- Root namespace id is `""` (`docs/`). Nested ids match folder paths with dots.
- Wiki-links: paths relative to `docs/`, no `.md` suffix (e.g. `[[sailing/basics/wind]]`).
- `recommendations.md` is optional at every folder level.
- After editing `docs/`, run `npm run sync` in the same turn (agent runs it; start Neo4j if needed).

## Testing

- Unit: `tests/parse-catalog.test.js` — no Docker.
- Integration: `tests/integration/` — requires Neo4j up and synced.

## Commits

Recent history uses short imperative subjects (e.g. `Add kb MCP runtime`). Keep messages concise; focus on why.

**Agent workflow:** commit when a turn changes files; **never push** unless the user explicitly requests it.
