Ready-to-copy full specification for Cursor:

# Project Specification: Second Brain (GraphRAG + MCP)

## 1. Project Goal
Build a local Second Brain system based on Markdown files, a Neo4j graph database, and the MCP protocol. The system should work from the Cursor editor and allow knowledge management in hierarchical, isolated spaces (namespaces/folders). The entire operational backend (scripts, MCP server) will be written in Node.js (JavaScript).

## 2. Directory Structure
Cursor should generate the following file structure at the start. Knowledge spaces (namespaces) are hierarchical (folders within folders). Namespace ids equal the dotted folder path under `docs/` (for example `sailing/basics/` → `sailing.basics`).

`docs/` is the root namespace. Its id is the empty string (`namespace: ""`). Notes and `recommendations.md` that sit directly in `docs/` use that id. A parser must treat `""` as a real Namespace node, not as missing.

`recommendations.md` is optional at every level (`may`, not `must`). The sample tree includes one at each level only to demonstrate the format.

```text
/
├── docs/                             # Main knowledge base (root namespace, id: "")
│   ├── recommendations.md            # Recommendations for the root level
│   ├── sailing/                      # Main Namespace (id: "sailing")
│   │   ├── recommendations.md        # Recommendations for "sailing"
│   │   ├── basics/                   # Sub-namespace (id: "sailing.basics")
│   │   │   ├── recommendations.md    # Recommendations for "sailing.basics"
│   │   │   └── wind.md
│   │   └── licenses_certificates/    # Sub-namespace (id: "sailing.licenses_certificates")
│   │       ├── recommendations.md
│   │       └── sailing_certificate.md
├── scripts/                          # Utility scripts and orchestration
│   └── sync_to_neo4j.js              # Script (Node.js) loading from .md into Neo4j
├── mcp_server/                       # MCP server for communication with Cursor
│   ├── Dockerfile
│   └── server.js                     # MCP server in Node.js
├── package.json                      # Project definition and dependencies
└── docker-compose.yml                # Infrastructure (Neo4j + MCP)
```

## 3. Markdown File Specification (.md)

### A. Regular Notes (e.g. wind.md)
YAML frontmatter at the very top of the file.

Main content.

References section at the very bottom.

`namespace: ""` is valid only for notes that sit directly in `docs/`. Nested notes use a dotted id matching their folder path.

Internal wiki-links are paths relative to `docs/`, with forward slashes and no `.md` suffix (for example `[[sailing/basics/wind]]`).

```markdown
---
title: "Note Title"
namespace: "parent.child"
type: "concept | resource | person | manual"
status: "draft | consumed | mastered"
summary: "1-2 sentence summary."
tags: ["tag1", "tag2"]
prerequisites: ["Requirement 1"]
---
# Actual content...
---
## References
### Internal
- [[sailing/basics/wind]]
### External
- [Source title](https://link.com)
```

### B. Recommendations File (recommendations.md)
Used to collect materials to learn. First-level headings (`#`) define the intent/topic (semantically, what the user wanted to explore), and the lists beneath them are links (URIs).

```markdown
---
type: "recommendations"
namespace: "parent.child" # e.g. "sailing.basics"; use namespace: "" at docs/ root
---
# I want to understand sail aerodynamics
- [How a sail works - video](https://youtube.com/watch?v=...)
- [Physics of sailing - PDF article](file:///path/to/pdf.pdf)

# I want to listen to the history of racing
- [Podcast about the America's Cup](spotify:show:...)
```

## 4. Sync Script
File: `/scripts/sync_to_neo4j.js`
This script (using `gray-matter` to read YAML and `neo4j-driver` for the database) should:

Recursively walk the `/docs/` directory.

Build Namespace nodes and relationships in Neo4j:

`(:Namespace {id, name})`

`[:CHILD_OF]` relationships for the hierarchy (e.g. `sailing.basics` -> `sailing`).

For regular notes:

Create `(:Document {title, path, summary, status})`.

Create a `[:BELONGS_TO]` relationship to the Namespace.

Parse references and create `[:REFERENCES]` relationships.

For `recommendations.md` files:

Detect them via frontmatter `type: "recommendations"`.

Parse the file extracting pairs: Heading (Intent) -> List of links.

Create Neo4j nodes representing an educational intent: `(:Intent {query: "I want to understand..."})-[:BELONGS_TO]->(:Namespace)`.

From the links, create `(:Resource {url: "...", title: "..."})` nodes and connect them: `(:Resource)-[:RECOMMENDED_FOR]->(:Intent)`.

## 5. Docker Compose Architecture
The `docker-compose.yml` file should run 2 services:

**neo4j:**

Image: `neo4j:5.12.0`

Ports: `7474:7474` (UI), `7687:7687` (Bolt)

Variables: `NEO4J_AUTH=neo4j/password123`

APOC support enabled.

**mcp-server:**

Built from the `./mcp_server` folder. Base image `node:20` or higher.

Environment variables with access to Neo4j (`neo4j:7687`).

Exposes MCP tools via STDIO.

**Runtime note:** Cursor launches the MCP server on the host (`node mcp_server/server.js`) over STDIO. `docker-compose.yml` in this repo runs **Neo4j only**; the `mcp_server/Dockerfile` is kept for optional containerized runs, not as a long-running compose service.

## 6. MCP Integration (Model Context Protocol)
The MCP server (`server.js`) should be written in Node.js (with `@modelcontextprotocol/sdk`) and expose the following tools:

`search_by_namespace(namespace_id: string, query: string, include_children: boolean = true)` - searches Neo4j.

`get_document_graph(file_path: string)` - returns JSON with the document's relationships.

`trigger_sync()` - runs the sync script.

NEW: `get_recommendations(namespace_id: string)` - fetches from Neo4j a list of intents and their assigned resources (links) for the given namespace.

## 7. Startup Instructions for Cursor (First Deployment)
Initialize a Node.js project (`npm init -y`) and install packages (`npm install neo4j-driver @modelcontextprotocol/sdk gray-matter zod`).

Create the file structure. The sample may include `recommendations.md` at each level to demonstrate the optional format.

Write the contents of `docker-compose.yml` and the MCP server (`server.js`).

Create a sample `wind.md` document and `recommendations.md` in the `docs/sailing/basics/` folder.

Write the `sync_to_neo4j.js` script, making sure it correctly processes both regular documents and recommendation files, creating `(:Intent)` and `(:Resource)` nodes.
