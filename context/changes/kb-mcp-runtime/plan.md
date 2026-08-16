# Knowledge-base MCP runtime Implementation Plan

## Overview

Stand up the first operational backend for the docs catalog: a Node.js ESM project, Neo4j 5.12 in Docker with APOC, a wipe-and-reload sync from `docs/` into a namespaced graph, and a host STDIO MCP server so Cursor can search, inspect a document graph, list recommendations, and trigger sync. The existing sailing seed is the fixture — this change does not edit catalog content.

## Current State Analysis

`catalog-structure` locked the parser contracts. Nothing from spec.md §4–7 exists on disk yet.

- Seed tree is complete and English: `docs/` → `sailing` → `basics` / `licenses_certificates`, with `recommendations.md` at each level plus `wind.md` and `sailing_certificate.md`.
- Root namespace is the empty string (`docs/recommendations.md` uses `namespace: ""`). Nested files use dotted folder ids.
- Internal wiki-links are `docs/`-relative paths without `.md`: `[[sailing/basics/wind]]` and `[[sailing/licenses_certificates/sailing_certificate]]`.
- `recommendations.md` is optional; the four copies in the seed are demonstrations, not a requirement.
- No `package.json`, `scripts/`, `mcp_server/`, `docker-compose.yml`, tests, or README. `.gitignore` only ignores local skill symlinks — `node_modules/` and `.env` would be committed.
- Spec §5 lists an `mcp-server` compose service that “exposes MCP via STDIO”. That combination cannot work as a long-running `compose up` daemon: Cursor must spawn the STDIO process. Planning chose host STDIO + Neo4j-only compose.

## Desired End State

After `docker compose up -d` and `npm run sync`, Neo4j holds Namespace / Document / Intent / Resource nodes that match the sailing seed, including a real root Namespace with `id: ""`. Cursor, via a committed `.cursor/mcp.json`, can call four tools against that graph without hand-editing config. Re-running sync against the same tree is idempotent. Parser and graph contracts are covered by `node --test`.

### Key Discoveries:

- Empty-string `Namespace.id` is load-bearing (`context/changes/catalog-structure/plan.md` Critical Implementation Details; `spec.md` §2). JavaScript `if (!id)` and Cypher `WHERE n.id` both treat `""` as missing — always compare with `===` / `n.id = $id`.
- Wiki-link identity is the Document `path` (`sailing/basics/wind`), not a filename stem (`context/changes/catalog-structure/plan.md` lines 45–46).
- `@modelcontextprotocol/sdk` v1 is the spec-named package and the one Cursor’s 2025-era initialize handshake expects. `zod` is a required peer and is missing from spec §7’s install list.
- MCP STDIO: `stdout` is JSON-RPC only. `console.log` or neo4j-driver logs on stdout break the handshake. Log on stderr.
- `NEO4J_PLUGINS` must be a JSON *string* in compose YAML (`'["apoc"]'`), not a YAML array. Use `NEO4J_PLUGINS`, not `NEO4JLABS_PLUGINS`.
- Intent has no spec-natural unique key besides heading text. Denormalize `namespaceId` (including `""`) onto Intent so the same heading in two namespaces cannot collapse into one node.
- Validate the whole catalog *before* `DETACH DELETE`. A parse error after wipe would empty the database.

## What We're NOT Doing

- Editing `docs/` seed content or `spec.md` catalog conventions (already locked).
- A long-running `mcp-server` compose service, Streamable HTTP MCP, or Docker-spawned STDIO (`compose run`).
- `@modelcontextprotocol/server` (SDK v2 / 2026-07-28 spec).
- Incremental MERGE sync, full-text / Lucene indexes, or APOC Cypher in the sync/MCP paths (APOC is enabled because spec §5 asks; core Cypher is enough).
- Graphing `### External` URLs from regular notes — only `recommendations.md` links become `(:Resource)`.
- Storing extra annotations in Neo4j that are not sourced from markdown (wipe would destroy them).
- Auth beyond compose `NEO4J_AUTH=neo4j/password123`, TLS, or a remote Neo4j.
- TypeScript, a bundler, or a test framework other than Node’s built-in test runner.

## Implementation Approach

Keep runtime I/O at the edges and put catalog/graph logic in shared `lib/` modules so tests call the same functions as the CLI and MCP tools.

