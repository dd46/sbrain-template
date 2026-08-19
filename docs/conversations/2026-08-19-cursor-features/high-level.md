---
title: "Cursor — funkcje IDE i chmura"
session: "2026-08-19"
topic: "cursor"
---

# Plan sesji

## Nauka

- [x] Katalog: Desktop vs Cloud vs Platform
- [ ] Cloud Agents (środowiska, artefakty, API)
- [ ] Automations
- [ ] Bugbot
- [ ] Security Agents i PR Routing
- [ ] Origin (git forge)
- [ ] Mobile, Remote Control, sharing
- [ ] Tryby agenta w IDE (Agent / Ask / Plan / Debug / Design)
- [ ] Tab, inline edit, Agents Window
- [ ] Worktrees, Canvas, Browser
- [ ] Rules, Skills, Hooks
- [ ] MCP, Plugins, Subagenci
- [ ] CLI i SDK

## Quiz

- [x] Quiz: Katalog Desktop vs Cloud vs Platform
- [ ] Quiz: Cloud Agents
- [ ] Quiz: Automations
- [ ] Quiz: Bugbot
- [ ] Quiz: Security Agents i PR Routing
- [ ] Quiz: Origin
- [ ] Quiz: Mobile, Remote Control, sharing
- [ ] Quiz: Tryby agenta w IDE
- [ ] Quiz: Tab, inline edit, Agents Window
- [ ] Quiz: Worktrees, Canvas, Browser
- [ ] Quiz: Rules, Skills, Hooks
- [ ] Quiz: MCP, Plugins, Subagenci
- [ ] Quiz: CLI i SDK

## Katalog: Desktop vs Cloud vs Platform

Mapa produktu Cursor (sierpień 2026). Katalog w KB: `docs/knowledge-base/AI/cursor/` (namespace `AI.cursor`) — to jest ścieżka katalogu dla `/docs/AI/cursor`.

### Trzy warstwy

| Warstwa | Co to jest | Gdzie żyje |
|---------|------------|------------|
| **Desktop / IDE** | Agent w edytorze: Tab, tryby, worktree, canvas, sandbox | aplikacja Cursor |
| **Cloud** | Agent na VM, automacje, review PR, Origin, iOS/web | cursor.com + izolowane VM |
| **Platform** | Rules, Skills, Hooks, MCP, Plugins, CLI `agent`, SDK | wspólne dla IDE, CLI i chmury |

Dawna nazwa **Background Agents** = dziś **Cloud Agents**. [1][2]

### Desktop — specyficzne dla Cursora

- **Agent** — edycje, terminal, wielokrokowe zadania (Cmd/Ctrl+I). Tryby: **Agent**, **Ask** (tylko odczyt), **Plan**, **Debug**, **Design**. [1]
- **Agents Window** — wiele agentów naraz: lokalnie, chmura, SSH. [1]
- **Tab** + **inline edit** (Cmd/Ctrl+K) — autocomplete i edycja w miejscu. [1]
- **Checkpoints**, kolejka wiadomości, **side chats** (side chats: tylko lokalnie). [1]
- **Browser**, **Canvases**, **Worktrees** (`/worktree`, `/best-of-n`). [1]
- **Agent Review**, Instant Grep, indeks semantyki, `@` mentions. [1]
- **Run Modes** + sandbox (Seatbelt / Landlock). [1]
- **Cursor Blame** (Enterprise), **Cursor Router / Auto** (Teams/Enterprise). [1]

### Cloud

- **Cloud Agents** — ten sam loop co lokalnie, na izolowanej VM; dashboard [cursor.com/agents](https://cursor.com/agents); **Move to Cloud**. Dawniej Background Agents. [2]
- Środowiska, Builds, artefakty, computer use / remote desktop, Cloud MCP, API v1, self-hosted pools / My Machines. [2]
- **Automations** — harmonogram lub eventy (GitHub/GitLab/Bitbucket, Slack, Linear, PagerDuty, webhook). [3]
- Zarządzane automacje: **Bugbot**, **Security Agents**, **PR Routing & Approval**. [3][4]
- **Origin** — git forge Cursora (early beta). [1]
- **Cursor for iOS**, Android PWA, **Remote Control** (pętla w chmurze, narzędzia na Twoim komputerze). [2]
- Sharing: transkrypty, canvas, URL-e agentów. Integracje: GitHub, GitLab, Bitbucket, Azure DevOps, Slack, Linear, Teams, Jira, Notion. [1]
- **Grok Bot** — osobna powierzchnia (wczesny produkt). [1]

### Platforma (IDE + CLI + chmura)

- **Rules** (`.mdc`, User, Team, `AGENTS.md`), **Skills**, **Hooks**, **MCP**, **Plugins**. [1]
- CLI **`agent`** (osobny binarka od Origin CLI **`origin`**). [1]
- SDK TypeScript (`@cursor/sdk`) i Python (`cursor-sdk`). [1]

### KB (utworzone)

- [[AI/cursor/overview]] — katalog Desktop / Cloud / Platform
- [[AI/cursor/cloud-agents]] — pierwsza głęboka notatka (draft)
- `docs/knowledge-base/AI/cursor/recommendations.md` — kolejne intencje

Następny temat w sesji: **Cloud Agents** (albo Automations).

## Quiz — Katalog Desktop vs Cloud vs Platform

1. Jaką dawną nazwę zastąpiły **Cloud Agents**?
2. Które trzy automacje Cursor-managed siedzą obok własnych Automations?
3. Czym różni się CLI `agent` od CLI `origin`?
4. Która funkcja desktopowa **nie** działa jeszcze z Cloud Agents: side chats czy Tab?

### Odpowiedzi

1. **OK** — „backgrount tasks” = **Background Agents** (literówka; dawna nazwa Cloud Agents).
2. **Częściowo** — Bugbot, Security Agents, PR Routing & Approval = trzy managed automations. **Origin nie** — to git forge (early beta), nie automacja.
3. **Brak** — „no clue”. Temat tej tury: CLI `agent` vs `origin`.
4. **Brak odpowiedzi.** (side chats nie działają z Cloud Agents; Tab jest funkcją desktopową.)

Ocena: 1 zaliczone, 2 prawie (extra Origin), 3 do nauki, 4 nieoddane.

## CLI: `agent` vs `origin`

Dwa **osobne** binarne CLI. Origin ≠ automacja (Bugbot / Security Agents / PR Routing).

| CLI | Do czego | Instalacja |
|-----|----------|------------|
| **`agent`** | Cursor Agent CLI — kod w terminalu / CI (te same tryby Agent / Plan / Ask) | `curl https://cursor.com/install -fsS | bash` → `agent` |
| **`origin`** | Origin git-forge CLI — repozytoria, PR, auth (`origin auth login`, `origin repo`, `origin pr`) | osobny installer; docs: Origin CLI is separate from Agent CLI |

Pliki KB: `docs/knowledge-base/AI/cursor/` (`overview.md`, `cloud-agents.md`, `recommendations.md`). `sync.md` nadal `synced: false`.

Następny temat: **Cloud Agents**.

## Quiz — CLI `agent` vs `origin`

1. Której komendy użyjesz, żeby odpalić agenta kodującego w terminalu: `agent` czy `origin`?
2. Czy Origin to trzecia managed automation obok Bugbota?

### Odpowiedzi

—
