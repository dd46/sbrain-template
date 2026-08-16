# Knowledge-base MCP runtime — Plan Brief

> Full plan: `context/changes/kb-mcp-runtime/plan.md`

## What & Why

Stand up the first way to *use* the markdown catalog from Cursor: load `docs/` into Neo4j and expose search, document-graph, recommendations, and sync as MCP tools. Spec.md §4–7 already named the pieces; this change makes them real on top of the locked sailing seed.

## Starting Point

The catalog exists (`docs/` sailing tree, root namespace `""`, path wiki-links, optional `recommendations.md`). There is no `package.json`, Docker, sync script, or MCP server. `.gitignore` would currently commit `node_modules/` and `.env`.

## Desired End State

`docker compose up -d` runs Neo4j; `npm run sync` builds the graph (including a real empty-string root Namespace); Cursor lists four MCP tools via a committed `.cursor/mcp.json` and can query the sailing seed. Re-sync is idempotent. Parser tests run without Docker; integration tests require compose.

## Key Decisions Made

| Decision | Choice | Why |
| -------- | ------ | --- |
| MCP process | Host STDIO; compose is Neo4j only | Cursor must spawn STDIO; `compose up` cannot own stdin |
| SDK | v1 `@modelcontextprotocol/sdk` + `zod` | Matches spec package name and Cursor’s 2025 initialize handshake |
| Sync | Wipe-and-reload after full validation | Small catalog; Intent identity is messy; never wipe on parse failure |
| Document properties | Spec fields plus type, tags, prerequisites | Seed already has them; search can use tags without a later migration |
| Compose shape | No `mcp-server` service; Dockerfile still exists | Avoid a headless STDIO container; keep an image recipe |
| Search | Cypher `CONTAINS` on title, summary, tags | Wiki-style substring match; full-text later if volume grows |
| Cursor wiring | Commit `.cursor/mcp.json` + README | Clone → compose → tools, no copy-paste config |
| Verification | `node:test` parser + Docker Neo4j integration | Empty-string ids and Cypher are the bugs unit tests miss |

## Scope

**In scope:** Node ESM project, Neo4j 5.12+APOC compose, shared parser + wipe sync, four MCP tools, `.cursor/mcp.json`, README, tests, `zod` on the spec install line.

**Out of scope:** Editing the sailing seed, HTTP MCP, SDK v2, incremental MERGE, full-text indexes, graphing note `### External` links, TypeScript.

## Architecture / Approach

Cursor spawns `node mcp_server/server.js` over STDIO. That process (and `scripts/sync_to_neo4j.js`) talk Bolt to Neo4j in Docker at `localhost:7687`. Shared `lib/` modules own parse, load, and tool handlers so tests do not go through the MCP protocol. Compose does not run the MCP server.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Runtime foundation | package.json, gitignore, Neo4j compose, unused MCP Dockerfile | APOC YAML quoting / first-boot plugin download |
| 2. Parser + sync | Catalog → graph, constraints, idempotent wipe | Treating `""` as missing; wiping before validation |
| 3. MCP + Cursor | Four tools + `.cursor/mcp.json` | stdout pollution breaking STDIO handshake |
| 4. Verification + docs | tests + README + spec `zod` | Integration tests skipped while graph is wrong |

**Prerequisites:** Docker Desktop (or equivalent), Node 20+, catalog-structure seed on disk.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Neo4j 5.12.0 APOC download needs network on first `compose up`.
- Existing `/data` volume ignores a later `NEO4J_AUTH` change; README must mention `down -v` as local reset.
- SDK v1 `registerTool` inputSchema shape (plain object vs `z.object`) must follow the installed package — verify at implement time.
- Wipe-and-reload assumes the graph holds no extra annotations outside markdown.

## Success Criteria (Summary)

- Browser shows Namespace `""` → `sailing` → children, plus Documents, REFERENCES, Intents/Resources from the seed.
- Cursor can `search_by_namespace`, `get_document_graph`, `get_recommendations`, and `trigger_sync`.
- `npm test` passes offline; `npm run test:integration` passes with compose up.
