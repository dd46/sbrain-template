import path from "node:path";
import { fileURLToPath } from "node:url";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { createDriver } from "./neo4j.js";
import {
  getDocumentGraph,
  getRecommendations,
  searchByNamespace,
  semanticSearch,
  triggerSync,
} from "./kb-tools.js";
import {
  listDocsDir,
  readDocsFile,
  writeDocsFile,
} from "./docs-fs.js";
import { loadRepoEnv } from "./load-repo-env.js";
import { buildSessionSystemMessage } from "./conversation-persist.js";
import { SystemMessage } from "@langchain/core/messages";

loadRepoEnv();

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SYSTEM_PROMPT =
  "You are a Second Brain learning assistant for Polish sailing license (SM) and related topics. " +
  "Use KB search tools for factual answers from the user's notes in Neo4j. " +
  "Use docs file tools to read or write markdown under docs/. " +
  "Files under docs/conversations/ are session notes and are not synced to Neo4j. " +
  "After editing structured notes elsewhere under docs/, call trigger_sync so the graph stays current. " +
  "Reply in Polish unless the user writes in another language. " +
  "Learning answers: numbered citation markers [1][2] on facts; footer ### Źródła table with columns # | Typ | Pewność | Źródło; " +
  "Typ is KB (wiki-link), web (URL), or model; Pewność is High/Medium/Low (citation fidelity). " +
  "One topic per message. End learning turns with a short numbered quiz (no refs in quiz). " +
  "Maintain the active session high-level.md (plan checkboxes + one ## section per topic).";

/** @type {import('@langchain/langgraph-checkpoint').MemorySaver | null} */
let checkpointerSingleton = null;

/** @type {ReturnType<typeof createReactAgent> | null} */
let graphSingleton = null;

/** @type {import('neo4j-driver').Driver | null} */
let driverSingleton = null;

function getDriver() {
  if (!driverSingleton) {
    driverSingleton = createDriver();
  }
  return driverSingleton;
}

export function getCheckpointer() {
  if (!checkpointerSingleton) {
    checkpointerSingleton = new MemorySaver();
  }
  return checkpointerSingleton;
}

export function resetChatAgentForTests() {
  graphSingleton = null;
  checkpointerSingleton = null;
  if (driverSingleton) {
    driverSingleton.close().catch(() => {});
    driverSingleton = null;
  }
}

function getDefaultModel() {
  loadRepoEnv();
  const baseURL = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY ?? (baseURL ? "ollama" : undefined);
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required for chat (copy .env.example to .env, or set OPENAI_BASE_URL for Ollama)",
    );
  }
  const config = {
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
  };
  if (baseURL) {
    config.configuration = { baseURL };
  }
  return new ChatOpenAI(config);
}

/**
 * @param {{
 *   driver?: import('neo4j-driver').Driver,
 *   docsRoot?: string,
 *   kb?: Partial<typeof defaultKb>,
 *   docsFs?: Partial<typeof defaultDocsFs>,
 * }} [deps]
 */
