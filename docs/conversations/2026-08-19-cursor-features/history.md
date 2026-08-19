# Historia czatu

## 1

### Ty

ok chcialbym sie dowiedziec o funkcjonalnosciach specyficznych dla cursora i o feature w chmurze wylistuj je aby zapoczatkowac knowledge base

### Agent

Mapa produktu (sierpień 2026) — trzy warstwy: Desktop/IDE, Cloud, Platform. W KB nie było jeszcze notatek o Cursorze.

Desktop: Agent + tryby (Ask/Plan/Debug/Design), Agents Window, Tab, inline edit, checkpoints, side chats (tylko lokalnie), Browser, Canvases, Worktrees, Agent Review, Run Modes/sandbox.

Cloud: Cloud Agents (dawniej Background Agents), Automations, Bugbot, Security Agents, PR Routing & Approval, Origin, iOS/Remote Control, sharing, integracje SCM/chat.

Platforma: Rules, Skills, Hooks, MCP, Plugins, CLI `agent`, SDK.

Szkic KB: `cursor/{desktop-ide,cloud,platform}`. Następny temat: Cloud Agents (albo inny z listy). Quiz 4 pytania w high-level.md.

Źródła: docs Cursor [1], Cloud Agents [2], Automations [3], Bugbot [4].

## 2

### Ty

zaczynamy nowy temat przydalo by sie cos w /docs/AI/cursor

### Agent

Seed KB pod `docs/knowledge-base/AI/cursor/` (namespace `AI.cursor` — to jest katalogowa ścieżka dla `/docs/AI/cursor`): overview, cloud-agents, recommendations.md. Następny temat nauki: Cloud Agents.

## 3

### Ty

Quiz katalog:
1. backgrount tasks
2. Bugbot, Security Agents, PR Routing & Approval; Origi
3. no clue

### Agent

Ocena: (1) OK — Background Agents. (2) Trzy automacje OK; Origin to git forge, nie automacja. (3) Nauka: `agent` = Agent CLI (kod/CI), `origin` = Origin CLI (repo/PR/auth), osobne binarki. KB utworzona. Następny temat: Cloud Agents. Quiz 2 pytania o `agent` vs `origin`.

Źródła: CLI agent [1], Origin CLI [2], overview KB [3].
