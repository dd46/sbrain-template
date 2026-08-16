# LangGraph conversational chat — Plan Brief

> Full plan: `context/changes/langgraph-chat/plan.md`

## What & Why

Cursor chat plus markdown session folders is a poor conversational runtime. This change adds a LangGraph.js agent (MemorySaver threads) and a local Next.js page so you talk to the Second Brain in the browser. The graph uses Neo4j through `lib/kb-tools.js` and may read/write `docs/`. MCP is **not** on the chat path.

## Starting Point

Node ESM + Neo4j + STDIO MCP for Cursor. No HTTP app, no LangGraph, no in-repo MCP client. Catalog wipe-reload must not grow checkpoint nodes.

## Desired End State

`npm run chat` → localhost UI with thread switcher and streamed replies. Restart clears memory. Cursor MCP still works. Unit tests cover the graph with a fake model.

## Key Decisions Made

| Decision | Choice | Why |
| -------- | ------ | --- |
| Chat transport | HTTP to LangGraph, not MCP | User: MCP has no role in chat; graph talks to Neo4j + `docs/` directly |
| Checkpointer | MemorySaver | Explicit MVP; no second database |
| LLM | OpenAI-compatible `.env` | Works with OpenAI / Groq / Ollama |
| UI | Next.js + Tailwind + streaming | User request; `@ai-sdk/langchain` + `useChat` |
| Threads | UI creates/switches `thread_id` | List lives in process memory |
| Docs | Read **and** write under `docs/` | Sandbox; `trigger_sync` for structured notes |
| Auth | Localhost only | Single-user machine |
| Tests | Fake LLM + fake tools | No Playwright, no live key in CI |

## Scope

**In scope:** `lib/chat-agent.js`, sandboxed `docs/` tools, `web/` Next.js chat, root `npm run chat`, README.

**Out of scope:** MCP-in-chat, durable checkpointer, auth, deploy, Playwright, rewriting Cursor MCP, auto-`history.md` every turn.

## Architecture / Approach

```
Browser (Next.js + Tailwind + useChat)
  → POST /api/chat { messages, thread_id }
    → LangGraph stream (MemorySaver singleton, Node runtime)
      → tools: lib/kb-tools.js (Neo4j) + lib/docs-fs.js (docs/)
Cursor ──STDIO──► mcp_server  (unchanged, parallel)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Graph + MemorySaver | Testable agent + KB tools | LangGraph API churn (`createReactAgent` vs `createAgent`) |
| 2. docs/ tools | Sandboxed read/write | Path escape / symlink |
| 3. Next.js UI | Streaming chat + threads | Parent `lib/` import + Edge vs Node; HMR drops memory |
| 4. Docs/scripts | `npm run chat`, README | — |

**Prerequisites:** Neo4j for live KB answers; OpenAI-compatible key for real chat. Unit tests need neither.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- MemorySaver + Next `dev` HMR will look like “lost chat”; accepted.
- Next.js importing root ESM `lib/` may need `transpilePackages` / server-only boundaries.
- File writes to structured `docs/` leave Neo4j stale until `trigger_sync`.

## Success Criteria (Summary)

- Browser chat on 127.0.0.1 with isolated threads and streaming.
- Agent can search Neo4j and write under `docs/`, not outside it.
- `npm test` covers agent + sandbox without live LLM.
