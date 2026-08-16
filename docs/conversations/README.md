# Conversations

Historia sesji z chatem — **osobno od strukturalnej bazy** (`docs/sailing/`, …).

- **Jeden plik = jedna sesja** (np. `2026-08-16-sm-prawo-drogi.md`).
- **Nie trafia do Neo4j** (parser pomija `docs/conversations/`).
- **Krótkie wiadomości:** jedno zagadnienie na `##` heading.
- Na górze **plan sesji** z checkboxami — co agent ma jeszcze powiedzieć/zrobić.

## Szablon

```markdown
---
title: "Krótki tytuł sesji"
session: "YYYY-MM-DD"
topic: "namespace lub temat"
---

# Plan sesji

- [x] już omówione
- [ ] następna wiadomość

## 1 — Jedno zagadnienie

Treść jednej wiadomości agenta.

### Odpowiedzi

(twoje odpowiedzi albo „—”)

## 2 — Kolejne zagadnienie

…
```

## Promocja do KB

Gdy chcesz uporządkowaną notatkę w `docs/`:

```bash
npm run kb:promote -- docs/conversations/2026-08-16-sm-prawo-drogi.md sailing/licenses_certificates/sm_prawo_drogi
```

Potem `npm run sync` (tylko pliki poza `conversations/`).
