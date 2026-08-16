#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCatalog } from "../lib/parse-catalog.js";
import { createDriver, getDocsRoot, verifyConnectivity } from "../lib/neo4j.js";
import { ensureConstraintsOnDriver, syncCatalogToGraph } from "../lib/sync-graph.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = getDocsRoot(repoRoot);

const catalog = parseCatalog(docsRoot);

if (catalog.errors.length > 0) {
  process.stderr.write(
    JSON.stringify({ ok: false, errors: catalog.errors }, null, 2) + "\n",
  );
  process.exit(1);
}

const driver = createDriver();

try {
  await verifyConnectivity(driver);
  await ensureConstraintsOnDriver(driver);
  const summary = await syncCatalogToGraph(driver, catalog);
  process.stdout.write(JSON.stringify({ ok: true, ...summary }, null, 2) + "\n");
} catch (err) {
  process.stderr.write(
    JSON.stringify({ ok: false, error: err.message }, null, 2) + "\n",
  );
  process.exit(1);
} finally {
  await driver.close();
}
