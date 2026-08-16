# Conversations

Historia sesji z chatem — **osobno od strukturalnej bazy** (`docs/sailing/`, …).

## Struktura folderu sesji

Jedna sesja chatu = folder `docs/conversations/YYYY-MM-DD-<slug>/`:

```
2026-08-16-sm-meteorologia/
  high-level.md    # plan, notatki, quizy
  history.md       # transkrypt: Ty + Agent (każda wiadomość)
  attachments/     # opcjonalnie — załączniki z chatu
```

- **Pusta historia czatu** (nowy chat) → **nowy folder** sesji z `high-level.md` i `history.md`.
- **Ten sam chat** → dopisuj do plików **tego** folderu.
- **Nie trafia do Neo4j** (parser pomija `docs/conversations/`).
- **Krótkie wiadomości w chat:** jedno zagadnienie; w `high-level.md` jeden `##` na temat.
- Na górze `high-level.md` **plan sesji** z checkboxami (`## Nauka`, `## Quiz`).
- W `history.md` każda wiadomość: `## N` → `### Ty` / `### Agent`.

## Format odpowiedzi (nauka / KB)

Każda wiadomość z treścią merytoryczną:

1. **Referencje numerowane** przy zdaniach/faktach: `[1]`, `[2]` … (wiele źródeł: `[1][3]`).
2. **Legenda na dole** — sekcja `### Źródła` z tabelą: `# | Typ | Źródło`.
3. **Typy:** `KB` (wiki-link w `docs/`), `web` (URL), `model` (wniosek bez dosłownego cytatu).
4. Quizy bez referencji — to pytania do użytkownika.

Przykład legendy:

| # | Typ | Źródło |
|---|-----|--------|
| [1] | KB | [[sailing/licenses_certificates/sm_exam_syllabus]] — temat 7 |
| [2] | web | [IMGW — antycyklony](https://obserwator.imgw.pl/…) |
| [3] | model | Wniosek praktyczny / pułapka egzaminacyjna |

## Szablon — high-level.md

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

## Jedno zagadnienie

Treść notatki (bez pełnego transkryptu chatu).

### Odpowiedzi

(twoje odpowiedzi albo „—")

## Quiz — jedno zagadnienie

1. Pytanie?

### Odpowiedzi

—
```

## Szablon — history.md

```markdown
# Historia czatu

## 1

### Ty

(twoja wiadomość)

### Agent

(odpowiedź agenta)

## 2

### Ty

…
```

## Promocja do KB

Źródło promocji: `high-level.md` (lub folder sesji — skrypt bierze `high-level.md`):

```bash
npm run kb:promote -- docs/conversations/2026-08-16-sm-prawo-drogi/high-level.md sailing/licenses_certificates/sm_prawo_drogi
```

Potem `npm run sync` (tylko pliki poza `conversations/`).
