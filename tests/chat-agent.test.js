import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import {
  buildChatGraph,
  invokeChat,
  requireThreadConfig,
  resetChatAgentForTests,
} from "../lib/chat-agent.js";
import { clearThreadsForTests } from "../lib/thread-registry.js";

class ScriptFakeChatModel extends BaseChatModel {
  constructor(steps) {
    super({});
    this.steps = steps;
    this.callIndex = 0;
  }

  _llmType() {
    return "script-fake";
  }

  _combineLLMOutput() {
    return [];
  }

  bindTools() {
    return this;
  }

  async _generate(messages) {
    const step = this.steps[this.callIndex];
    this.callIndex += 1;
    const message =
      typeof step === "function" ? await step(messages) : step;
    const text =
      typeof message.content === "string" ? message.content : "";
    return {
      generations: [{ message, text }],
      llmOutput: {},
    };
  }
}

function createFakeModel(steps) {
  return new ScriptFakeChatModel(steps);
}

test.afterEach(() => {
  resetChatAgentForTests();
  clearThreadsForTests();
});

test("requireThreadConfig rejects missing thread_id", () => {
  assert.throws(() => requireThreadConfig(""), /thread_id is required/);
  assert.throws(() => requireThreadConfig(undefined), /thread_id is required/);
});

test("same thread_id recalls prior user message from MemorySaver", async () => {
  const checkpointer = new MemorySaver();
  const graph = buildChatGraph({
    checkpointer,
    llm: createFakeModel([
      new AIMessage("first reply"),
      (messages) => {
        const text = messages
          .filter((m) => HumanMessage.isInstance(m))
          .map((m) => m.content)
          .join("\n");
        assert.match(text, /remember this codeword: alpaca/);
        return new AIMessage("I remember alpaca");
      },
    ]),
    deps: {
      driver: /** @type {any} */ ({}),
      kb: {
        searchByNamespace: async () => [],
        semanticSearch: async () => ({ results: [] }),
        getDocumentGraph: async () => ({ found: false }),
        getRecommendations: async () => ({ intents: [] }),
        triggerSync: async () => ({ ok: true }),
      },
      docsFs: {
        listDocsDir: async () => [],
        readDocsFile: async () => "",
        writeDocsFile: async () => ({ path: "x" }),
      },
    },
  });

  await invokeChat([new HumanMessage("remember this codeword: alpaca")], "thread-a", graph);
  const second = await invokeChat(
    [new HumanMessage("what codeword did I give?")],
    "thread-a",
    graph,
  );
  const last = second.messages.at(-1);
  assert.ok(AIMessage.isInstance(last));
  assert.match(String(last.content), /remember alpaca/i);
});

test("different thread_id does not see another thread's memory", async () => {
  const checkpointer = new MemorySaver();
  const graph = buildChatGraph({
    checkpointer,
    llm: createFakeModel([
      new AIMessage("ok"),
      (messages) => {
        const text = messages
          .filter((m) => HumanMessage.isInstance(m))
          .map((m) => m.content)
          .join("\n");
        assert.doesNotMatch(text, /secret-thread-token/);
        return new AIMessage("no prior secret");
      },
    ]),
    deps: {
      driver: /** @type {any} */ ({}),
      kb: {
        searchByNamespace: async () => [],
        semanticSearch: async () => ({ results: [] }),
        getDocumentGraph: async () => ({ found: false }),
        getRecommendations: async () => ({ intents: [] }),
        triggerSync: async () => ({ ok: true }),
      },
      docsFs: {
        listDocsDir: async () => [],
        readDocsFile: async () => "",
        writeDocsFile: async () => ({ path: "x" }),
      },
    },
  });

  await invokeChat([new HumanMessage("secret-thread-token")], "thread-one", graph);
  const result = await invokeChat(
    [new HumanMessage("repeat my secret")],
    "thread-two",
    graph,
  );
  const last = result.messages.at(-1);
  assert.ok(AIMessage.isInstance(last));
  assert.match(String(last.content), /no prior secret/i);
});

test("KB search tool is invoked when model requests it", async () => {
  let searchCalled = false;
  const checkpointer = new MemorySaver();
  const graph = buildChatGraph({
    checkpointer,
    llm: createFakeModel([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call-1",
            name: "search_by_namespace",
            args: { namespace_id: "sailing.licenses_certificates", query: "SM" },
          },
        ],
      }),
      new AIMessage("found syllabus"),
    ]),
    deps: {
      driver: /** @type {any} */ ({}),
      kb: {
        searchByNamespace: async (args) => {
          searchCalled = true;
          assert.equal(args.namespace_id, "sailing.licenses_certificates");
          assert.equal(args.query, "SM");
          return [{ title: "SM Exam", path: "sailing/licenses_certificates/sm_exam_syllabus" }];
        },
        semanticSearch: async () => ({ results: [] }),
        getDocumentGraph: async () => ({ found: false }),
        getRecommendations: async () => ({ intents: [] }),
        triggerSync: async () => ({ ok: true }),
      },
      docsFs: {
        listDocsDir: async () => [],
        readDocsFile: async () => "",
        writeDocsFile: async () => ({ path: "x" }),
      },
    },
  });

  await invokeChat([new HumanMessage("find SM syllabus")], "tool-thread", graph);
  assert.equal(searchCalled, true);
});
