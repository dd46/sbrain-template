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
  assert.equal(first.intents, second.intents);
  assert.equal(first.references, second.references);
  assert.equal(first.namespaces, 4);
  assert.equal(first.documents, 2);
  assert.ok(first.intents >= 1);
  assert.ok(first.references >= 2);
});

test("graph contains root namespace and reciprocal REFERENCES", async () => {
  const session = driver.session();
  try {
    const root = await session.run(`MATCH (n:Namespace {id: ""}) RETURN n.name AS name`);
    assert.equal(root.records.length, 1);
    assert.equal(root.records[0].get("name"), "docs");

    const refs = await session.run(
      `MATCH (a:Document {path: "sailing/basics/wind"})-[:REFERENCES]->(b:Document {path: "sailing/licenses_certificates/sailing_certificate"})
       RETURN count(*) AS c`,
    );
    assert.equal(refs.records[0].get("c").toNumber(), 1);

    const intent = await session.run(
      `MATCH (i:Intent {query: "I want to understand sail aerodynamics", namespaceId: "sailing.basics"})<-[:RECOMMENDED_FOR]-(r:Resource)
       RETURN count(r) AS c`,
    );
    assert.ok(intent.records[0].get("c").toNumber() >= 1);
  } finally {
    await session.close();
  }
});
