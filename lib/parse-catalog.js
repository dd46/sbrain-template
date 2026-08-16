import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;
const MARKDOWN_LINK_RE = /^\s*-\s+\[([^\]]*)\]\(([^)]+)\)\s*$/;

/**
 * @param {string} docsRoot Absolute path to docs/
 */
export function parseCatalog(docsRoot) {
  /** @type {Map<string, { id: string, name: string, parentId: string | null }>} */
  const namespaces = new Map();
  /** @type {import('./parse-catalog.js').Document[]} */
  const documents = [];
  /** @type {import('./parse-catalog.js').ReferenceEdge[]} */
  const referenceEdges = [];
  /** @type {import('./parse-catalog.js').IntentBundle[]} */
  const intentBundles = [];
  /** @type {string[]} */
  const errors = [];

  namespaces.set("", { id: "", name: "docs", parentId: null });

  walkDir(docsRoot, "", docsRoot, namespaces, documents, referenceEdges, intentBundles, errors);

  return {
    namespaces: [...namespaces.values()],
    documents,
    referenceEdges,
    intentBundles,
    errors,
  };
}

/**
 * @param {string} dir
 * @param {string} relativeDir docs-relative dir ('' at root)
 * @param {string} docsRoot
 */
function walkDir(dir, relativeDir, docsRoot, namespaces, documents, referenceEdges, intentBundles, errors) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    errors.push(`Cannot read directory ${relativeDir || "docs"}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (entry.name === "conversations") {
        continue;
      }
      const id = relativeDir ? `${relativeDir.replace(/\//g, ".")}.${entry.name}` : entry.name;
      const parentId = relativeDir ? relativeDir.replace(/\//g, ".") : "";
      namespaces.set(id, { id, name: entry.name, parentId });
      walkDir(absPath, relPath, docsRoot, namespaces, documents, referenceEdges, intentBundles, errors);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const docPath = relPath.replace(/\.md$/, "");
    let raw;
    try {
      raw = fs.readFileSync(absPath, "utf8");
    } catch (err) {
      errors.push(`${relPath}: ${err.message}`);
      continue;
    }

    let parsed;
    try {
      parsed = matter(raw);
    } catch (err) {
      errors.push(`${relPath}: invalid frontmatter — ${err.message}`);
      continue;
    }

    const fm = parsed.data ?? {};
    const expectedNamespace = deriveNamespaceFromPath(relPath);

    if (fm.type === "recommendations") {
      if (fm.namespace !== expectedNamespace && !(expectedNamespace === "" && fm.namespace === "")) {
        if (typeof fm.namespace !== "string" || fm.namespace !== expectedNamespace) {
          errors.push(
            `${relPath}: namespace "${fm.namespace}" does not match folder id "${expectedNamespace}"`,
          );
        }
      }
      const namespaceId = typeof fm.namespace === "string" ? fm.namespace : expectedNamespace;
      parseRecommendations(parsed.content, namespaceId, intentBundles);
      continue;
    }

    if (entry.name === "recommendations.md") {
      continue;
    }

    const namespace = typeof fm.namespace === "string" ? fm.namespace : null;
    if (namespace === null || namespace !== expectedNamespace) {
      errors.push(
        `${relPath}: namespace must be "${expectedNamespace}"${namespace === null ? " (missing)" : `, got "${namespace}"`}`,
      );
    }

    const title = fm.title;
    if (typeof title !== "string" || !title.trim()) {
      errors.push(`${relPath}: missing title`);
    }

    documents.push({
      title: typeof title === "string" ? title : "",
      path: docPath,
      summary: typeof fm.summary === "string" ? fm.summary : "",
      status: typeof fm.status === "string" ? fm.status : "draft",
      type: typeof fm.type === "string" ? fm.type : "concept",
      tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
      prerequisites: Array.isArray(fm.prerequisites) ? fm.prerequisites.map(String) : [],
      namespaceId: expectedNamespace,
    });

    const internalLinks = extractInternalWikiLinks(parsed.content);
    for (const toPath of internalLinks) {
      referenceEdges.push({ fromPath: docPath, toPath: normalizeWikiPath(toPath) });
    }
  }
}

/**
 * @param {string} relPath docs-relative path with .md
 */
function deriveNamespaceFromPath(relPath) {
  const dir = path.posix.dirname(relPath.replace(/\\/g, "/"));
  if (dir === ".") {
    return "";
  }
  return dir.split("/").join(".");
}

/**
 * @param {string} content
 */
function extractInternalWikiLinks(content) {
  const refsIdx = content.indexOf("## References");
  if (refsIdx === -1) {
    return [];
  }
  const refsBlock = content.slice(refsIdx);
  const internalIdx = refsBlock.indexOf("### Internal");
  if (internalIdx === -1) {
    return [];
  }
  const afterHeading = refsBlock.slice(internalIdx + "### Internal".length);
  const extIdx = afterHeading.indexOf("\n### External");
  const internalBlock =
    extIdx === -1 ? afterHeading : afterHeading.slice(0, extIdx);
  const links = [];
  let match;
  WIKI_LINK_RE.lastIndex = 0;
  while ((match = WIKI_LINK_RE.exec(internalBlock)) !== null) {
    links.push(match[1]);
  }
  return links;
}

/**
 * @param {string} raw
 */
export function normalizeWikiPath(raw) {
  let p = raw.trim().replace(/\\/g, "/");
  if (p.startsWith("docs/")) {
    p = p.slice(5);
  }
  if (p.startsWith("/")) {
    p = p.slice(1);
  }
  if (p.endsWith(".md")) {
    p = p.slice(0, -3);
  }
  return p;
}

/**
 * @param {string} content
 * @param {string} namespaceId
 * @param {import('./parse-catalog.js').IntentBundle[]} intentBundles
 */
function parseRecommendations(content, namespaceId, intentBundles) {
  const lines = content.split("\n");
  /** @type {import('./parse-catalog.js').IntentBundle | null} */
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^#\s+(.+)$/);
    if (heading) {
      if (current) {
        intentBundles.push(current);
      }
      current = {
        intent: { query: heading[1].trim(), namespaceId },
        resources: [],
      };
      continue;
    }

    if (!current) {
      continue;
    }

    const link = line.match(MARKDOWN_LINK_RE);
    if (link) {
      current.resources.push({ title: link[1].trim() || link[2], url: link[2].trim() });
    }
  }

  if (current) {
    intentBundles.push(current);
  }
}