1. Scaffold the Node ESM project and a Neo4j-only compose file so Bolt is reachable at `localhost:7687`.
2. Parse `docs/` into a validated in-memory catalog, then wipe-and-reload Neo4j in one write transaction with uniqueness constraints.
3. Expose that graph through four MCP tools on host STDIO; commit Cursor wiring.
4. Prove the seed fixture with parser tests (no Docker) and integration tests (compose must be up).

## Critical Implementation Details

**Empty-string root.** Always `SET n.id = $id` with `$id: ''` for `docs/`. Do not omit the property. Root `name` is `"docs"`. Root has no `CHILD_OF`. `sailing` `CHILD_OF` `""`. Zod schemas for `namespace_id` must be `z.string()` with no `.min(1)`.

**Sync ordering.** (1) Parse + validate every markdown file. (2) If any error, exit non-zero and do not touch the graph. (3) `CREATE CONSTRAINT … IF NOT EXISTS`. (4) One `executeWrite`: delete existing Namespace/Document/Intent/Resource nodes, then create the new graph. Constraints survive node deletion.

**STDIO hygiene.** `mcp_server/server.js` must not write to stdout except via the SDK transport. `trigger_sync` captures the child process stdout/stderr into the *tool result*. Neo4j driver logging, if any, goes to stderr.

**Host Bolt URI.** Cursor-spawned MCP and `npm run sync` use `bolt://localhost:7687`. Never `bolt://neo4j:7687` on the host. `neo4j://` (routing) is wrong for a single Docker instance.

**Wiki-link → path.** Strip optional `.md` and a leading `/`. `[[sailing/basics/wind]]` → Document.path `sailing/basics/wind`. Dangling targets still get a stub `(:Document {path, status: "missing"})` and a `REFERENCES` edge; sync summary lists them. Do not abort the load.

**Intent identity.** `(:Intent {query, namespaceId})` with a uniqueness constraint on `(query, namespaceId)`. `namespaceId` is `""` at root. `[:BELONGS_TO]` still points at the Namespace node.

---

## Phase 1: Runtime foundation

### Overview

Create the Node.js project, ignore secrets/deps, and start Neo4j 5.12 with APOC. After this phase a developer can open the Neo4j Browser; there is still no graph data.

### Changes Required:

#### 1. Node project manifest

**File**: `package.json`

**Intent**: Declare an ESM Node 20+ app with the spec packages plus `zod`, and scripts for sync, MCP, and tests.

**Contract**: `"type": "module"`, `"engines": { "node": ">=20" }`. Dependencies: `neo4j-driver`, `@modelcontextprotocol/sdk`, `gray-matter`, `zod`. Scripts: `sync` → `node scripts/sync_to_neo4j.js`; `mcp` → `node mcp_server/server.js`; `test` → `node --test tests/parse-catalog.test.js`; `test:integration` → `node --test tests/integration/`. Do not add TypeScript.

#### 2. Git ignore

**File**: `.gitignore`

**Intent**: Keep the existing skill-symlink rules and stop `node_modules/` and `.env` from being committed.

**Contract**: Add `node_modules/` and `.env`. Do not ignore `.cursor/mcp.json` or `.env.example`.

#### 3. Env template and in-code defaults

**File**: `.env.example`

**Intent**: Document Bolt credentials matching compose without adding a `dotenv` dependency.

**Contract**: `NEO4J_URI=bolt://localhost:7687`, `NEO4J_USERNAME=neo4j`, `NEO4J_PASSWORD=password123`, `DOCS_ROOT` relative to repo root (`docs`). Runtime code reads `process.env` and falls back to these same defaults.

#### 4. Neo4j compose

**File**: `docker-compose.yml`

**Intent**: Run the spec-pinned Neo4j image with Browser + Bolt ports, auth, and APOC, as the only compose service.

**Contract**: Image `neo4j:5.12.0`. Ports `7474:7474` and `7687:7687`. `NEO4J_AUTH=neo4j/password123`. `NEO4J_PLUGINS: '["apoc"]'` (JSON string). Named volumes for `/data` and `/plugins`. Healthcheck via `cypher-shell`. No `mcp-server` service.

#### 5. MCP image (unused by compose)

**File**: `mcp_server/Dockerfile`

**Intent**: Keep a reproducible Node 20 image for the server so a later Docker-STDIO path is possible without inventing a Dockerfile then.

