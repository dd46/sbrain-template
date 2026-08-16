#!/usr/bin/env node
/**
 * Second Brain KB persistence hooks.
 * sessionStart — reset session state, inject persist policy
 * track        — postToolUse: flag web research and docs/ writes
 * stop         — auto-follow-up when web was used but docs/ was not updated
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, "state");
const STATE_PATH = join(STATE_DIR, "kb-session.json");

const PERSIST_CONTEXT = [
  "Second Brain policy: session folder docs/conversations/YYYY-MM-DD-slug/ with high-level.md (plan+notes), history.md (Ty/Agent transcript), optional attachments/.",
  "Empty chat history → create NEW session folder. Ongoing chat → append only to that folder.",
  "Keep chat replies short — one topic at a time. Cite facts with [n] refs + Źródła legend (KB/web/model). Structured docs/ only when user asks or npm run kb:promote.",
  "Run npm run sync after structured docs/ edits (not for conversations/). Commit when done. Never push unless asked.",
  "See AGENTS.md and .cursor/rules/kb-persist.mdc.",
].join(" ");

function defaultState() {
  return {
    external_knowledge_used: false,
    conversations_written: false,
    structured_docs_written: false,
    sync_ran: false,
    committed: false,
  };
}

function readState() {
  try {
    return { ...defaultState(), ...JSON.parse(readFileSync(STATE_PATH, "utf8")) };
  } catch {
    return defaultState();
  }
}

function writeState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function readHookInput() {
  const text = readFileSync(0, "utf8");
  return text ? JSON.parse(text) : {};
}

function isDocsPath(path) {
  if (!path || typeof path !== "string") return false;
  const normalized = path.replace(/\\/g, "/");
  return (
    normalized.includes("/docs/") ||
    normalized.startsWith("docs/") ||
    normalized.endsWith("/docs")
  );
}

function isConversationsPath(path) {
  if (!path || typeof path !== "string") return false;
  const normalized = path.replace(/\\/g, "/");
  return (
    normalized.includes("/docs/conversations/") ||
    normalized.startsWith("docs/conversations/")
  );
}

function isStructuredDocsPath(path) {
  return isDocsPath(path) && !isConversationsPath(path);
}

function extractEditedPath(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== "object") return "";
  return toolInput.path ?? toolInput.file_path ?? toolInput.target_file ?? "";
}

function sessionStart() {
  writeState(defaultState());
  process.stdout.write(
    JSON.stringify({
      env: { SBRAIN_KB_PERSIST: "required" },
      additional_context: PERSIST_CONTEXT,
    }) + "\n",
  );
}

function track() {
  const input = readHookInput();
  const state = readState();
  const toolName = input.tool_name ?? "";

  if (toolName === "WebSearch" || toolName === "WebFetch") {
    state.external_knowledge_used = true;
  }

  if (toolName === "Write" || toolName === "StrReplace") {
    const path = extractEditedPath(toolName, input.tool_input);
    if (isConversationsPath(path)) {
      state.conversations_written = true;
    } else if (isStructuredDocsPath(path)) {
      state.structured_docs_written = true;
    }
  }

  if (toolName === "Shell") {
    const command = input.tool_input?.command ?? "";
    if (command.includes("npm run sync")) {
      state.sync_ran = true;
    }
    if (/\bgit commit\b/.test(command)) {
      state.committed = true;
    }
  }

  writeState(state);
  process.stdout.write("{}\n");
}

function stop() {
  const input = readHookInput();
  const state = readState();

  if (input.status !== "completed") {
    process.stdout.write("{}\n");
    return;
  }

  const missing = [];

  if (state.external_knowledge_used && !state.conversations_written) {
    missing.push("zapisz sesję do docs/conversations/");
  }

  if (state.structured_docs_written && !state.sync_ran) {
    missing.push("jeśli edytowałeś strukturalne docs/, uruchom npm run sync");
  }

  if (state.structured_docs_written && !state.committed) {
    missing.push("zrób git commit (bez push)");
  }

  if (missing.length === 0) {
    process.stdout.write("{}\n");
    return;
  }

  process.stdout.write(
    JSON.stringify({
      followup_message: `Nie dokończyłeś workflow KB: ${missing.join(", ")}. Zgodnie z AGENTS.md i kb-persist.mdc.`,
    }) + "\n",
  );
}

const command = process.argv[2];
switch (command) {
  case "sessionStart":
    sessionStart();
    break;
  case "track":
    track();
    break;
  case "stop":
    stop();
    break;
  default:
    console.error(`Unknown kb-hooks command: ${command}`);
    process.stdout.write("{}\n");
    process.exit(1);
}
