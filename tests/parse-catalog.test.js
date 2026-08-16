import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCatalog, normalizeWikiPath } from "../lib/parse-catalog.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedDocs = path.join(repoRoot, "docs");

test("parseCatalog includes root namespace with empty string id", () => {
  const catalog = parseCatalog(seedDocs);
  assert.equal(catalog.errors.length, 0, catalog.errors.join("; "));
  const root = catalog.namespaces.find((n) => n.id === "");
  assert.ok(root, "root namespace missing");
  assert.equal(root.name, "docs");
  assert.equal(root.parentId, null);
});

test("wind.md parses to sailing/basics path and namespace", () => {
  const catalog = parseCatalog(seedDocs);
  const wind = catalog.documents.find((d) => d.path === "sailing/basics/wind");
  assert.ok(wind);
  assert.equal(wind.namespaceId, "sailing.basics");
  assert.equal(wind.type, "concept");
  assert.ok(wind.tags.includes("wind"));
});

test("wind.md has wiki-link to sailing certificate", () => {
  const catalog = parseCatalog(seedDocs);
  const edge = catalog.referenceEdges.find(
    (e) =>
      e.fromPath === "sailing/basics/wind" &&
      e.toPath === "sailing/licenses_certificates/sailing_certificate",
  );
  assert.ok(edge, "expected REFERENCES edge from wind to certificate");
});

test("root recommendations.md yields intents not documents", () => {
  const catalog = parseCatalog(seedDocs);
  const rootDoc = catalog.documents.find((d) => d.path === "recommendations");
  assert.equal(rootDoc, undefined);
  const rootIntents = catalog.intentBundles.filter((b) => b.intent.namespaceId === "");
  assert.ok(rootIntents.length > 0);
});

test("sailing.basics recommendations include aerodynamics intent", () => {
  const catalog = parseCatalog(seedDocs);
  const bundle = catalog.intentBundles.find(
    (b) =>
      b.intent.namespaceId === "sailing.basics" &&
      b.intent.query === "I want to understand sail aerodynamics",
  );
  assert.ok(bundle);
  assert.ok(bundle.resources.some((r) => r.url.includes("youtube.com")));
});

test("normalizeWikiPath strips docs prefix and .md suffix", () => {
  assert.equal(normalizeWikiPath("docs/sailing/basics/wind.md"), "sailing/basics/wind");
  assert.equal(normalizeWikiPath("/sailing/basics/wind"), "sailing/basics/wind");
});

test("folder without recommendations.md still parses", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sbrain-parse-"));
  const noteDir = path.join(tmp, "alpha");
  fs.mkdirSync(noteDir, { recursive: true });
  fs.writeFileSync(
    path.join(noteDir, "note.md"),
    `---
title: "Note"
namespace: "alpha"
type: "concept"
status: "draft"
summary: "Test note."
tags: []
prerequisites: []
---
# Note
---
## References
### Internal
### External
`,
    "utf8",
  );

  const catalog = parseCatalog(tmp);
  assert.equal(catalog.errors.length, 0, catalog.errors.join("; "));
  assert.equal(catalog.documents.length, 1);
  assert.equal(catalog.intentBundles.length, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});
