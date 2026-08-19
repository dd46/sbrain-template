import { loadRepoEnv } from "./load-repo-env.js";

export const CHAT_PROVIDER_IDS = /** @type {const} */ (["ollama", "deepseek_pro"]);

/** @typedef {(typeof CHAT_PROVIDER_IDS)[number]} ChatProviderId */

const OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1";
const TOKENROUTER_DEFAULT_BASE_URL = "https://api.tokenrouter.com/v1";
const TOKENROUTER_DEFAULT_MODEL = "deepseek-v4-pro";

/**
 * @param {string} value
 * @returns {boolean}
 */
function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @returns {ChatProviderId}
 */
export function getDefaultChatProviderId() {
  loadRepoEnv();
  const requested = process.env.CHAT_PROVIDER?.trim();
  if (requested && isChatProviderId(requested)) {
    return requested;
  }
  return "ollama";
}

/**
 * @param {unknown} value
 * @returns {value is ChatProviderId}
 */
export function isChatProviderId(value) {
  return CHAT_PROVIDER_IDS.includes(/** @type {ChatProviderId} */ (value));
}

/**
 * @param {unknown} value
 * @returns {ChatProviderId}
 */
export function resolveChatProviderId(value) {
  if (value == null || value === "") {
    return getDefaultChatProviderId();
  }
  if (!isChatProviderId(value)) {
    throw new Error(
      `Unknown chat provider: ${String(value)}. Use ${CHAT_PROVIDER_IDS.join(" or ")}.`,
    );
  }
  return value;
}

/**
 * @returns {{
 *   id: ChatProviderId,
 *   label: string,
 *   configured: boolean,
 * }[]}
 */
export function listChatProviders() {
  loadRepoEnv();
  return [
    {
      id: "ollama",
      label: "Ollama",
      configured: true,
    },
    {
      id: "deepseek_pro",
      label: "DeepSeek Pro",
      configured: hasValue(process.env.TOKENROUTER_API_KEY),
    },
  ];
}

/**
 * OpenAI-compatible ChatOpenAI constructor fields for a provider.
 *
 * @param {unknown} providerId
 * @returns {{
 *   apiKey: string,
 *   model: string,
 *   temperature: number,
 *   configuration: { baseURL: string },
 * }}
 */
export function resolveProviderConfig(providerId) {
  loadRepoEnv();
  const id = resolveChatProviderId(providerId);

  if (id === "deepseek_pro") {
    const apiKey = process.env.TOKENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "TOKENROUTER_API_KEY is required for DeepSeek Pro (copy .env.example to .env)",
      );
    }
    return {
      apiKey,
      model: process.env.TOKENROUTER_MODEL?.trim() || TOKENROUTER_DEFAULT_MODEL,
      temperature: 0.2,
      configuration: {
        baseURL: process.env.TOKENROUTER_BASE_URL?.trim() || TOKENROUTER_DEFAULT_BASE_URL,
      },
    };
  }

  const baseURL = process.env.OPENAI_BASE_URL?.trim() || OLLAMA_DEFAULT_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY?.trim() || "ollama";
  return {
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || "qwen3.6:35b-a3b",
    temperature: 0.2,
    configuration: { baseURL },
  };
}
