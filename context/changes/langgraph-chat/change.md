---
change_id: langgraph-chat
title: LangGraph.js conversational agent with a Next.js chat page
status: completed
created: 2026-08-16
updated: 2026-08-16
archived_at: null
---

## Notes

zamiast pytac tutaj chcialbym zeby byl graph (langgraph.js) ktory obsluzy conversational. narazie memory checkpoing ktory polaczy sie z mcp i przez niego bedzie szla conversacja - moze przy okazji dodaj strone ktora obsluzy conversational zebym nie pisal w cursor

Decisions from /10x-plan:
- Chat does **not** go through MCP. Graph calls Neo4j via `lib/kb-tools.js` and reads/writes `docs/`.
- MemorySaver only. OpenAI-compatible LLM from `.env`.
- Next.js + Tailwind + streaming. UI owns thread_id list (in-process).
- Localhost, no auth. Tests: fake LLM + fake tools.
