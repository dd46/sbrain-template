import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCatalog } from "../../lib/parse-catalog.js";
import { createDriver, getKbRoot, verifyConnectivity } from "../../lib/neo4j.js";
import { ensureConstraintsOnDriver, syncCatalogToGraph } from "../../lib/sync-graph.js";
import {
  getDocumentGraph,
  getRecommendations,
  searchByNamespace,
  semanticSearch,
  triggerSync,
} from "../../lib/kb-tools.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('neo4j-driver').Driver} */
let driver;

before(async () => {
  driver = createDriver();
  try {
    await verifyConnectivity(driver);
  } catch {
    console.error("Neo4j is not reachable — start docker-compose up -d");
    process.exit(1);
  }

  const catalog = parseCatalog(getKbRoot(repoRoot));
  await ensureConstraintsOnDriver(driver);
  await syncCatalogToGraph(driver, catalog);
});

after(async () => {
  if (driver) {
    await driver.close();
  }
});

test("search_by_namespace finds motorboat license by body text", async () => {
  const results = await searchByNamespace(driver, {
    namespace_id: "sailing.licenses_certificates",
    query: "sternik motorowodny",
    include_children: false,
  });
  assert.ok(
    results.some((r) => r.path === "sailing/licenses_certificates/polish_motorboat_license"),
  );
});

test("get_document_graph includes body on document", async () => {
  const graph = await getDocumentGraph(driver, {
    file_path: "sailing/licenses_certificates/polish_motorboat_license",
  });
  assert.equal(graph.found, true);
  assert.ok(graph.document.body?.includes("PZMWiNW"));
  assert.equal(graph.sections.length, 0);
});

test("get_recommendations returns licenses_certificates intents", async () => {
  const data = await getRecommendations(driver, { namespace_id: "sailing.licenses_certificates" });
  assert.ok(data.intents.some((i) => i.query.includes("SM exam")));
});

test("semantic_search returns motorboat license for age query", async () => {
  const data = await semanticSearch(driver, {
    namespace_id: "sailing.licenses_certificates",
    query: "minimum age for motorboat license Poland",
    include_children: false,
    top_k: 3,
  });
  assert.ok(
    data.results.some((r) => r.path === "sailing/licenses_certificates/polish_motorboat_license"),
  );
});

test("trigger_sync reloads the catalog", async () => {
  const summary = await triggerSync();
  assert.equal(summary.ok, true);
  assert.equal(summary.documents, 5);
});
