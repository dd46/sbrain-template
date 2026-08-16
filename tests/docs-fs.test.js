import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertWithinDocsRoot,
  listDocsDir,
  readDocsFile,
  resolveDocsPath,
  writeDocsFile,
} from "../lib/docs-fs.js";

test("write and read file under docs root", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sbrain-docs-"));
  const filePath = "notes/hello.md";
  await writeDocsFile(filePath, "hello world", tmp);
  const content = await readDocsFile(filePath, tmp);
  assert.equal(content, "hello world");
  const listing = await listDocsDir("notes", tmp);
  assert.ok(listing.some((e) => e.name === "hello.md"));
});

test("resolveDocsPath rejects traversal", () => {
  const root = "/tmp/docs-root";
  assert.throws(() => resolveDocsPath("../etc/passwd", root), /outside docs root/);
  assert.throws(() => resolveDocsPath("../../secret", root), /outside docs root/);
});

test("assertWithinDocsRoot rejects symlink escape", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sbrain-sandbox-"));
  const docsRoot = path.join(tmp, "docs");
  const outside = path.join(tmp, "outside");
  await fs.mkdir(docsRoot, { recursive: true });
  await fs.mkdir(outside, { recursive: true });
  await fs.writeFile(path.join(outside, "secret.txt"), "nope", "utf8");

  const linkPath = path.join(docsRoot, "escape-link");
  try {
    await fs.symlink(outside, linkPath);
    await assertWithinDocsRoot(path.join(linkPath, "secret.txt"), docsRoot);
    assert.fail("expected symlink escape to throw");
  } catch (err) {
    assert.match(String(err), /outside docs root/);
  }
});

test("write to new nested path stays under docs root", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sbrain-nested-"));
  const target = path.join(tmp, "conversations", "2026-08-16-test", "high-level.md");
  await assertWithinDocsRoot(target, tmp);
  await writeDocsFile("conversations/2026-08-16-test/high-level.md", "# Test", tmp);
  assert.equal(await readDocsFile("conversations/2026-08-16-test/high-level.md", tmp), "# Test");
});
