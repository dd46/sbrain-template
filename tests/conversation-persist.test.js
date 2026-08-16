import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  appendConversationTurn,
  initSessionFolder,
} from "../lib/conversation-persist.js";
import {
  clearThreadsForTests,
  createThread,
  ensureSessionForThread,
} from "../lib/thread-registry.js";

test.afterEach(() => {
  clearThreadsForTests();
});

test("initSessionFolder creates conversation templates", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "conv-persist-"));
  const docsRoot = path.join(tmp, "docs");
  await fs.mkdir(docsRoot, { recursive: true });

  const session = await initSessionFolder(docsRoot);
  assert.match(session.slug, /^\d{4}-\d{2}-\d{2}-chat-/);

  const highLevel = await fs.readFile(
    path.join(docsRoot, "conversations", session.slug, "high-level.md"),
    "utf8",
  );
  assert.match(highLevel, /# Plan sesji/);

  const sync = await fs.readFile(
    path.join(docsRoot, "conversations", session.slug, "sync.md"),
    "utf8",
  );
  assert.match(sync, /synced: false/);

  const history = await fs.readFile(
    path.join(docsRoot, "conversations", session.slug, "history.md"),
    "utf8",
  );
  assert.match(history, /# Historia czatu/);
});

test("appendConversationTurn appends numbered transcript blocks", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "conv-persist-"));
  const docsRoot = path.join(tmp, "docs");
  await fs.mkdir(docsRoot, { recursive: true });
  const session = await initSessionFolder(docsRoot);

  await appendConversationTurn({
    sessionSlug: session.slug,
    turnNumber: 1,
    userText: "meterologia",
    assistantText: "Temat 7: komunikaty [1]\n\n### Źródła\n\n| # | Typ | Pewność | Źródło |",
    docsRoot,
  });

  const history = await fs.readFile(
    path.join(docsRoot, "conversations", session.slug, "history.md"),
    "utf8",
  );
  assert.match(history, /## 1/);
  assert.match(history, /### Ty/);
  assert.match(history, /meterologia/);
  assert.match(history, /### Agent/);
  assert.match(history, /komunikaty \[1\]/);
});

test("createThread does not write docs/conversations folder until first message", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "conv-persist-"));
  const docsRoot = path.join(tmp, "docs");
  await fs.mkdir(path.join(docsRoot, "conversations"), { recursive: true });
  const prevDocsRoot = process.env.DOCS_ROOT;
  process.env.DOCS_ROOT = docsRoot;

  try {
    const before = await fs.readdir(path.join(docsRoot, "conversations"));

    const thread = createThread();
    assert.ok(thread.id);
    assert.equal(thread.sessionSlug, undefined);

    const afterCreate = await fs.readdir(path.join(docsRoot, "conversations"));
    assert.deepEqual(afterCreate, before);

    const meta = await ensureSessionForThread(thread.id);
    assert.ok(meta?.sessionSlug);
    assert.ok(meta?.sessionPath);

    const afterEnsure = await fs.readdir(path.join(docsRoot, "conversations"));
    assert.equal(afterEnsure.length, before.length + 1);
  } finally {
    if (prevDocsRoot === undefined) {
      delete process.env.DOCS_ROOT;
    } else {
      process.env.DOCS_ROOT = prevDocsRoot;
    }
  }
});
