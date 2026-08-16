import { embed } from "./embeddings.js";

const CONSTRAINTS = [
  `CREATE CONSTRAINT namespace_id IF NOT EXISTS
   FOR (n:Namespace) REQUIRE n.id IS UNIQUE`,
  `CREATE CONSTRAINT document_path IF NOT EXISTS
   FOR (d:Document) REQUIRE d.path IS UNIQUE`,
  `CREATE CONSTRAINT resource_url IF NOT EXISTS
   FOR (r:Resource) REQUIRE r.url IS UNIQUE`,
  `CREATE CONSTRAINT intent_ns_query IF NOT EXISTS
   FOR (i:Intent) REQUIRE (i.query, i.namespaceId) IS UNIQUE`,
  `CREATE CONSTRAINT section_doc_id IF NOT EXISTS
   FOR (s:Section) REQUIRE (s.documentPath, s.id) IS UNIQUE`,
];

export async function ensureConstraints(session) {
  for (const cypher of CONSTRAINTS) {
    await session.run(cypher);
  }
}

export async function syncCatalogToGraph(driver, catalog) {
  const documentPaths = new Set(catalog.documents.map((d) => d.path));
  const dangling = [];
  for (const edge of catalog.referenceEdges) {
    if (!documentPaths.has(edge.toPath)) {
      dangling.push(edge.toPath);
    }
  }

  const documentsWithEmbeddings = await Promise.all(
    catalog.documents.map(async (doc) => {
      const docEmbedding = await embed(doc.body || doc.summary || doc.title);
      const sections = await Promise.all(
        doc.sections.map(async (section) => ({
          ...section,
          embedding: await embed(section.body || section.heading),
        })),
      );
      return { ...doc, embedding: docEmbedding, sections };
    }),
  );

  const session = driver.session();
  try {
    const summary = await session.executeWrite(async (tx) => {
      await tx.run(
        `MATCH (n) WHERE n:Namespace OR n:Document OR n:Section OR n:Intent OR n:Resource DETACH DELETE n`,
      );

      for (const ns of catalog.namespaces) {
        await tx.run(
          `MERGE (n:Namespace {id: $id}) SET n.name = $name`,
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

      for (const doc of documentsWithEmbeddings) {
        await tx.run(
          `MATCH (ns:Namespace {id: $namespaceId})
           MERGE (d:Document {path: $path})
           SET d.title = $title, d.summary = $summary, d.status = $status,
               d.type = $type, d.tags = $tags, d.prerequisites = $prerequisites,
               d.body = $body, d.track_quiz = $trackQuiz, d.embedding = $embedding
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
            body: doc.body,
            trackQuiz: doc.trackQuiz,
            embedding: doc.embedding,
          },
        );
        for (const section of doc.sections) {
          await tx.run(
            `MATCH (d:Document {path: $documentPath})
             MERGE (s:Section {documentPath: $documentPath, id: $id})
             SET s.heading = $heading, s.body = $body,
                 s.quiz_confirmed = $quizConfirmed,
                 s.quiz_confirmed_at = $quizConfirmedAt,
                 s.embedding = $embedding
             MERGE (s)-[:SECTION_OF]->(d)`,
            {
              documentPath: doc.path,
              id: section.id,
              heading: section.heading,
              body: section.body,
              quizConfirmed: section.quiz_confirmed,
              quizConfirmedAt: section.quiz_confirmed_at,
              embedding: section.embedding,
            },
          );
        }
      }

      const stubPaths = new Set(dangling);
      for (const edge of catalog.referenceEdges) {
        if (stubPaths.has(edge.toPath)) {
          await tx.run(
            `MERGE (d:Document {path: $path}) ON CREATE SET d.title = $path, d.status = 'missing'`,
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
          { namespaceId: bundle.intent.namespaceId, query: bundle.intent.query },
        );
        for (const resource of bundle.resources) {
          await tx.run(
            `MATCH (i:Intent {query: $query, namespaceId: $namespaceId})
             MERGE (r:Resource {url: $url}) SET r.title = $title
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
        `RETURN count { (n:Namespace) } AS namespaces,
                count { (d:Document) } AS documents,
                count { (s:Section) } AS sections,
                count { (i:Intent) } AS intents,
                count { (r:Resource) } AS resources,
                count { ()-[:REFERENCES]->() } AS references`,
      );
      return counts.records[0];
    });

    return {
      namespaces: summary.get("namespaces").toNumber(),
      documents: summary.get("documents").toNumber(),
      sections: summary.get("sections").toNumber(),
      intents: summary.get("intents").toNumber(),
      resources: summary.get("resources").toNumber(),
      references: summary.get("references").toNumber(),
      dangling: [...new Set(dangling)],
    };
  } finally {
    await session.close();
  }
}

export async function ensureConstraintsOnDriver(driver) {
  const session = driver.session();
  try {
    await ensureConstraints(session);
  } finally {
    await session.close();
  }
}
