# Catalog Structure — Plan Brief

> Full plan: `context/changes/catalog-structure/plan.md`

## What & Why

Lock an English, hierarchical Markdown catalog under `docs/` so later GraphRAG sync/MCP work has a real fixture instead of an empty tree. The sailing sample already exists; this change records the conventions that were still implicit and aligns Internal wiki-links with the chosen identity rule.

## Starting Point

`docs/` already has `sailing` → `basics` / `licenses_certificates`, `recommendations.md` at each level, and two notes (`wind.md`, `sailing_certificate.md`) with full YAML + References. `spec.md` describes the tree but does not name the root id or the wiki-link path form. No Neo4j/MCP code exists yet.

## Desired End State

A reader of `spec.md` §2–3 knows: root namespace is `""`, `recommendations.md` is optional, Internal links are `docs/`-relative paths without `.md`. The seed demonstrates those rules in English and can be parsed without guessing.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Scope | Lock existing sailing seed | Tree already matches spec §2; rewriting the domain would add noise without teaching new mechanics. |
| Root namespace | `namespace: ""` | Matches the seeded file; avoids a magic `"root"` id that diverges from the folder path. |
| `recommendations.md` | Optional at every level | Spec §2 already says *may*; empty stubs should not be mandatory. Seed keeps its copies as demos. |
| Convention home | `spec.md` only | One source of truth; a `docs/README.md` would duplicate §2–3. |
| Wiki-link identity | `[[sailing/basics/wind]]` (path from `docs/`) | Globally unique without a stem index; seed stems must be rewritten. |

## Scope

**In scope:** `spec.md` §2–3 convention text; Internal wiki-link rewrites in the two regular notes; verification checklist on the six seed files.

**Out of scope:** sync script, MCP, Docker, `package.json`, extra note types, replacing sailing, real-ifying placeholder URLs, `docs/README.md`.

## Architecture / Approach

Static catalog: folders = namespaces, dotted ids = path segments, notes = YAML + body + References. Spec is updated first so the seed cannot be the only place the rules live; then the two Internal links are rewritten to path form; then a `test -f` / `rg` checklist confirms consistency.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Spec conventions | Root id, optional recommendations, path wiki-links written into `spec.md` | Spec and seed still disagree if Phase 2 is skipped |
| 2. Seed alignment | Internal links use `docs/`-relative paths | Missed stem links elsewhere under `docs/` |
| 3. Catalog verification | Tree/schema/English/link-resolution checklist | Checklist passes while spec prose stays vague — Phase 1 exists to prevent that |

**Prerequisites:** Current `docs/` seed and `spec.md` on `main` (already committed).
**Estimated effort:** ~1 session across 3 short phases.

## Open Risks & Assumptions

- A future sync script must treat `namespace: ""` as a real Namespace node, not skip empty strings.
- Path wiki-links assume `docs/` is the catalog root; notes outside `docs/` are not part of this contract.
- Placeholder external URLs stay fake; they are examples of shape, not a curated reading list.

## Success Criteria (Summary)

- `spec.md` §2–3 states the three conventions without contradicting §7’s example tree.
- `[[sailing/basics/wind]]` and `[[sailing/licenses_certificates/sailing_certificate]]` are the Internal links in the seed; no stem-only links remain.
- All six catalog files exist, are English, and match the YAML rules in spec §3.
