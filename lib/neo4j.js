import neo4j from "neo4j-driver";

const DEFAULTS = {
  uri: "bolt://localhost:7687",
  username: "neo4j",
  password: "password123",
  docsRoot: "docs",
};

export function getNeo4jConfig() {
  return {
    uri: process.env.NEO4J_URI ?? DEFAULTS.uri,
    username: process.env.NEO4J_USERNAME ?? DEFAULTS.username,
    password: process.env.NEO4J_PASSWORD ?? DEFAULTS.password,
  };
}

/**
 * @param {string} [repoRoot]
 */
export function getDocsRoot(repoRoot = process.cwd()) {
  const rel = process.env.DOCS_ROOT ?? DEFAULTS.docsRoot;
  return rel.startsWith("/") ? rel : `${repoRoot}/${rel}`;
}

export function createDriver(config = getNeo4jConfig()) {
  return neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password));
}

/**
 * @param {import('neo4j-driver').Driver} driver
 */
export async function verifyConnectivity(driver) {
  await driver.verifyConnectivity();
}
