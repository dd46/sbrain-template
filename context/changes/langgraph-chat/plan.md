# LangGraph conversational chat Implementation Plan

## Overview

Add a LangGraph.js agent that owns multi-turn chat (MemorySaver + `thread_id`) and a local Next.js page so learning conversations happen in the browser instead of Cursor. The graph queries Neo4j through existing `lib/kb-tools.js` and may read/write files under `docs/`. Cursor’s STDIO MCP server stays unchanged and is not on the chat path.

## Current State Analysis

The repo is Markdown → Neo4j → Cursor MCP. There is no HTTP app, no LangGraph, and no in-repo MCP client.

- MCP is host STDIO only (`mcp_server/server.js` lines 131–132). Cursor is the client via `.cursor/mcp.json`. Tools wrap `lib/kb-tools.js`.
- Compose runs Neo4j only. Sync is wipe-reload of catalog labels (`lib/sync-graph.js`); `docs/conversations/` is skipped by the parser.
- Conversations today are agent-written markdown folders (`docs/conversations/README.md`), not a runtime. That is what this change replaces for day-to-day chat.
- Archived `kb-mcp-runtime` deferred HTTP MCP, TypeScript, and a bundler for the **MCP package**. This change adds a **separate** Next.js app; it does not convert `mcp_server/` to TypeScript.
- Official LangGraph JS checkpointers are Memory / SQLite / Postgres / Mongo / Redis — not Neo4j. Planning chose MemorySaver so we do not add a second database or mix checkpoints into the catalog graph.

## Desired End State

`npm run chat` starts a Next.js app on localhost. The user picks or creates a thread, types, and sees a streamed reply. The agent can search the KB (Neo4j) and read/write files under `docs/` (including `conversations/`). Restarting the Node process clears threads (MemorySaver). Cursor MCP still works in parallel. Graph behavior is covered by `node --test` with a fake model.

### Key Discoveries:

- Tool logic already lives in `lib/kb-tools.js` (lines 28–268) — the graph should call these functions, not spawn MCP.
- `createDriver()` in `lib/neo4j.js` is the Neo4j entry; reuse it from a Node-only module so Next never bundles neo4j into the client.
- Parser skips `docs/conversations/` (`lib/parse-catalog.js`); writes there do not need `trigger_sync`. Writes to structured notes do, or Neo4j goes stale.
- `@ai-sdk/langchain` (`toBaseMessages` / `toUIMessageStream`) is the current bridge from `graph.stream()` to Next `useChat`.

## What We're NOT Doing

- Routing chat through MCP (no HTTP MCP, no STDIO client in the web app, no MCP `chat` tool).
- Postgres / Neo4j / Redis checkpointer; LangGraph Store; LangSmith.
- Auth, non-localhost bind, Vercel/production deploy.
- Playwright / browser e2e.
- Replacing or rewriting `mcp_server/` or Cursor `.cursor/mcp.json`.
- Auto-appending every turn to `history.md` (the agent writes files only when it chooses a file tool).
- Changing Neo4j wipe-reload or putting checkpoints in the catalog graph.

## Implementation Approach

Keep the agent testable outside Next: a Node ESM module under `lib/` compiles `createReactAgent` (or the current LangGraph JS prebuilt equivalent) with MemorySaver, KB tools, and sandboxed `docs/` tools. The Next.js app in `web/` is UI + streaming route only: Node runtime, singleton graph import, Tailwind chat + thread sidebar. Root `package.json` gains a `chat` script that runs the web app.

## Critical Implementation Details

MemorySaver must be a **process singleton** imported only from server code (`runtime = 'nodejs'`, never Edge). `next dev` HMR can drop memory; that is accepted for MVP — document it. Bind `127.0.0.1`.

File tools must resolve `realpath` and reject any path outside `docs/` (including `..` and symlinks that escape). After writing structured catalog files (not `conversations/`), the agent should have `trigger_sync` available so Neo4j can catch up; do not auto-sync on every token.

---

## Phase 1: Graph + MemorySaver + KB tools

### Overview

Stand up a compiled LangGraph agent in `lib/` that chats with an OpenAI-compatible model, persists turns in MemorySaver, and can call existing KB helpers. Prove it with fake-model unit tests — no UI yet.

### Changes Required:

#### 1. Agent module

**File**: `lib/chat-agent.js` (new)

**Intent**: Export a function that returns a compiled graph (or cached singleton) with Messages state, MemorySaver, and tools wrapping `searchByNamespace`, `semanticSearch`, `getDocumentGraph`, `getRecommendations`.

