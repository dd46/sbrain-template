#!/usr/bin/env node
/**
 * Promote learning sections from a conversation session into a structured KB note.
 * Does not update sync.md — use explicit "synchronizuj" in chat for that.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { fileURLToPath } from "node:url";
import { getKbRoot } from "../lib/neo4j.js";
import { slugifyHeading } from "../lib/parse-catalog.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kbRoot = getKbRoot(repoRoot);

const SKIP_HEADING = /^(Plan sesji|Format folderu|Quiz\b)/i;

function shouldPromoteSection(heading) {
  return !SKIP_HEADING.test(heading.trim());
}

const [conversationArg, targetArg] = process.argv.slice(2);

if (!conversationArg || !targetArg) {
  process.stderr.write(
    "Usage: kb_promote.js <docs/conversations/session-or-high-level.md> <target/path/without-md>\n",
    "Target is relative to docs/knowledge-base/ (e.g. sailing/licenses_certificates/note).\n",
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

const targetRel = targetArg
  .replace(/\.md$/, "")
  .replace(/^docs\/knowledge-base\//, "")
  .replace(/^knowledge-base\//, "")
  .replace(/^docs\//, "");
const targetPath = path.join(kbRoot, `${targetRel}.md`);
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

const learningSections = sections.filter((s) => shouldPromoteSection(s.heading));

if (learningSections.length === 0) {
  process.stderr.write("No promotable ## sections found (skipped Plan/Quiz/meta sections)\n");
  process.exit(1);
}

const title =
  typeof fm.title === "string" && fm.title.trim()
    ? fm.title.trim()
    : learningSections[0].heading;

const bodyParts = learningSections.map((s) => {
  const text = s.body.join("\n").trim();
  return `## ${s.heading}\n\n${text}`;
});

const sectionMeta = learningSections.map((s) => ({
  id: slugifyHeading(s.heading),
  heading: s.heading,
  quiz_confirmed: false,
  quiz_confirmed_at: null,
}));

const sectionsYaml = sectionMeta
  .map(
    (s) =>
      `  - id: ${s.id}\n    heading: "${s.heading.replace(/"/g, '\\"')}"\n    quiz_confirmed: false\n    quiz_confirmed_at: null`,
  )
  .join("\n");

const promoted = `---
title: "${title.replace(/"/g, '\\"')}"
namespace: "${namespaceId}"
type: "manual"
status: "consumed"
summary: "Promoted from ${sessionFolderName}/high-level.md on ${new Date().toISOString().slice(0, 10)}."
tags: []
prerequisites: []
track_quiz: true
sections:
${sectionsYaml}
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
      sections: learningSections.length,
      track_quiz: true,
      next: "Say synchronizuj in chat to update sync.md and run npm run sync",
    },
    null,
    2,
  ) + "\n",
);
