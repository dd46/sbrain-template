import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCatalog } from "../../lib/parse-catalog.js";
import { createDriver, getDocsRoot, verifyConnectivity } from "../../lib/neo4j.js";
import { ensureConstraintsOnDriver, syncCatalogToGraph } from "../../lib/sync-graph.js";
import {
  getDocumentGraph,
  getRecommendations,
  searchByNamespace,
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

  const catalog = parseCatalog(getDocsRoot(repoRoot));
  await ensureConstraintsOnDriver(driver);
  await syncCatalogToGraph(driver, catalog);
});

after(async () => {
  if (driver) {
    await driver.close();
  }
});

test("search_by_namespace from root finds wind", async () => {
  const results = await searchByNamespace(driver, {
    namespace_id: "",
    query: "wind",
    include_children: true,
  });
  assert.ok(results.some((r) => r.path === "sailing/basics/wind"));
});

test("get_document_graph includes certificate reference", async () => {
  const graph = await getDocumentGraph(driver, {
    file_path: "sailing/basics/wind.md",
  });
  assert.equal(graph.found, true);
  assert.ok(
    graph.references_out.includes("sailing/licenses_certificates/sailing_certificate"),
  );
});

test("get_recommendations returns sailing.basics intents", async () => {
  const data = await getRecommendations(driver, { namespace_id: "sailing.basics" });
  assert.ok(
    data.intents.some((i) => i.query === "I want to understand sail aerodynamics"),
  );
  const aerodynamics = data.intents.find(
    (i) => i.query === "I want to understand sail aerodynamics",
  );
  assert.ok(aerodynamics.resources.length > 0);
});

test("trigger_sync reloads the catalog", async () => {
  const summary = await triggerSync();
  assert.equal(summary.ok, true);
  assert.equal(summary.documents, 2);
});
