---
title: "Cloud Agents"
namespace: "AI.cursor"
type: "manual"
status: "draft"
summary: "Cloud Agents run the same agent loop on isolated cloud VMs. Dashboard at cursor.com/agents; formerly Background Agents. Environments, Move to Cloud, artifacts."
tags: ["cursor", "cloud-agents", "background-agents", "vm"]
prerequisites: ["Read the Desktop vs Cloud vs Platform catalog"]
track_quiz: true
sections:
  - id: what-they-are
    heading: "What they are"
    quiz_confirmed: false
    quiz_confirmed_at: null
  - id: how-to-start
    heading: "How to start"
    quiz_confirmed: false
    quiz_confirmed_at: null
  - id: environments
    heading: "Environments"
    quiz_confirmed: false
    quiz_confirmed_at: null
  - id: move-to-cloud
    heading: "Move to Cloud"
    quiz_confirmed: false
    quiz_confirmed_at: null
  - id: artifacts-and-desktop
    heading: "Artifacts and remote desktop"
    quiz_confirmed: false
    quiz_confirmed_at: null
---
# Cloud Agents

Cloud Agents use the same agent loop as the desktop, but they run on **isolated VMs** in the cloud with a full development environment (cloned repos, dependencies, secrets, startup commands, network) instead of on your laptop. You can run many in parallel; your local machine does not need to stay online.

They were formerly called **Background Agents**. Product map: [[AI/cursor/overview]].

## What they are

- Isolated Ubuntu VMs managed by Cursor (provisioning, snapshots, artifacts, capacity).
- Can build, test, and interact with the changed software — including **computer use** (mouse/keyboard on a desktop and browser).
- Support **MCP** (HTTP and stdio; OAuth when the server needs it) and repo **hooks** from `.cursor/hooks.json` (not `~/.cursor/hooks.json`).
- Can work in **multi-repo** environments (frontend + backend + libs in one run). Long-running is not available for multi-repo yet.
- Need a **paid** Cursor plan. An account admin must connect source control (GitHub, GitLab, Bitbucket, or Azure DevOps) before anyone can start an agent from a repo.

## How to start

Dashboard: [cursor.com/agents](https://cursor.com/agents). Also:

1. **Desktop** — pick **Cloud** under the agent input.
2. **Web** — cursor.com/agents (Android: Chrome PWA).
3. **iOS** — Cursor for iOS app.
4. **Slack / Linear** — `@cursor`.
5. **GitHub or Bitbucket** — comment `@cursor` on a PR or issue (Bitbucket: PR).
6. **API** — Cloud Agent API.

The agent clones the repo, works on a **separate branch**, then pushes for handoff. You need read-write access to the repo (and submodules/dependent repos).

## Environments

An agent that cannot run tests or reach APIs cannot close the loop. Setup is the main lever:

- **Agent-led setup** from the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents#environments) (or Agents Window): install deps, verify, first **Build**.
- **Dockerfile** via `.cursor/environment.json`.
- Resolution order: repo `.cursor/environment.json` → personal saved environment → team saved environment.

**Builds** prepare repos and dependencies in the background so the next agent starts from a ready disk. Hover the repo name on an agent page to see which environment/Build that run used.

Secrets go in the dashboard Secrets tab (workspace/team-scoped), not in committed `.env` files. You can restrict outbound domains and connect private networks (e.g. Tailscale).

## Move to Cloud

**Move to Cloud** continues a desktop conversation on a Cloud Agent. It transfers **conversation history and context**, not dirty files. The cloud run starts from a **clean git state on the remote**. Commit or stash first if you want the latest local edits.

## Artifacts and remote desktop

- **Artifacts** — screenshots, videos, logs so you can see what changed without checking out the branch. Optional embedding into GitHub PR descriptions.
- **Remote desktop** — take control of the agent's desktop to try the software, then hand control back.
- Sharing: send the agent URL; teammates with repo access can view (read-only unless team follow-ups are enabled).

## MCP

- **Team MCP** — HTTP and stdio servers configured from the MCP dropdown on [cursor.com/agents](https://cursor.com/agents).
- **Cursor Cloud MCP** — built-in diagnostics: transcripts, events, environment info, setup logs.

## API v1 (public beta)

REST API to create, list, stream, and cancel agents and runs; fetch artifacts and usage. Entry point: `POST /v1/agents`. Legacy **v0** API still exists; webhooks documented on v0, v1 webhooks coming soon.

---
## References
### Internal
- [[AI/cursor/overview]]
### External
- [Cloud Agents](https://cursor.com/docs/cloud-agent)
- [Cloud agent setup](https://cursor.com/docs/cloud-agent/setup)
- [Capabilities](https://cursor.com/docs/cloud-agent/capabilities)
- [Help: Cloud Agents](https://cursor.com/help/ai-features/cloud-agents)
- [cursor.com/agents](https://cursor.com/agents)
- [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints)
