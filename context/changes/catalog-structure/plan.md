# Catalog Structure Implementation Plan

## Overview

Lock the existing English sailing tree under `docs/` as the canonical knowledge-catalog seed, and make three conventions explicit in `spec.md`: empty-string root namespace, optional `recommendations.md`, and wiki-links as paths relative to `docs/`. Align the two sample notes so Internal links match that wiki-link contract.

## Current State Analysis

The catalog seed already exists and matches `spec.md` §2–3 in structure and language. There is no `context/changes/catalog-structure/` history yet; this change retroactively owns that seed plus the convention gaps.

- Tree on disk: `docs/` → `sailing/` → `basics/` and `licenses_certificates/`, each with `recommendations.md`, plus `wind.md` and `sailing_certificate.md`.
- Regular notes have the full YAML schema (`title`, `namespace`, `type`, `status`, `summary`, `tags`, `prerequisites`) and a trailing `## References` block. See `docs/sailing/basics/wind.md` and `docs/sailing/licenses_certificates/sailing_certificate.md`.
- All six markdown files are English. Namespace IDs are dotted folder paths (`sailing`, `sailing.basics`, `sailing.licenses_certificates`).
- Root `docs/recommendations.md` uses `namespace: ""` — spec examples only show dotted ids.
- Internal wiki-links in the seed are filename stems (`[[wind]]`, `[[sailing_certificate]]`). Planning decided they should be `docs/`-relative paths instead.
- Spec §2 says each level *may* have `recommendations.md`; §7 tells Cursor to create one per level. Planning decided the file is optional; the seed keeps its copies as demonstrations.
- Catalog rules live only in `spec.md`. No `docs/README.md`. Backend from spec §4–6 (`scripts/`, `mcp_server/`, `docker-compose.yml`, `package.json`) is absent and out of scope.

## Desired End State

`spec.md` §2–3 states the three conventions without contradiction. The sailing seed still demonstrates a two-level hierarchy, both note kinds (regular + recommendations), and cross-namespace Internal links — all in English. Wiki-links in sample notes resolve to real files as `docs/`-relative paths without `.md`. A later sync/MCP change can parse this tree without guessing root-id or link identity.

### Key Discoveries:

- Seed tree already matches `spec.md` lines 12–22; this change is convention lock + link rewrite, not a greenfield catalog.
- Root namespace is an empty string in `docs/recommendations.md` line 3, not omitted and not `"root"`.
- Current Internal links at `docs/sailing/basics/wind.md` line 29 (`[[sailing_certificate]]`) and `docs/sailing/licenses_certificates/sailing_certificate.md` line 26 (`[[wind]]`) must become path-form wiki-links.
- Spec §3.A example still shows `[[other_file_name]]` (`spec.md` around the Internal references example) — that example must change with the seed.

## What We're NOT Doing

- Neo4j sync (`scripts/sync_to_neo4j.js`), MCP server, Docker Compose, or `package.json`.
- A `docs/README.md` or duplicating catalog rules outside `spec.md`.
- Replacing the sailing domain or adding extra note types (`resource`, `person`) beyond the existing `concept` + `manual` samples.
- Making `recommendations.md` mandatory, or deleting the seed copies that demonstrate it.
- Changing placeholder external URLs (e.g. `youtube.com/watch?v=example`) into real resources.
- Enforcing unique filename stems globally — path-form wiki-links make that unnecessary.

## Implementation Approach

Treat `spec.md` as the single source of truth. First write the three conventions into §2–3 (and fix the §3.A wiki-link example) so the implementer of later sync/MCP work does not have to infer them from files. Then rewrite only the Internal wiki-links in the two regular notes so the seed matches the spec. Finally run a file/schema checklist — there is no test runner in this repo yet.

## Critical Implementation Details

Wiki-link contract (load-bearing for later `[:REFERENCES]` parsing): Internal links are paths relative to `docs/`, forward slashes, no `.md` suffix. The two rewrites are `[[sailing/basics/wind]]` and `[[sailing/licenses_certificates/sailing_certificate]]`. Do not keep stem-only links in the seed after this change.

Root `namespace` field stays present with value `""` (empty string), not omitted. A future parser must treat that as the root Namespace node, not as “missing”.

---

## Phase 1: Spec conventions

### Overview

Make `spec.md` §2–3 explicit about root namespace, optional `recommendations.md`, and `docs/`-relative wiki-links so the spec and the seed cannot drift.

### Changes Required:

#### 1. Directory-structure notes

**File**: `spec.md`

**Intent**: State that `docs/` is the root namespace with id `""`, that `recommendations.md` is optional at every level (the sample tree includes it to show the format), and that namespace ids equal dotted folder paths under `docs/`.

**Contract**: §2 prose and/or tree comments. Do not rename folders. Do not add a `docs/README.md`.

#### 2. Markdown file specification

**File**: `spec.md`

**Intent**: Update §3.A Internal reference example from a filename stem to a `docs/`-relative path. Mention that `namespace: ""` is valid only at root `recommendations.md` / notes sitting directly in `docs/`.

**Contract**: The Internal example becomes a path like `[[sailing/basics/wind]]`. §3.B may keep `namespace: "parent.child"` as the non-root example.

### Success Criteria:

#### Automated Verification:

- `spec.md` contains the substring `namespace: ""` (or equivalent quoted empty string) in a root-namespace explanation.
- `spec.md` contains a `docs/`-relative wiki-link example (`[[sailing/` or the chosen sample path).
- `spec.md` still describes `recommendations.md` as optional (`may`), not required.

#### Manual Verification:

