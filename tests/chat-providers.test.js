import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRepoEnv } from "../lib/load-repo-env.js";
import {
  getDefaultChatProviderId,
  listChatProviders,
  resolveChatProviderId,
  resolveProviderConfig,
} from "../lib/chat-providers.js";

const ENV_KEYS = [
  "CHAT_PROVIDER",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "TOKENROUTER_API_KEY",
  "TOKENROUTER_BASE_URL",
  "TOKENROUTER_MODEL",
];

/** @type {Map<string, string | undefined>} */
const saved = new Map();

function snapshotEnv() {
  saved.clear();
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test.beforeEach(() => {
  loadRepoEnv();
  snapshotEnv();
});
test.afterEach(restoreEnv);

test("default provider is ollama", () => {
  assert.equal(getDefaultChatProviderId(), "ollama");
  assert.equal(resolveChatProviderId(undefined), "ollama");
  assert.equal(resolveChatProviderId(""), "ollama");
});

test("CHAT_PROVIDER overrides the default", () => {
  process.env.CHAT_PROVIDER = "deepseek_pro";
  assert.equal(getDefaultChatProviderId(), "deepseek_pro");
});

test("unknown provider is rejected", () => {
  assert.throws(() => resolveChatProviderId("claude"), /Unknown chat provider/);
});

test("ollama uses OPENAI_* with local defaults", () => {
  const config = resolveProviderConfig("ollama");
  assert.equal(config.apiKey, "ollama");
  assert.equal(config.model, "qwen3.6:35b-a3b");
  assert.equal(config.configuration.baseURL, "http://127.0.0.1:11434/v1");
});

test("ollama honors OPENAI env overrides", () => {
  process.env.OPENAI_API_KEY = "local-key";
  process.env.OPENAI_BASE_URL = "http://127.0.0.1:11434/v1";
  process.env.OPENAI_MODEL = "llama3";
  const config = resolveProviderConfig("ollama");
  assert.equal(config.apiKey, "local-key");
  assert.equal(config.model, "llama3");
});

test("deepseek_pro requires TOKENROUTER_API_KEY", () => {
  assert.throws(() => resolveProviderConfig("deepseek_pro"), /TOKENROUTER_API_KEY/);
});

test("deepseek_pro uses TokenRouter defaults", () => {
  process.env.TOKENROUTER_API_KEY = "tr-test";
  const config = resolveProviderConfig("deepseek_pro");
  assert.equal(config.apiKey, "tr-test");
  assert.equal(config.model, "deepseek-v4-pro");
  assert.equal(config.configuration.baseURL, "https://api.tokenrouter.com/v1");
});

test("deepseek_pro honors TOKENROUTER env overrides", () => {
  process.env.TOKENROUTER_API_KEY = "tr-test";
  process.env.TOKENROUTER_BASE_URL = "https://api.tokenrouter.com/v1";
  process.env.TOKENROUTER_MODEL = "deepseek-v4-flash";
  const config = resolveProviderConfig("deepseek_pro");
  assert.equal(config.model, "deepseek-v4-flash");
});

test("listChatProviders marks DeepSeek when the token is set", () => {
  const withoutKey = listChatProviders();
  assert.equal(
    withoutKey.find((p) => p.id === "deepseek_pro")?.configured,
    false,
  );

  process.env.TOKENROUTER_API_KEY = "tr-test";
  const withKey = listChatProviders();
  assert.equal(withKey.find((p) => p.id === "deepseek_pro")?.configured, true);
  assert.equal(withKey.find((p) => p.id === "ollama")?.configured, true);
});