**Contract**: `getChatGraph()` / `getCheckpointer()` usable from tests and from a Next route. Model from env (`OPENAI_API_KEY`, optional `OPENAI_BASE_URL` + `OPENAI_MODEL`). `invoke`/`stream` require `configurable.thread_id`.

#### 2. Fake-model tests

**File**: `tests/chat-agent.test.js` (new)

**Intent**: Cover thread continuity and KB tool invocation without a live LLM or Neo4j.

**Contract**: Inject a fake chat model and fake KB functions. Same `thread_id` recalls prior user text; a second thread does not. `npm test` includes this file.

#### 3. Root test script

**File**: `package.json`

**Intent**: Run the new test alongside parser tests.

**Contract**: `npm test` still uses `node --test` and lists `tests/chat-agent.test.js`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes (parser + chat-agent).
- Chat-agent tests do not require Neo4j or a real API key.
- Compiled graph rejects or no-ops invoke without `thread_id` (or tests document the LangGraph error).

#### Manual Verification:

- None (no UI in this phase).

---

## Phase 2: Sandboxed docs/ file tools

### Overview

Give the same graph read/write/list access to `docs/` so the agent can persist notes and session files without leaving the catalog tree.

### Changes Required:

#### 1. Filesystem helpers

**File**: `lib/docs-fs.js` (new)

**Intent**: Resolve user-supplied relative paths against `getDocsRoot()`, allow list/read/write/mkdir, refuse escape.

**Contract**: After `fs.realpath`, the path must equal `docsRoot` or be a descendant. Writes are utf-8 text. Binary/attachments out of scope unless already under `docs/`.

#### 2. Wire tools on the agent

**File**: `lib/chat-agent.js`

**Intent**: Register list/read/write tools plus existing `triggerSync` from `lib/kb-tools.js` so structured-note writes can refresh Neo4j.

**Contract**: Tool descriptions tell the model: `conversations/` is not synced; other `docs/` writes should consider `trigger_sync`.

#### 3. Sandbox tests

**File**: `tests/docs-fs.test.js` (new)

**Intent**: Prove traversal (`../`, symlink-out) fails and a round-trip write under `docs/` succeeds (use a temp dir as `DOCS_ROOT`).

**Contract**: Included in `npm test`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes including `tests/docs-fs.test.js`.
- Escape paths throw; in-tree write/read matches.

#### Manual Verification:

- None.

---

## Phase 3: Next.js chat UI + streaming

### Overview

Add `web/` (Next.js App Router + Tailwind). One page: thread list, composer, streamed assistant tokens. Talks to a Route Handler that streams the LangGraph agent.

### Changes Required:

#### 1. Next app scaffold

**File**: `web/` (new package)

**Intent**: Local App Router app with Tailwind. Server-only import of `../lib/chat-agent.js` (or a thin `web/lib/graph.ts` re-export). No Edge runtime.

**Contract**: `next.config` transpiles/allows parent `lib/` ESM. `hostname` `127.0.0.1`. Client components must not import `neo4j-driver` or `lib/kb-tools.js`.

#### 2. Chat API

**File**: `web/app/api/chat/route.ts` (or `.js`)

**Intent**: Accept UI messages + `thread_id`, run `graph.stream` with MemorySaver config, return an AI SDK UI message stream.

**Contract**: Use `@ai-sdk/langchain` `toBaseMessages` / `toUIMessageStream` (or equivalent current API). Missing `thread_id` → 400.

#### 3. Thread API

**File**: `web/app/api/threads/route.ts` (new)

**Intent**: List known thread ids and create a new one (uuid). Store the id list next to the MemorySaver singleton (in-process; lost on restart).

**Contract**: `GET` returns ids; `POST` allocates an id. No disk persistence.

#### 4. Chat page

**File**: `web/app/page.tsx` (new)

**Intent**: Sidebar of threads, main transcript, input. Stream with `useChat`. Show tool-call parts if the adapter exposes them; otherwise text is enough for MVP.

**Contract**: Tailwind layout. Selecting a thread sends that `thread_id` on the next request. Empty state explains that restart wipes memory.

#### 5. Env template

**File**: `web/.env.example` and root `.env.example`

**Intent**: Document `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, Neo4j vars already used by `lib/neo4j.js`.

**Contract**: No secrets committed.

### Success Criteria:

#### Automated Verification:

- `web` production build succeeds: `npm run build` in `web/`.
- Chat route file exists and is a POST handler.
- Client page does not import `neo4j-driver`.

#### Manual Verification:

- `npm run chat` opens the UI on `http://127.0.0.1:3000`.
- Two threads: messages in A are not visible as context in B after switching (same process).
- Reply streams token-by-token (or chunk-by-chunk).
- Agent can answer a question that requires `semantic_search` or `search_by_namespace` when Neo4j is up and synced.
- Agent can write a file under `docs/conversations/` when asked; path outside `docs/` is refused.

