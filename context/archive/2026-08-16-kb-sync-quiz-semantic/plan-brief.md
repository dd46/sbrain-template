# KB session sync, quiz, semantic search — Plan Brief

> Full plan: `.cursor/plans/kb_sync_quiz_semantic_ded945a0.plan.md`
> Change: `context/changes/kb-sync-quiz-semantic/change.md`

## What & Why

Strukturalna baza (`docs/` poza `conversations/`) zmienia się **tylko na żądanie**. Każda nowa sesja ma `sync.md` z `synced: false`. Jawne **synchronizuj** zapisuje jak rozmowa wpłynęła na KB, ustawia `quiz_confirmed` per H2 (po ocenie quizu) i odpala `npm run sync`. Treść notatek + lokalne embeddingi (Xenova) są w Neo4j; MCP ma `semantic_search`.

## Key Decisions

| Decision | Choice |
| -------- | ------ |
| KB edits | Tylko na prośbę; synchronizuj = most sesja → KB |
| sync.md | Start `synced: false`; update tylko przy synchronizuj |
| Quiz grain | H2 w notatkach z `track_quiz: true` |
| Embeddings | Lokalne MiniLM 384d; cosine w Node (Neo4j 5.12 bez native vector index) |
| Migracja | new_only — stare sesje bez sync.md |

## Implemented

- `lib/embeddings.js`, parser body/sections, `lib/sync-graph.js`, `semantic_search` MCP
- `kb:promote` — tylko sekcje nauki, `track_quiz: true`
- Reguły: `kb-persist.mdc`, hooks, `docs/conversations/README.md`
