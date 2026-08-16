import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocsRoot } from "./neo4j.js";
import { writeDocsFile } from "./docs-fs.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shortId() {
  return crypto.randomUUID().slice(0, 8);
}

function getConversationsRoot(docsRoot = getDocsRoot(repoRoot)) {
  return path.join(docsRoot, "conversations");
}

/**
 * @param {string} [docsRoot]
 */
export function createSessionSlug(docsRoot = getDocsRoot(repoRoot)) {
  const date = todayIso();
  const slug = `${date}-chat-${shortId()}`;
  const dir = path.join(getConversationsRoot(docsRoot), slug);
  return { slug, relativePath: `conversations/${slug}`, absolutePath: dir };
}

/**
 * @param {string} [docsRoot]
 */
export async function initSessionFolder(docsRoot = getDocsRoot(repoRoot)) {
  const { slug, relativePath } = createSessionSlug(docsRoot);
  const date = todayIso();

  await writeDocsFile(
    `${relativePath}/high-level.md`,
    `---
title: "Sesja chatu"
session: "${date}"
topic: ""
---

# Plan sesji

## Nauka

- [ ] Pierwsze zagadnienie

## Quiz

- [ ] Quiz: pierwsze zagadnienie

## Notatki

(pierwsza odpowiedź agenta uzupełni ten blok)

`,
    docsRoot,
  );

  await writeDocsFile(
    `${relativePath}/history.md`,
    `# Historia czatu

`,
    docsRoot,
  );

  await writeDocsFile(
    `${relativePath}/sync.md`,
    `---
synced: false
synced_at: null
---

# Sync z KB

Sesja **nie została jeszcze zsynchronizowana** ze strukturalną bazą.

Powiedz **synchronizuj** gdy chcesz zapisać wpływ tej rozmowy na KB.

## Dziennik

(brak — uzupełniane przy synchronizuj)
`,
    docsRoot,
  );

  return { slug, relativePath: `conversations/${slug}` };
}

/**
 * @param {{
 *   sessionSlug: string,
 *   turnNumber: number,
 *   userText: string,
 *   assistantText: string,
 *   docsRoot?: string,
 * }} args
 */
export async function appendConversationTurn({
  sessionSlug,
  turnNumber,
  userText,
  assistantText,
  docsRoot = getDocsRoot(repoRoot),
}) {
  const relativePath = `conversations/${sessionSlug}/history.md`;
  const block = `\n## ${turnNumber}\n\n### Ty\n\n${userText.trim()}\n\n### Agent\n\n${assistantText.trim()}\n`;
  const existing = await fs.readFile(path.join(docsRoot, relativePath), "utf8");
  await writeDocsFile(relativePath, `${existing.replace(/\s*$/, "")}${block}`, docsRoot);
}

export function buildSessionSystemMessage(sessionRelativePath) {
  return (
    `Aktywna sesja: docs/${sessionRelativePath}/ (high-level.md, history.md, sync.md). ` +
    "Transkrypt dopisuje serwer do history.md — ty utrzymuj high-level.md (plan + jeden ## na temat). " +
    "Format odpowiedzi merytorycznych (docs/conversations/README.md): " +
    "numerowane [1][2] przy faktach; na końcu ### Źródła z tabelą (# | Typ | Pewność | Źródło); " +
    "Typ: KB / web / model; Pewność: High / Medium / Low (wierność cytatu). " +
    "Jedno zagadnienie na wiadomość. Quiz na końcu nauki — numerowane pytania 1. 2. 3., bez referencji w quizie."
  );
}