---

## Phase 4: Scripts, README, agent notes

### Overview

Make the chat app the documented way to talk to the KB from a browser. Keep Cursor MCP docs intact.

### Changes Required:

#### 1. Root scripts

**File**: `package.json`

**Intent**: `chat` (and optionally `chat:dev`) delegates to `web/`.

**Contract**: Documented in README. Does not break `npm run mcp` / `npm run sync`.

#### 2. README

**File**: `README.md`

**Intent**: Short “Chat UI” section: Neo4j up, `.env` keys, `npm run chat`, memory lost on restart, MCP still for Cursor.

**Contract**: Do not claim MCP is on the chat path.

#### 3. AGENTS.md / kb-persist (minimal)

**File**: `AGENTS.md`, optionally `.cursor/rules/kb-persist.mdc`

**Intent**: One sentence that browser chat is `web/` / LangGraph and is not required to append `docs/conversations/` unless the user asks in that UI.

**Contract**: Do not delete the Cursor persist rules; they still apply when someone chats in Cursor.

### Success Criteria:

#### Automated Verification:

- README contains `npm run chat` and MemorySaver restart caveat.
- `package.json` defines a `chat` script.

#### Manual Verification:

- Following README from a clean terminal reaches a working localhost chat (with Neo4j + API key).

---

## Testing Strategy

### Unit Tests:

- Thread isolation and continuity with fake model (`tests/chat-agent.test.js`).
- KB tool is called when the fake model emits a tool call (inject fake `searchByNamespace`).
- `docs-fs` sandbox: `../etc/passwd`, symlink escape, happy-path write.

### Integration Tests:

- Existing `npm run test:integration` unchanged (Neo4j + `kb-tools`). Do not require it for chat-agent unit tests.
- Optional later: one live invoke against Neo4j — out of scope unless cheap; not a phase gate.

### Manual Testing Steps:

1. `docker-compose up -d` and `npm run sync`.
2. Set OpenAI-compatible env; `npm run chat`.
3. Create thread, ask a sailing-license question; confirm a KB tool ran (UI chip or server log).
4. Ask to save a note under `docs/conversations/`; confirm file on disk.
5. Restart the chat process; confirm threads are gone.

## Performance Considerations

Streaming should start on first model tokens, not after the full tool loop. MemorySaver grows per thread with full message history — no summarization in this change (acceptable for local MVP).

## Migration Notes

No data migration. Existing `docs/conversations/` folders remain; the new UI does not import them automatically. Users can ask the agent to read those files.

## References

- MCP vs lib: `mcp_server/server.js`, `lib/kb-tools.js`
- Neo4j wipe labels: `lib/sync-graph.js`
- Conversations skip: `lib/parse-catalog.js`, `docs/conversations/README.md`
- Archived STDIO-only MCP: `context/archive/2026-08-16-kb-mcp-runtime/plan.md`
- Streaming adapter: [AI SDK LangChain adapter](https://ai-sdk.dev/providers/adapters/langchain)
- Persistence split: [LangGraph JS persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Graph + MemorySaver + KB tools

#### Automated

- [x] 1.1 `npm test` passes (parser + chat-agent)
- [x] 1.2 Chat-agent tests do not require Neo4j or a real API key
- [x] 1.3 Compiled graph requires `thread_id` (or tests document LangGraph’s error)

### Phase 2: Sandboxed docs/ file tools

#### Automated

- [x] 2.1 `npm test` passes including `tests/docs-fs.test.js`
- [x] 2.2 Escape paths throw; in-tree write/read matches

### Phase 3: Next.js chat UI + streaming

#### Automated

- [x] 3.1 `npm run build` in `web/` succeeds
- [x] 3.2 Chat route exists as POST handler
- [x] 3.3 Client page does not import `neo4j-driver`

#### Manual

- [ ] 3.4 `npm run chat` serves UI on `http://127.0.0.1:3000`
- [ ] 3.5 Two threads stay isolated in one process
- [ ] 3.6 Replies stream
- [ ] 3.7 Agent uses KB search when Neo4j is synced
- [ ] 3.8 Agent can write under `docs/conversations/`; paths outside `docs/` are refused

### Phase 4: Scripts, README, agent notes

#### Automated

- [x] 4.1 README documents `npm run chat` and MemorySaver restart caveat
- [x] 4.2 `package.json` defines a `chat` script

#### Manual

- [ ] 4.3 README steps from a clean terminal reach a working localhost chat