**Contract**: `FROM node:20` (or `node:20-alpine`). Workdir copies `package.json`, `lib/`, `scripts/`, `mcp_server/`. `CMD` runs `node mcp_server/server.js`. Compose does not build or start this image.

### Success Criteria:

#### Automated Verification:

- `test -f package.json` and `node -e "const p=require('./package.json'); if(p.type!=='module') process.exit(1)"` (or equivalent ESM read) confirms `"type": "module"`.
- `npm install` exits 0; `npm ls neo4j-driver @modelcontextprotocol/sdk gray-matter zod` succeeds.
- `rg -n 'node_modules/|\.env$' .gitignore` matches both entries.
- `docker compose config` exits 0; the rendered service list contains `neo4j` and does not contain `mcp-server`.
- `rg -n "neo4j:5.12.0" docker-compose.yml` and `rg -n "NEO4J_PLUGINS" docker-compose.yml` match; plugins value is the JSON string `["apoc"]`.
- `test -f mcp_server/Dockerfile` and the file contains `FROM node:20`.

#### Manual Verification:

- `docker compose up -d` then open `http://localhost:7474`, sign in as `neo4j` / `password123`.
- In Browser, `RETURN apoc.version()` (or `SHOW PROCEDURES YIELD name WHERE name STARTS WITH 'apoc' RETURN name LIMIT 1`) returns a row.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Catalog parser + sync

### Overview

Turn `docs/` into a validated catalog object, then load it into Neo4j with wipe-and-reload. After this phase the sailing seed is queryable in Browser.

### Changes Required:

#### 1. Catalog parser

**File**: `lib/parse-catalog.js`

**Intent**: Recursively walk `DOCS_ROOT`, parse YAML with `gray-matter`, and return namespaces, documents, wiki-link edges, and recommendation intents without talking to Neo4j.

**Contract**:
- Directory `docs/` → Namespace `{ id: "", name: "docs" }`. Nested dirs → dotted ids (`sailing.basics`), `name` = last segment, `CHILD_OF` parent id (parent of `sailing` is `""`).
- Regular notes (not `recommendations.md`): Document `{ title, path, summary, status, type, tags, prerequisites }` where `path` is docs-relative without `.md`. Frontmatter `namespace` must equal the folder-derived id (`""` only for files directly in `docs/`).
- Internal wiki-links under `## References` / `### Internal` become edges `{ fromPath, toPath }`.
- Files with `type: "recommendations"` are *not* Documents. Each `#` heading is an Intent `{ query, namespaceId }`; each markdown/URI list item underneath is a Resource `{ title, url }` linked to that intent. Missing `recommendations.md` is valid.
- Collect all validation errors; do not throw on the first file.

#### 2. Graph loader

**File**: `lib/sync-graph.js`

**Intent**: Apply uniqueness constraints and replace catalog nodes so the database matches the parsed catalog.

**Contract**: Constraints (IF NOT EXISTS): `Namespace.id` unique, `Document.path` unique, `Resource.url` unique, `Intent (query, namespaceId)` unique. Wipe labels `Namespace`, `Document`, `Intent`, `Resource` only. Create `(:Namespace)-[:CHILD_OF]->(:Namespace)`, `(:Document)-[:BELONGS_TO]->(:Namespace)`, `(:Document)-[:REFERENCES]->(:Document)` (stubs for dangling `toPath`), `(:Intent)-[:BELONGS_TO]->(:Namespace)`, `(:Resource)-[:RECOMMENDED_FOR]->(:Intent)`. Return a summary: counts + dangling paths. Do not call `apoc.*`.

#### 3. Driver helper

**File**: `lib/neo4j.js`

**Intent**: One place to construct the driver from env/defaults and close it.

**Contract**: Reads `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`. URI default `bolt://localhost:7687`.

#### 4. Sync CLI

**File**: `scripts/sync_to_neo4j.js`

**Intent**: Orchestrate parse → abort on errors → load → print JSON summary on stdout (this process is not the MCP server).

**Contract**: Exit 1 if parse errors or Bolt fails. Exit 0 prints the summary. Resolves `DOCS_ROOT` relative to repo root.

#### 5. Parser tests

**File**: `tests/parse-catalog.test.js`