- Reading §2–3 alone is enough to implement a parser for namespace id, recommendations files, and Internal links without opening `docs/`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Seed alignment

### Overview

Rewrite Internal wiki-links in the two regular notes so the committed examples match the spec contract. Leave folder names, English body copy, frontmatter, and all `recommendations.md` files unchanged except if a wiki-link appears there (none do today).

### Changes Required:

#### 1. Wind note Internal link

**File**: `docs/sailing/basics/wind.md`

**Intent**: Point the Internal reference at the certificate note via a `docs/`-relative path so a later resolver does not need a global stem index.

**Contract**: `### Internal` list item becomes `[[sailing/licenses_certificates/sailing_certificate]]`. Frontmatter, body, and External links stay as they are.

#### 2. Certificate note Internal link

**File**: `docs/sailing/licenses_certificates/sailing_certificate.md`

**Intent**: Reciprocal link back to the wind note using the same path contract.

**Contract**: `### Internal` list item becomes `[[sailing/basics/wind]]`. Frontmatter, body, and External links stay as they are.

### Success Criteria:

#### Automated Verification:

- `rg -n '\[\[wind\]\]|\[\[sailing_certificate\]\]' docs/` returns no matches.
- `rg -n '\[\[sailing/basics/wind\]\]' docs/sailing/licenses_certificates/sailing_certificate.md` matches.
- `rg -n '\[\[sailing/licenses_certificates/sailing_certificate\]\]' docs/sailing/basics/wind.md` matches.

#### Manual Verification:

- Both notes still read as English sample content; only the Internal link targets changed.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Catalog verification

### Overview

Confirm the locked seed is complete, English, schema-complete, and internally consistent — without adding new notes or infrastructure.

### Changes Required:

#### 1. Tree and schema checklist

**File**: `docs/**/*.md` (read-only unless a checklist failure forces a fix that still fits Phases 1–2)

**Intent**: Prove the sample catalog is usable as the fixture for a future sync script: every expected path exists, frontmatter matches spec enums, wiki-links resolve, no non-English example copy.

**Contract**: Expected paths:

```text
docs/recommendations.md
docs/sailing/recommendations.md
docs/sailing/basics/recommendations.md
docs/sailing/basics/wind.md
docs/sailing/licenses_certificates/recommendations.md
docs/sailing/licenses_certificates/sailing_certificate.md
```

Root recommendations keep `namespace: ""`. Other files keep dotted ids matching their folder. Regular notes keep `type` in `concept | resource | person | manual` and `status` in `draft | consumed | mastered`.

### Success Criteria:

#### Automated Verification:

- All six paths above exist (`test -f` each).
- `rg -n 'namespace:' docs/` shows `""` only in `docs/recommendations.md` and dotted ids elsewhere.
- Regular notes contain `## References`, `### Internal`, and `### External`.
- `rg -n 'type: "recommendations"' docs/` matches exactly the four `recommendations.md` files.
- Wiki-link targets exist: for each `[[path]]` under `docs/`, `docs/<path>.md` is a file.

#### Manual Verification:

- Spot-read all six files: English throughout, intents under `#` in recommendations files, sailing examples still illustrate hierarchy rather than production knowledge.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- None — this repo has no test runner yet. Treat `rg` / `test -f` checks in each phase as the automated stand-in.

### Integration Tests:

- None in this change. A future sync-script change should use this seed as a fixture (root `""`, path wiki-links, optional recommendations).

### Manual Testing Steps:

1. Open `spec.md` §2–3 and confirm a new reader can state root id, optional recommendations, and wiki-link shape.
2. Open `wind.md` and `sailing_certificate.md` and follow Internal links as paths under `docs/`.
3. Skim all `recommendations.md` files: `#` intents, bullet URIs, English only.

## Performance Considerations

Not applicable — static markdown seed, no runtime.

## Migration Notes

Stem-form wiki-links (`[[wind]]`, `[[sailing_certificate]]`) are removed from `docs/` in Phase 2. Nothing else in the repo currently parses them. If local uncommitted notes exist outside this seed, rewrite them to path form in the same change.

## References

- Product spec: `spec.md` (§2 Directory Structure, §3 Markdown File Specification)
- Seed notes: `docs/sailing/basics/wind.md`, `docs/sailing/licenses_certificates/sailing_certificate.md`
- Progress contract: `.claude/skills/10x-plan/references/progress-format.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Spec conventions

#### Automated

- [x] 1.1 spec.md explains root namespace as empty string
- [x] 1.2 spec.md shows a docs/-relative wiki-link example
- [x] 1.3 spec.md still describes recommendations.md as optional

#### Manual

- [x] 1.4 §2–3 is enough to implement a parser without opening docs/

### Phase 2: Seed alignment

#### Automated

- [x] 2.1 no stem-only wiki-links remain under docs/
- [x] 2.2 sailing_certificate.md links to [[sailing/basics/wind]]
- [x] 2.3 wind.md links to [[sailing/licenses_certificates/sailing_certificate]]

#### Manual

- [x] 2.4 sample notes still read as English; only Internal targets changed

### Phase 3: Catalog verification

#### Automated

- [x] 3.1 all six expected catalog paths exist
- [x] 3.2 empty namespace only at docs/recommendations.md; dotted ids elsewhere
- [x] 3.3 regular notes have References / Internal / External headings
- [x] 3.4 exactly four files use type: "recommendations"
- [x] 3.5 every [[wiki-link]] under docs/ resolves to docs/<path>.md

#### Manual

- [x] 3.6 all six files are English and still illustrate hierarchy
