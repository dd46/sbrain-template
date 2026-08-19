---
title: "Cursor product map"
namespace: "AI.cursor"
type: "manual"
status: "consumed"
summary: "Three-layer map of Cursor (August 2026): Desktop/IDE, Cloud, and Platform. Catalog for the AI.cursor namespace."
tags: ["cursor", "catalog", "desktop", "cloud", "platform"]
prerequisites: []
track_quiz: true
sections:
  - id: three-layers
    heading: "Three layers"
    quiz_confirmed: false
    quiz_confirmed_at: null
  - id: desktop-ide
    heading: "Desktop / IDE"
    quiz_confirmed: false
    quiz_confirmed_at: null
  - id: cloud
    heading: "Cloud"
    quiz_confirmed: false
    quiz_confirmed_at: null
  - id: platform
    heading: "Platform"
    quiz_confirmed: false
    quiz_confirmed_at: null
---
# Cursor product map

Catalog path in this Second Brain: `docs/knowledge-base/AI/cursor/` (namespace `AI.cursor`). That is the indexed location for `/docs/AI/cursor`.

## Three layers

| Layer | What it is | Where it lives |
|-------|------------|----------------|
| **Desktop / IDE** | Agent in the editor: Tab, modes, worktrees, canvas, sandbox | Cursor app |
| **Cloud** | Agent on a VM, automations, PR review, Origin, iOS/web | cursor.com + isolated VMs |
| **Platform** | Rules, Skills, Hooks, MCP, Plugins, CLI `agent`, SDK | Shared by IDE, CLI, and cloud |

**Cloud Agents** were formerly called **Background Agents**. Deep note: [[AI/cursor/cloud-agents]].

## Desktop / IDE

- **Agent** — edits, terminal, multi-step tasks. Modes: **Agent**, **Ask** (read-only), **Plan**, **Debug**, **Design**.
- **Agents Window** — several agents at once: local, cloud, SSH.
- **Tab** + **inline edit** (Cmd/Ctrl+K).
- Checkpoints, message queue, **side chats** (side chats: local only).
- Browser, Canvases, Worktrees (`/worktree`, `/best-of-n`).
- Agent Review, Instant Grep, `@` mentions, Run Modes + sandbox.

## Cloud

- **Cloud Agents** — same agent loop on an isolated VM; dashboard [cursor.com/agents](https://cursor.com/agents); **Move to Cloud**. See [[AI/cursor/cloud-agents]].
- **Automations** — schedule or events (GitHub/GitLab/Bitbucket, Slack, Linear, PagerDuty, webhook).
- Cursor-managed automations: **Bugbot**, **Security Agents**, **PR Routing & Approval**. These are not Origin.
- **Origin** — Cursor's git forge (early beta), separate from those three automations.
- iOS app, Android PWA, Remote Control, sharing, SCM/chat integrations.

## Platform

Shared by the IDE, the CLI, and cloud agents:

- Rules (`.mdc`, User, Team, `AGENTS.md`), Skills, Hooks, MCP, Plugins.
- CLI **`agent`** — Cursor Agent CLI (coding in the terminal / CI). Install: `curl https://cursor.com/install -fsS | bash`, then `agent`.
- CLI **`origin`** — Origin git-forge CLI (repos, PRs, auth). Different binary; install is a separate script. Docs state the Origin CLI is separate from the Agent CLI.
- SDK: TypeScript `@cursor/sdk`, Python `cursor-sdk`.

---
## References
### Internal
- [[AI/cursor/cloud-agents]]
### External
- [Cursor docs](https://cursor.com/docs)
- [Cloud Agents](https://cursor.com/docs/cloud-agent)
- [Cursor CLI (`agent`)](https://cursor.com/docs/cli/overview)
- [Origin CLI (`origin`)](https://cursor.com/docs/origin/cli)
- [Automations](https://cursor.com/docs/cloud-agent/automations)
- [Bugbot](https://cursor.com/docs/bugbot)
