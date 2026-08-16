/** In-process thread ids for the chat UI (lost on restart). */

import { initSessionFolder } from "./conversation-persist.js";

/** @type {Set<string>} */
const knownThreads = new Set();

/** @type {Map<string, { sessionSlug: string, sessionPath: string, turnNumber: number }>} */
const threadMeta = new Map();

export function registerThread(threadId, meta) {
  if (typeof threadId !== "string" || threadId.length === 0) {
    return threadId;
  }
  knownThreads.add(threadId);
  if (meta) {
    threadMeta.set(threadId, meta);
  }
  return threadId;
}

export function listThreads() {
  return [...knownThreads].map((id) => ({
    id,
    ...(threadMeta.get(id) ?? {}),
  }));
}

export function createThread() {
  const id = crypto.randomUUID();
  const meta = { turnNumber: 0 };
  knownThreads.add(id);
  threadMeta.set(id, meta);
  return { id };
}

/** Create docs/conversations/ folder on first user message in a thread. */
export async function ensureSessionForThread(threadId) {
  const meta = threadMeta.get(threadId);
  if (!meta) {
    return null;
  }
  if (meta.sessionSlug && meta.sessionPath) {
    return meta;
  }
  const session = await initSessionFolder();
  meta.sessionSlug = session.slug;
  meta.sessionPath = session.relativePath;
  threadMeta.set(threadId, meta);
  return meta;
}

export function getThreadMeta(threadId) {
  return threadMeta.get(threadId) ?? null;
}

export function nextTurnNumber(threadId) {
  const meta = threadMeta.get(threadId);
  if (!meta) {
    return null;
  }
  meta.turnNumber += 1;
  return meta.turnNumber;
}

export function clearThreadsForTests() {
  knownThreads.clear();
  threadMeta.clear();
}
