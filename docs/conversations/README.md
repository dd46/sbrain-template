# Conversations

Historia sesji z chatem — **osobno od strukturalnej bazy** (`docs/sailing/`, …).

- **Jeden plik = jedna sesja** (np. `2026-08-16-sm-prawo-drogi.md`).
- **Nie trafia do Neo4j** (parser pomija `docs/conversations/`).
- **Krótkie wiadomości:** jedno zagadnienie na `##` heading.
- Na górze **plan sesji** z checkboxami — co agent ma jeszcze powiedzieć/zrobić.
- Przy każdym zagadnieniu w planie **zostaw punkt quizu** (`Quiz: …`) — po nauce krótkie pytania sprawdzające wiedzę.

## Szablon

```markdown
---
title: "Krótki tytuł sesji"
session: "YYYY-MM-DD"
topic: "namespace lub temat"
---

# Plan sesji

## Nauka
- [x] już omówione
- [ ] następne zagadnienie

## Quiz
- [ ] Quiz: już omówione
- [ ] Quiz: następne zagadnienie

## 1 — Jedno zagadnienie

Treść jednej wiadomości agenta.

### Odpowiedzi

(twoje odpowiedzi albo „—”)

## Quiz — jedno zagadnienie

1. Pytanie?
2. Pytanie?

### Odpowiedzi

(twoje odpowiedzi; poprawne oznacz `[x]` w planie)

## 2 — Kolejne zagadnienie

…
```

## Promocja do KB

Gdy chcesz uporządkowaną notatkę w `docs/`:

```bash
npm run kb:promote -- docs/conversations/2026-08-16-sm-prawo-drogi.md sailing/licenses_certificates/sm_prawo_drogi
```

Potem `npm run sync` (tylko pliki poza `conversations/`).
