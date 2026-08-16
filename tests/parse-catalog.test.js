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

test("polish_sailing_license.md parses in licenses_certificates namespace", () => {
  const catalog = parseCatalog(seedDocs);
  const note = catalog.documents.find(
    (d) => d.path === "sailing/licenses_certificates/polish_sailing_license",
  );
  assert.ok(note);
  assert.equal(note.namespaceId, "sailing.licenses_certificates");
  assert.equal(note.type, "manual");
  assert.ok(note.tags.includes("pzz"));
});

test("polish_sailing_license links to motorboat license", () => {
  const catalog = parseCatalog(seedDocs);
  const edge = catalog.referenceEdges.find(
    (e) =>
      e.fromPath === "sailing/licenses_certificates/polish_sailing_license" &&
      e.toPath === "sailing/licenses_certificates/polish_motorboat_license",
  );
  assert.ok(edge, "expected REFERENCES edge between polish license notes");
});

test("licenses_certificates recommendations.md yields intents not documents", () => {
  const catalog = parseCatalog(seedDocs);
  const recDoc = catalog.documents.find(
    (d) => d.path === "sailing/licenses_certificates/recommendations",
  );
  assert.equal(recDoc, undefined);
  const intents = catalog.intentBundles.filter(
    (b) => b.intent.namespaceId === "sailing.licenses_certificates",
  );
  assert.ok(intents.length > 0);
});

test("licenses_certificates recommendations include Poland certificate intent", () => {
  const catalog = parseCatalog(seedDocs);
  const bundle = catalog.intentBundles.find(
    (b) =>
      b.intent.namespaceId === "sailing.licenses_certificates" &&
      b.intent.query === "I want to know which certificate I need (Poland)",
  );
  assert.ok(bundle);
  assert.ok(bundle.resources.some((r) => r.url.includes("pya.org.pl")));
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
