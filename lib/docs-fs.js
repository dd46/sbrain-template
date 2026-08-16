import fs from "node:fs/promises";
import path from "node:path";
import { getDocsRoot } from "./neo4j.js";

/**
 * Resolve a docs-relative path without touching the filesystem.
 * @param {string} relativePath
 * @param {string} docsRoot
 */
export function resolveDocsPath(relativePath, docsRoot = getDocsRoot()) {
  const root = path.resolve(docsRoot);
  const trimmed = String(relativePath ?? "").replace(/^\/+/, "");
  if (!trimmed || trimmed.includes("\0")) {
    throw new Error("Invalid path");
  }
  const resolved = path.resolve(root, trimmed);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path outside docs root");
  }
  return resolved;
}

/**
 * Ensure target path (existing or not) stays under docsRoot after realpath.
 * @param {string} targetPath absolute path
 * @param {string} docsRoot
 */
export async function assertWithinDocsRoot(targetPath, docsRoot = getDocsRoot()) {
  const rootReal = await fs.realpath(path.resolve(docsRoot));
  let checkPath = path.resolve(targetPath);

  while (true) {
    try {
      const real = await fs.realpath(checkPath);
      if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) {
        throw new Error("Path outside docs root");
      }
      return targetPath;
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT") {
        throw err;
      }
      const parent = path.dirname(checkPath);
      if (parent === checkPath) {
        throw new Error("Path outside docs root");
      }
      checkPath = parent;
    }
  }
}

export async function listDocsDir(relativePath = "", docsRoot = getDocsRoot()) {
  const dir = resolveDocsPath(relativePath || ".", docsRoot);
  await assertWithinDocsRoot(dir, docsRoot);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? "directory" : "file",
    path: path.posix.join(relativePath.replace(/\\/g, "/"), entry.name).replace(/^\.\//, ""),
  }));
}

export async function readDocsFile(relativePath, docsRoot = getDocsRoot()) {
  const filePath = resolveDocsPath(relativePath, docsRoot);
  await assertWithinDocsRoot(filePath, docsRoot);
  return fs.readFile(filePath, "utf8");
}

export async function writeDocsFile(relativePath, content, docsRoot = getDocsRoot()) {
  const filePath = resolveDocsPath(relativePath, docsRoot);
  await assertWithinDocsRoot(filePath, docsRoot);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  return { path: relativePath.replace(/\\/g, "/") };
}
