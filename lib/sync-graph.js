const CONSTRAINTS = [
  `CREATE CONSTRAINT namespace_id IF NOT EXISTS
   FOR (n:Namespace) REQUIRE n.id IS UNIQUE`,
  `CREATE CONSTRAINT document_path IF NOT EXISTS
   FOR (d:Document) REQUIRE d.path IS UNIQUE`,
  `CREATE CONSTRAINT resource_url IF NOT EXISTS
   FOR (r:Resource) REQUIRE r.url IS UNIQUE`,
  `CREATE CONSTRAINT intent_ns_query IF NOT EXISTS
   FOR (i:Intent) REQUIRE (i.query, i.namespaceId) IS UNIQUE`,
];

/**
 * @param {import('neo4j-driver').Session} session
 */
export async function ensureConstraints(session) {
  for (const cypher of CONSTRAINTS) {
    await session.run(cypher);
  }
}

/**
 * @param {import('neo4j-driver').Driver} driver
 * @param {import('./parse-catalog.js').ReturnType<typeof import('./parse-catalog.js').parseCatalog>} catalog
 */
export async function syncCatalogToGraph(driver, catalog) {
  const documentPaths = new Set(catalog.documents.map((d) => d.path));
  const dangling = [];

  for (const edge of catalog.referenceEdges) {
    if (!documentPaths.has(edge.toPath)) {
      dangling.push(edge.toPath);
    }
  }

  const session = driver.session();
  try {
    const summary = await session.executeWrite(async (tx) => {
    await tx.run(
      `MATCH (n) WHERE n:Namespace OR n:Document OR n:Intent OR n:Resource DETACH DELETE n`,
    );

    for (const ns of catalog.namespaces) {
      await tx.run(
        `MERGE (n:Namespace {id: $id})
         SET n.name = $name`,
        { id: ns.id, name: ns.name },
      );
      if (ns.parentId !== null) {
        await tx.run(
          `MATCH (child:Namespace {id: $childId}), (parent:Namespace {id: $parentId})
           MERGE (child)-[:CHILD_OF]->(parent)`,
          { childId: ns.id, parentId: ns.parentId },
        );
      }
    }

    for (const doc of catalog.documents) {
      await tx.run(
        `MATCH (ns:Namespace {id: $namespaceId})
         MERGE (d:Document {path: $path})
         SET d.title = $title,
             d.summary = $summary,
             d.status = $status,
             d.type = $type,
             d.tags = $tags,
             d.prerequisites = $prerequisites
         MERGE (d)-[:BELONGS_TO]->(ns)`,
        {
          namespaceId: doc.namespaceId,
          path: doc.path,
          title: doc.title,
          summary: doc.summary,
          status: doc.status,
          type: doc.type,
          tags: doc.tags,
          prerequisites: doc.prerequisites,
        },
      );
    }

    const stubPaths = new Set(dangling);
    for (const edge of catalog.referenceEdges) {
      if (stubPaths.has(edge.toPath)) {
        await tx.run(
          `MERGE (d:Document {path: $path})
           ON CREATE SET d.title = $path, d.status = 'missing'`,
          { path: edge.toPath },
        );
      }
      await tx.run(
        `MATCH (from:Document {path: $fromPath}), (to:Document {path: $toPath})
         MERGE (from)-[:REFERENCES]->(to)`,
        { fromPath: edge.fromPath, toPath: edge.toPath },
      );
    }

    for (const bundle of catalog.intentBundles) {
      await tx.run(
        `MATCH (ns:Namespace {id: $namespaceId})
         MERGE (i:Intent {query: $query, namespaceId: $namespaceId})
         MERGE (i)-[:BELONGS_TO]->(ns)`,
        {
          namespaceId: bundle.intent.namespaceId,
          query: bundle.intent.query,
        },
      );
      for (const resource of bundle.resources) {
        await tx.run(
          `MATCH (i:Intent {query: $query, namespaceId: $namespaceId})
           MERGE (r:Resource {url: $url})
           SET r.title = $title
           MERGE (r)-[:RECOMMENDED_FOR]->(i)`,
          {
            query: bundle.intent.query,
            namespaceId: bundle.intent.namespaceId,
            url: resource.url,
            title: resource.title,
          },
        );
      }
    }

    const counts = await tx.run(
      `RETURN
         count { (n:Namespace) } AS namespaces,
         count { (d:Document) } AS documents,
         count { (i:Intent) } AS intents,
         count { (r:Resource) } AS resources,
         count { ()-[:REFERENCES]->() } AS references`,
    );

    return counts.records[0];
    });

    return {
      namespaces: summary.get("namespaces").toNumber(),
      documents: summary.get("documents").toNumber(),
      intents: summary.get("intents").toNumber(),
      resources: summary.get("resources").toNumber(),
      references: summary.get("references").toNumber(),
      dangling: [...new Set(dangling)],
    };
  } finally {
    await session.close();
  }
}

/**
 * @param {import('neo4j-driver').Driver} driver
 */
export async function ensureConstraintsOnDriver(driver) {
  const session = driver.session();
  try {
    await ensureConstraints(session);
  } finally {
    await session.close();
  }
}
