import { pipeline } from "@xenova/transformers";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const DIMENSIONS = 384;

/** @type {Promise<import('@xenova/transformers').FeatureExtractionPipeline> | null} */
let extractorPromise = null;

/**
 * Lazy-load the local embedding model (first call downloads ~30MB).
 * @returns {Promise<import('@xenova/transformers').FeatureExtractionPipeline>}
 */
export async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_ID);
  }
  return extractorPromise;
}

export function getEmbeddingDimensions() {
  return DIMENSIONS;
}

/**
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  const normalized = text?.trim() || "";
  const extractor = await getExtractor();
  const output = await extractor(normalized, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedMany(texts) {
  const results = [];
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}