function buildTools(deps = {}) {
  const driver = deps.driver ?? getDriver();
  const docsRoot = deps.docsRoot ?? path.join(repoRoot, process.env.DOCS_ROOT ?? "docs");
  const kb = { ...defaultKb(driver), ...deps.kb };
  const docsFs = { ...defaultDocsFs(docsRoot), ...deps.docsFs };

  return [
    tool(
      async ({ namespace_id, query, include_children }) =>
        JSON.stringify(
          await kb.searchByNamespace({
            namespace_id,
            query,
            include_children: include_children ?? true,
          }),
        ),
      {
        name: "search_by_namespace",
        description: "Substring search in Neo4j KB by namespace.",
        schema: z.object({
          namespace_id: z.string().describe('Dotted namespace; "" is docs root'),
          query: z.string(),
          include_children: z.boolean().optional(),
        }),
      },
    ),
    tool(
      async ({ namespace_id, query, include_children, top_k }) =>
        JSON.stringify(
          await kb.semanticSearch({
            namespace_id,
            query,
            include_children: include_children ?? true,
            top_k: top_k ?? 5,
          }),
        ),
      {
        name: "semantic_search",
        description: "Vector semantic search over KB documents and sections.",
        schema: z.object({
          namespace_id: z.string(),
          query: z.string(),
          include_children: z.boolean().optional(),
          top_k: z.number().int().min(1).max(20).optional(),
        }),
      },
    ),
    tool(
      async ({ file_path }) => JSON.stringify(await kb.getDocumentGraph({ file_path })),
      {
        name: "get_document_graph",
        description: "Document metadata, sections, and wiki-link graph from Neo4j.",
        schema: z.object({
          file_path: z.string().describe("Path relative to docs/, no .md suffix"),
        }),
      },
    ),
    tool(
      async ({ namespace_id }) =>
        JSON.stringify(await kb.getRecommendations({ namespace_id })),
      {
        name: "get_recommendations",
        description: "Learning intents and resources for a namespace.",
        schema: z.object({ namespace_id: z.string() }),
      },
    ),
    tool(
      async () => JSON.stringify(await kb.triggerSync()),
      {
        name: "trigger_sync",
        description: "Reload structured docs/ catalog into Neo4j after note edits.",
        schema: z.object({}),
      },
    ),
    tool(
      async ({ relative_path }) =>
        JSON.stringify(await docsFs.listDocsDir(relative_path ?? "")),
      {
        name: "list_docs",
        description: "List files and folders under docs/.",
        schema: z.object({
          relative_path: z.string().optional().describe('Subpath under docs/, e.g. "sailing"'),
        }),
      },
    ),
    tool(
      async ({ relative_path }) => docsFs.readDocsFile(relative_path),
      {
        name: "read_docs_file",
        description: "Read a utf-8 text file under docs/.",
        schema: z.object({ relative_path: z.string() }),
      },
    ),
    tool(
      async ({ relative_path, content }) =>
        JSON.stringify(await docsFs.writeDocsFile(relative_path, content)),
      {
        name: "write_docs_file",
        description: "Write utf-8 text under docs/. Creates parent folders.",
        schema: z.object({
          relative_path: z.string(),
          content: z.string(),
        }),
      },
    ),
  ];
}

function defaultKb(driver) {
  return {
    searchByNamespace: (args) => searchByNamespace(driver, args),
    semanticSearch: (args) => semanticSearch(driver, args),
    getDocumentGraph: (args) => getDocumentGraph(driver, args),
    getRecommendations: (args) => getRecommendations(driver, args),
    triggerSync,
  };
}

function defaultDocsFs(docsRoot) {
  return {
    listDocsDir: (relativePath) => listDocsDir(relativePath, docsRoot),
    readDocsFile: (relativePath) => readDocsFile(relativePath, docsRoot),
    writeDocsFile: (relativePath, content) =>
      writeDocsFile(relativePath, content, docsRoot),
  };
}

/**
 * @param {{
 *   llm?: import('@langchain/core/language_models/chat_models').BaseChatModel | import('@langchain/core/runnables').Runnable,
 *   checkpointer?: import('@langchain/langgraph-checkpoint').MemorySaver,
 *   deps?: Parameters<typeof buildTools>[0],
 * }} [options]
 */
export function buildChatGraph(options = {}) {
  const llm = options.llm ?? getDefaultModel();
  const checkpointer = options.checkpointer ?? getCheckpointer();
  const tools = buildTools(options.deps);

  return createReactAgent({
    llm,
    tools,
    prompt: SYSTEM_PROMPT,
    checkpointer,
  });
}

export function getChatGraph(options = {}) {
  if (options.llm || options.checkpointer || options.deps) {
    return buildChatGraph(options);
  }
  if (!graphSingleton) {
    graphSingleton = buildChatGraph();
  }
  return graphSingleton;
}

export function requireThreadConfig(threadId) {
  if (!threadId || typeof threadId !== "string") {
    throw new Error("thread_id is required");
  }
  return { configurable: { thread_id: threadId } };
}

/**
 * @param {import('@langchain/core/messages').BaseMessageLike[]} messages
 * @param {string} threadId
 * @param {ReturnType<typeof getChatGraph>} [graph]
 */
export async function invokeChat(messages, threadId, graph = getChatGraph()) {
  const config = requireThreadConfig(threadId);
  return graph.invoke({ messages }, config);
}

/**
 * @param {import('@langchain/core/messages').BaseMessageLike[]} messages
 * @param {string} threadId
 * @param {ReturnType<typeof getChatGraph>} [graph]
 * @param {{ sessionPath?: string }} [options]
 */
export async function streamChat(messages, threadId, graph = getChatGraph(), options = {}) {
  const config = requireThreadConfig(threadId);
  const inputMessages = options.sessionPath
    ? [new SystemMessage(buildSessionSystemMessage(options.sessionPath)), ...messages]
    : messages;
  return graph.stream(
    { messages: inputMessages },
    { ...config, streamMode: ["values", "messages"] },
  );
}

export async function closeChatAgent() {
  if (driverSingleton) {
    await driverSingleton.close();
    driverSingleton = null;
  }
}
