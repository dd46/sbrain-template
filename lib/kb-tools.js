import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { embed } from "./embeddings.js";
import { normalizeWikiPath } from "./parse-catalog.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let syncInFlight = null;

function textResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * @param {import('neo4j-driver').Driver} driver
 */
export async function searchByNamespace(
  driver,
  { namespace_id, query, include_children = true },
) {
  const session = driver.session();
  try {
    const nsPattern = include_children
      ? `MATCH (root:Namespace {id: $namespaceId})
         MATCH (ns:Namespace)-[:CHILD_OF*0..]->(root)`
      : `MATCH (ns:Namespace {id: $namespaceId})`;

    const result = await session.run(
      `${nsPattern}
       MATCH (d:Document)-[:BELONGS_TO]->(ns)
       WHERE toLower(d.title) CONTAINS toLower($query)
          OR toLower(coalesce(d.summary, '')) CONTAINS toLower($query)
          OR toLower(coalesce(d.body, '')) CONTAINS toLower($query)
          OR any(tag IN coalesce(d.tags, []) WHERE toLower(tag) CONTAINS toLower($query))
       RETURN d.title AS title,
              d.path AS path,
              d.summary AS summary,
              d.status AS status,
              d.type AS type,
              d.tags AS tags,
              ns.id AS namespace_id
       ORDER BY d.path`,
      { namespaceId: namespace_id, query },
    );

    return result.records.map((r) => ({
      title: r.get("title"),
      path: r.get("path"),
      summary: r.get("summary"),
      status: r.get("status"),
      type: r.get("type"),
      tags: r.get("tags"),
      namespace_id: r.get("namespace_id"),
    }));
  } finally {
    await session.close();
  }
}

/**
 * @param {import('neo4j-driver').Driver} driver
 */
export async function semanticSearch(
  driver,
  { namespace_id, query, include_children = true, top_k = 5 },
) {
  const queryEmbedding = await embed(query);
  const session = driver.session();
  try {
    const nsPattern = include_children
      ? `MATCH (root:Namespace {id: $namespaceId})
         MATCH (ns:Namespace)-[:CHILD_OF*0..]->(root)`
      : `MATCH (ns:Namespace {id: $namespaceId})`;

    const docs = await session.run(
      `${nsPattern}
       MATCH (d:Document)-[:BELONGS_TO]->(ns)
       RETURN d.path AS path, d.title AS title, d.embedding AS embedding`,
      { namespaceId: namespace_id },
    );

    const sections = await session.run(
      `${nsPattern}
       MATCH (s:Section)-[:SECTION_OF]->(d:Document)-[:BELONGS_TO]->(ns)
       RETURN d.path AS path, s.id AS section_id, s.heading AS title, s.embedding AS embedding`,
      { namespaceId: namespace_id },
    );

    const candidates = [
      ...docs.records.map((r) => ({
        kind: "document",
        path: r.get("path"),
        section_id: null,
        title: r.get("title"),
        embedding: r.get("embedding"),
      })),
      ...sections.records.map((r) => ({
        kind: "section",
        path: r.get("path"),
        section_id: r.get("section_id"),
        title: r.get("title"),
        embedding: r.get("embedding"),
      })),
    ];

    const results = candidates
      .map((row) => ({
        kind: row.kind,
        path: row.path,
        section_id: row.section_id,
        title: row.title,
        score: cosineSimilarity(queryEmbedding, row.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, top_k);

    return { query, namespace_id, results };
  } finally {
    await session.close();
  }
}

/**
 * @param {import('neo4j-driver').Driver} driver
 */
export async function getDocumentGraph(driver, { file_path }) {
  const docPath = normalizeWikiPath(file_path);
  const session = driver.session();
  try {
    const docResult = await session.run(
      `MATCH (d:Document {path: $path})-[:BELONGS_TO]->(ns:Namespace)
       RETURN d { .title, .path, .summary, .status, .type, .tags, .prerequisites, .body, .track_quiz } AS document,
              ns { .id, .name } AS namespace`,
      { path: docPath },
    );

    if (docResult.records.length === 0) {
      return { found: false, path: docPath };
    }

    const row = docResult.records[0];
    const outgoing = await session.run(
      `MATCH (d:Document {path: $path})-[:REFERENCES]->(t:Document)
       RETURN t.path AS path`,
      { path: docPath },
    );
    const incoming = await session.run(
      `MATCH (s:Document)-[:REFERENCES]->(d:Document {path: $path})
       RETURN s.path AS path`,
      { path: docPath },
    );
    const sectionRows = await session.run(
      `MATCH (s:Section)-[:SECTION_OF]->(d:Document {path: $path})
       RETURN s.id AS id, s.heading AS heading, s.quiz_confirmed AS quiz_confirmed,
              s.quiz_confirmed_at AS quiz_confirmed_at
       ORDER BY s.heading`,
      { path: docPath },
    );

    return {
      found: true,
      document: row.get("document"),
      namespace: row.get("namespace"),
      sections: sectionRows.records.map((r) => ({
        id: r.get("id"),
        heading: r.get("heading"),
        quiz_confirmed: r.get("quiz_confirmed"),
        quiz_confirmed_at: r.get("quiz_confirmed_at"),
      })),
      references_out: outgoing.records.map((r) => r.get("path")),
      references_in: incoming.records.map((r) => r.get("path")),
    };
  } finally {
    await session.close();
  }
}

/**
 * @param {import('neo4j-driver').Driver} driver
 */
export async function getRecommendations(driver, { namespace_id }) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (i:Intent {namespaceId: $namespaceId})-[:BELONGS_TO]->(ns:Namespace)
       OPTIONAL MATCH (r:Resource)-[:RECOMMENDED_FOR]->(i)
       RETURN i.query AS query,
              collect(CASE WHEN r IS NULL THEN NULL ELSE { title: r.title, url: r.url } END) AS resources
       ORDER BY i.query`,
      { namespaceId: namespace_id },
    );

    const intents = result.records.map((r) => ({
      query: r.get("query"),
      resources: r.get("resources").filter(Boolean),
    }));

    return { namespace_id, intents };
  } finally {
    await session.close();
  }
}

export async function triggerSync() {
  if (syncInFlight) {
    throw new Error("Sync already in progress");
  }

  const scriptPath = path.join(repoRoot, "scripts", "sync_to_neo4j.js");

  syncInFlight = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Sync timed out after 300s"));
    }, 300_000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Sync exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ raw: stdout.trim() });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

export { textResult };
