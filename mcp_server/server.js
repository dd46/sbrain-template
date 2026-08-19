#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createDriver } from "../lib/neo4j.js";
import {
  getDocumentGraph,
  getRecommendations,
  searchByNamespace,
  semanticSearch,
  textResult,
  triggerSync,
} from "../lib/kb-tools.js";

const driver = createDriver();

const server = new McpServer({
  name: "sbrain",
  version: "1.0.0",
});

server.registerTool(
  "search_by_namespace",
  {
    description:
      "Search documents in a namespace (and optionally descendant namespaces).",
    inputSchema: {
      namespace_id: z
        .string()
        .describe('Dotted namespace id; empty string is the docs/knowledge-base root'),
      query: z.string().describe("Substring to match in title, summary, or tags"),
      include_children: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include documents in child namespaces"),
    },
  },
  async ({ namespace_id, query, include_children }) => {
    const results = await searchByNamespace(driver, {
      namespace_id,
      query,
      include_children,
    });
    return textResult(results);
  },
);

server.registerTool(
  "get_document_graph",
  {
    description: "Return a document and its REFERENCES relationships as JSON.",
    inputSchema: {
      file_path: z
        .string()
        .describe("Path relative to docs/knowledge-base/, with or without .md"),
    },
  },
  async ({ file_path }) => {
    const graph = await getDocumentGraph(driver, { file_path });
    return textResult(graph);
  },
);

server.registerTool(
  "get_recommendations",
  {
    description:
      "List learning intents and recommended resources for a namespace.",
    inputSchema: {
      namespace_id: z
        .string()
        .describe("Exact namespace id; does not include child namespaces"),
    },
  },
  async ({ namespace_id }) => {
    const data = await getRecommendations(driver, { namespace_id });
    return textResult(data);
  },
);


server.registerTool(
  "semantic_search",
  {
    description:
      "Semantic (vector) search over document and section bodies in Neo4j.",
    inputSchema: {
      namespace_id: z
        .string()
        .describe('Dotted namespace id; empty string is the docs/knowledge-base root'),
      query: z.string().describe("Natural-language search query"),
      include_children: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include documents in child namespaces"),
      top_k: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe("Maximum results to return"),
    },
  },
  async ({ namespace_id, query, include_children, top_k }) => {
    const results = await semanticSearch(driver, {
      namespace_id,
      query,
      include_children,
      top_k,
    });
    return textResult(results);
  },
);

server.registerTool(
  "trigger_sync",
  {
    description: "Reload the docs/knowledge-base catalog into Neo4j from disk.",
    inputSchema: {},
  },
  async () => {
    const summary = await triggerSync();
    return textResult(summary);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", async () => {
  await driver.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await driver.close();
  process.exit(0);
});
