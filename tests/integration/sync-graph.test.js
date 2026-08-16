import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCatalog } from "../../lib/parse-catalog.js";
import { createDriver, getDocsRoot, verifyConnectivity } from "../../lib/neo4j.js";
import { ensureConstraintsOnDriver, syncCatalogToGraph } from "../../lib/sync-graph.js";

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
  assert.equal(catalog.errors.length, 0, catalog.errors.join("; "));
  await ensureConstraintsOnDriver(driver);
  await syncCatalogToGraph(driver, catalog);
});

after(async () => {
  if (driver) {
    await driver.close();
  }
});

test("sync is idempotent on the sailing seed", async () => {
  const catalog = parseCatalog(getDocsRoot(repoRoot));
  const first = await syncCatalogToGraph(driver, catalog);
  const second = await syncCatalogToGraph(driver, catalog);
  assert.equal(first.namespaces, second.namespaces);
  assert.equal(first.documents, second.documents);
  assert.equal(first.namespaces, 3);
  assert.equal(first.documents, 5);
  assert.ok(first.intents >= 1);
  assert.ok(first.references >= 2);
});

test("graph contains document body and REFERENCES edges", async () => {
  const session = driver.session();
  try {
    const root = await session.run(`MATCH (n:Namespace {id: ""}) RETURN n.name AS name`);
    assert.equal(root.records.length, 1);
    assert.equal(root.records[0].get("name"), "docs");

    const body = await session.run(
      `MATCH (d:Document {path: "sailing/licenses_certificates/polish_motorboat_license"})
       RETURN d.body AS body`,
    );
    assert.ok(body.records[0].get("body").includes("PZMWiNW"));

    const refs = await session.run(
      `MATCH (a:Document {path: "sailing/licenses_certificates/polish_sailing_license"})-[:REFERENCES]->(b:Document)
       RETURN b.path AS path`,
    );
    assert.ok(
      refs.records.some((r) => r.get("path") === "sailing/licenses_certificates/polish_motorboat_license"),
    );
  } finally {
    await session.close();
  }
});