**Intent**: Lock the three catalog-structure contracts against the sailing seed without Docker.

**Contract**: Using Node `node:test` + `node:assert/strict`. Assert: root namespace `""` is present; `docs/sailing/basics/wind.md` parses to path `sailing/basics/wind` and namespace `sailing.basics`; wiki-link target `sailing/licenses_certificates/sailing_certificate`; `docs/recommendations.md` yields intents, not a Document; a folder without `recommendations.md` would still parse (covered by logic + a small temp-dir case if the seed always has the file).

### Success Criteria:

#### Automated Verification:

- `npm test` (parser file) exits 0.
- `npm run sync` against local compose exits 0 twice in a row; second run’s node counts match the first.
- After sync, Cypher (via `cypher-shell` or a tiny inline node script) shows: a Namespace with `id = ""`; Documents at `sailing/basics/wind` and `sailing/licenses_certificates/sailing_certificate` with non-empty `type` and `tags`; a `REFERENCES` edge between those two paths; Intent nodes whose `namespaceId` is `sailing.basics` with at least one Resource URL.
- `rg -n "DETACH DELETE|executeWrite" lib/sync-graph.js` shows wipe happens inside a write transaction after validation.

#### Manual Verification:

- Neo4j Browser: `MATCH (n:Namespace {id:""})<-[:CHILD_OF*0..]-(c) RETURN n, c` shows `docs` → `sailing` → children.
- Browser: an Intent query string from `docs/sailing/basics/recommendations.md` (`I want to understand sail aerodynamics`) has `RECOMMENDED_FOR` Resource nodes.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: MCP server + Cursor wiring

### Overview

Expose the graph through the four spec tools on host STDIO and commit Cursor config so the tools appear in this workspace.

### Changes Required:

#### 1. Tool handlers (testable without STDIO)

**File**: `lib/kb-tools.js`

**Intent**: Implement the four tool bodies as async functions that take a Neo4j session/driver so tests and the MCP adapter share one implementation.

**Contract**:
- `search_by_namespace({ namespace_id, query, include_children = true })` — `MATCH` the Namespace with `id = $namespace_id` (allow `""`). If `include_children`, use `<-[:CHILD_OF*0..]-(ns)`; else that namespace only. Filter Documents where `toLower(title|summary)` CONTAINS `toLower(query)` OR any tag CONTAINS the query (case-insensitive). Return `{ title, path, summary, status, type, tags, namespace_id }[]`. No full-text index.
- `get_document_graph({ file_path })` — normalize `file_path` (strip `docs/` prefix and `.md`). Return the Document properties, its Namespace, outgoing `REFERENCES` paths, incoming `REFERENCES` paths. If missing, return a structured not-found object (not an unhandled throw).
- `get_recommendations({ namespace_id })` — exact namespace only (no children). Return `{ namespace_id, intents: [{ query, resources: [{ title, url }] }] }`. Empty list if none.
- `trigger_sync()` — spawn `process.execPath` on `scripts/sync_to_neo4j.js` with the same env, capture stdout/stderr, apply a timeout, refuse overlapping runs (in-process mutex). Return the child summary or error text. Never inherit child stdout onto the MCP process stdout.

#### 2. STDIO server

**File**: `mcp_server/server.js`

**Intent**: Register the four tools with `@modelcontextprotocol/sdk` v1 `McpServer.registerTool` and connect `StdioServerTransport`.

**Contract**: Import from `@modelcontextprotocol/sdk/server/mcp.js` and `.../stdio.js`. `inputSchema` is a Zod *shape* (`{ namespace_id: z.string(), ... }`), not `z.object()`, unless the installed sdk version requires otherwise — follow the installed v1 docs. `namespace_id` allows `""`. Tool results are `{ content: [{ type: "text", text: JSON.stringify(...) }] }`. No `console.log`.

#### 3. Cursor MCP config

**File**: `.cursor/mcp.json`

**Intent**: Make this workspace launch the server over STDIO against local Bolt without a manual copy step.

**Contract**: `command`: `node`, `args`: path to `mcp_server/server.js` (workspace-relative). `env`: `NEO4J_URI=bolt://localhost:7687`, username/password matching compose, `DOCS_ROOT` pointing at `docs`. Do not use `docker compose run`.

### Success Criteria:

#### Automated Verification:

- `rg -n "search_by_namespace|get_document_graph|trigger_sync|get_recommendations" mcp_server/server.js lib/kb-tools.js` finds all four names.
- `rg -n "console\\.log" mcp_server/` returns no matches.
- Integration tests in `tests/integration/kb-tools.test.js` (run in Phase 4, written here) call the four handlers against a synced seed: search `namespace_id: ""`, query `"wind"` returns the wind document; `get_document_graph` for `sailing/basics/wind` includes a REFERENCES edge to the certificate; `get_recommendations("sailing.basics")` includes the aerodynamics intent; `trigger_sync` exits successfully (or is tested via the shared sync function if spawn is too heavy — prefer spawn once).
- `test -f .cursor/mcp.json` and the file contains `"command": "node"` and `mcp_server/server.js`.

#### Manual Verification:

- Restart Cursor MCP (or reload the window). The `sbrain` / project server lists the four tools.
- Call `search_by_namespace` with `namespace_id` `""` and query `wind`; result includes `sailing/basics/wind`.
- Call `get_recommendations` with `sailing.basics`; result lists intents from that folder’s `recommendations.md`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Verification + first-run docs

### Overview

Finish the integration test files, add a README that is the spec §7 startup path, and confirm a cold start: compose → sync → MCP tools.

### Changes Required:

#### 1. Integration tests

**File**: `tests/integration/sync-graph.test.js`, `tests/integration/kb-tools.test.js`

**Intent**: Fail loudly when Neo4j is down rather than pretending the graph works; prove wipe-reload and the four tools on the sailing seed.

**Contract**: `npm run test:integration` connects with the same env defaults. If Bolt is unreachable, exit non-zero with “start docker compose”. After sync: counts for Namespace (at least 4: `""`, `sailing`, `sailing.basics`, `sailing.licenses_certificates`), 2 regular Documents, REFERENCES ≥ 2 (reciprocal), Intents ≥ 1 at `sailing.basics`. Second sync: same counts. Tools assertions as in Phase 3.

#### 2. README

**File**: `README.md`

**Intent**: Replace spec §7’s “Cursor should generate…” narrative with the actual first-deploy commands for this repo.

**Contract**: Sections: prerequisites (Node 20, Docker), `npm install`, `docker compose up -d`, wait for healthy, `npm run sync`, open Browser, note that `.cursor/mcp.json` is already committed, `npm test` vs `npm run test:integration`. Mention root namespace `""` and that `recommendations.md` is optional. Do not duplicate the full markdown schema — point at `spec.md`.

#### 3. Spec install list (zod only)

**File**: `spec.md`

**Intent**: Stop the next implementer from omitting `zod`, which the SDK requires.

**Contract**: In §7’s `npm install` line, add `zod`. Do not rewrite §5 to remove `mcp-server` unless needed for consistency — README + this plan are the runtime source of truth; if §5 still lists a compose `mcp-server`, add one sentence that Cursor launches MCP on the host over STDIO and compose runs Neo4j only. Keep that spec edit to the minimum that prevents a second, conflicting compose service.

### Success Criteria:

#### Automated Verification:

- `npm test` exits 0 without Docker.
- `docker compose up -d` (already running is fine) and `npm run test:integration` exits 0.
- `rg -n "zod" spec.md` matches the install instruction.
- `rg -n "docker compose up" README.md` and `rg -n "npm run sync" README.md` match.

#### Manual Verification:

- Follow README from a clean mental “clone”: install, compose up, sync, Browser shows the sailing graph, Cursor tools respond.
- Edit a tag on `wind.md`, run `trigger_sync` from Cursor (or `npm run sync`), search finds the change; revert the edit so the seed stays canonical.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- Parser on the sailing seed: root `""`, dotted ids, path wiki-links, recommendations vs documents, optional recommendations (temp dir).
- Path normalization: `.md` suffix, leading slash, `docs/` prefix on `get_document_graph` input.
- Empty-string namespace is not dropped (`Object.keys` / explicit `id === ""` assertions).

### Integration Tests:

- Wipe-and-reload idempotency against Docker Neo4j.
- Reciprocal `REFERENCES` between wind and sailing_certificate.
- Intent + Resource from `sailing.basics` recommendations.
- All four tool handlers on the populated graph.
- Sync abort: if a fixture with mismatched `namespace` is used, graph counts must not change — cover with a temp copy if cheap; otherwise document as a manual check and unit-test that parse errors are non-empty without calling wipe.

