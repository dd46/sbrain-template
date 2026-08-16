#!/usr/bin/env node
/**
 * Promote a conversation session into a structured KB note (spec.md frontmatter).
 *
 * Usage:
 *   node scripts/kb_promote.js <session-folder-or-high-level.md> <target-path-without-.md>
 *
 * Example:
 *   npm run kb:promote -- docs/conversations/2026-08-16-sm-prawo-drogi/high-level.md sailing/licenses_certificates/sm_prawo_drogi
 *   npm run kb:promote -- docs/conversations/2026-08-16-sm-prawo-drogi sailing/licenses_certificates/sm_prawo_drogi
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = path.join(repoRoot, "docs");

const [conversationArg, targetArg] = process.argv.slice(2);

if (!conversationArg || !targetArg) {
  process.stderr.write(
    "Usage: kb_promote.js <docs/conversations/session-or-high-level.md> <target/path/without-md>\n",
  );
  process.exit(1);
}

const inputPath = path.isAbsolute(conversationArg)
  ? conversationArg
  : path.join(repoRoot, conversationArg);

const normalizedInput = inputPath.replace(/\\/g, "/");
if (!normalizedInput.includes("/docs/conversations/")) {
  process.stderr.write("Source must live under docs/conversations/\n");
  process.exit(1);
}

/** Resolve session folder or legacy .md to high-level.md path. */
function resolveHighLevelPath(p) {
  const norm = p.replace(/\\/g, "/");
  if (norm.endsWith("/high-level.md")) {
    return p;
  }
  if (norm.endsWith(".md") && !norm.endsWith("/high-level.md")) {
    return p;
  }
  return path.join(p, "high-level.md");
}

const conversationPath = resolveHighLevelPath(inputPath);
const sessionFolderName = path.basename(path.dirname(conversationPath));

const targetRel = targetArg.replace(/\.md$/, "").replace(/^docs\//, "");
const targetPath = path.join(docsRoot, `${targetRel}.md`);
const namespaceId = path.posix.dirname(targetRel).split("/").join(".");

if (!namespaceId && targetRel.includes("/")) {
  process.stderr.write("Invalid target path\n");
  process.exit(1);
}

if (!fs.existsSync(conversationPath)) {
  process.stderr.write(`Not found: ${conversationPath}\n`);
  process.exit(1);
}

const raw = fs.readFileSync(conversationPath, "utf8");
const { data: fm, content } = matter(raw);

const sections = [];
const lines = content.split("\n");
/** @type {{ heading: string, body: string[] } | null} */
let current = null;

for (const line of lines) {
  const h2 = line.match(/^##\s+(.+)$/);
  if (h2) {
    if (current) {
      sections.push(current);
    }
    current = { heading: h2[1].trim(), body: [] };
    continue;
  }
  if (current && !line.match(/^#\s+/)) {
    current.body.push(line);
  }
}
if (current) {
  sections.push(current);
}

if (sections.length === 0) {
  process.stderr.write("No ## sections found in conversation file\n");
  process.exit(1);
}

const title =
  typeof fm.title === "string" && fm.title.trim()
    ? fm.title.trim()
    : sections[0].heading;

const bodyParts = sections.map((s) => {
  const text = s.body.join("\n").trim();
  return `## ${s.heading}\n\n${text}`;
});

const promoted = `---
title: "${title.replace(/"/g, '\\"')}"
namespace: "${namespaceId}"
type: "manual"
status: "consumed"
summary: "Promoted from ${sessionFolderName}/high-level.md on ${new Date().toISOString().slice(0, 10)}."
tags: []
prerequisites: []
---
# ${title}

${bodyParts.join("\n\n")}

---
## References
### Internal
- [[conversations/${sessionFolderName}/high-level]]
### External
`;

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, promoted, "utf8");

process.stdout.write(
  JSON.stringify(
    {
      ok: true,
      from: path.relative(repoRoot, conversationPath),
      to: path.relative(repoRoot, targetPath),
      sections: sections.length,
      next: "npm run sync",
    },
    null,
    2,
  ) + "\n",
);