### Manual Testing Steps:

1. `docker compose up -d` → Browser login → `RETURN apoc.version()`.
2. `npm run sync` → hierarchy query from root `""`.
3. Reload Cursor MCP → four tools visible.
4. `search_by_namespace("", "wind", true)` and `get_recommendations("sailing.basics")`.
5. `get_document_graph("sailing/basics/wind.md")` matches the path without suffix.
6. `trigger_sync` returns a JSON summary; stdout of Cursor’s MCP process stays clean (no handshake errors).

## Performance Considerations

Catalog is dozens of notes now, hundreds later. Wipe-and-reload in one transaction is the intended scale lever until extra graph annotations exist. Search uses `toLower(...) CONTAINS`; that will not use a btree index — acceptable until thousands of documents. Do not add a full-text index in this change. Uniqueness constraints are the scalability mechanism that must land now (prevent duplicate roots, duplicate paths, collapsed Intents).

## Migration Notes

First sync on an empty database is the migration. Re-sync is destructive for the four catalog labels only. Named Docker volumes persist `/data`; changing `NEO4J_AUTH` after the first boot does not reset the password — if login fails, `docker compose down -v` is the local reset (warn in README). No production data exists.

## References

- Product spec: `spec.md` (§4 Sync Script, §5 Docker Compose, §6 MCP, §7 Startup)
- Catalog contracts: `context/changes/catalog-structure/plan.md`
- Seed: `docs/sailing/basics/wind.md`, `docs/sailing/licenses_certificates/sailing_certificate.md`, four `recommendations.md` files
- MCP SDK v1: https://github.com/modelcontextprotocol/typescript-sdk (v1 line / `@modelcontextprotocol/sdk`)
- Neo4j Docker plugins: https://neo4j.com/docs/operations-manual/5/docker/plugins/
- Progress contract: `.claude/skills/10x-plan/references/progress-format.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Runtime foundation

#### Automated

- [x] 1.1 package.json is ESM with the required dependencies — 85df4fe
- [x] 1.2 npm install succeeds and lists neo4j-driver, sdk, gray-matter, zod — 85df4fe
- [x] 1.3 .gitignore ignores node_modules/ and .env — 85df4fe
- [x] 1.4 docker compose config is valid and has neo4j only — 85df4fe
- [x] 1.5 compose pins neo4j:5.12.0 and APOC via NEO4J_PLUGINS JSON string — 85df4fe
- [x] 1.6 mcp_server/Dockerfile exists on node:20 — 85df4fe

#### Manual

- [ ] 1.7 Neo4j Browser accepts neo4j/password123 at localhost:7474
- [ ] 1.8 APOC procedures are available

### Phase 2: Catalog parser + sync

#### Automated

- [x] 2.1 parser unit tests pass — 01b7e64
- [x] 2.2 npm run sync is idempotent on the sailing seed — 01b7e64
- [x] 2.3 graph contains root Namespace "", Documents with extra frontmatter, REFERENCES, and Intents — 01b7e64
- [x] 2.4 wipe runs inside a write transaction after validation — 01b7e64

#### Manual

- [ ] 2.5 Browser shows CHILD_OF hierarchy from root ""
- [ ] 2.6 sailing.basics aerodynamics Intent has Resource nodes

### Phase 3: MCP server + Cursor wiring

#### Automated

- [x] 3.1 all four tool names are registered
- [x] 3.2 mcp_server/ has no console.log
- [x] 3.3 tool handlers succeed against the synced seed
- [x] 3.4 .cursor/mcp.json launches node mcp_server/server.js

#### Manual

- [ ] 3.5 Cursor lists the four tools
- [ ] 3.6 search_by_namespace on root finds wind
- [ ] 3.7 get_recommendations returns sailing.basics intents

### Phase 4: Verification + first-run docs

#### Automated

- [ ] 4.1 npm test passes without Docker
- [ ] 4.2 npm run test:integration passes with compose up
- [ ] 4.3 spec.md install line includes zod
- [ ] 4.4 README documents compose up and npm run sync

#### Manual

- [ ] 4.5 README cold-start walkthrough works in Cursor
- [ ] 4.6 trigger_sync reflects a reversible seed edit then the edit is reverted
