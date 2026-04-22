# GitNexus Guide for MySmartStudy

GitNexus is a local code intelligence tool that builds a **knowledge graph** of your codebase — mapping functions, classes, imports, call chains, and execution flows. It lets you query, explore, and visualize how your code connects.

## Index Stats

After running `analyze` on MySmartStudy:

| Metric   | Value |
|----------|-------|
| Nodes    | 3,577 |
| Edges    | 7,641 |
| Clusters | 316   |
| Flows    | 154   |

---

## Quick Start

### 1. Analyze the Repository

```bash
cd MySmartStudy
npx gitnexus analyze --skip-git
```

> Use `--skip-git` because this project directory is not a git repository. If it were, just run `npx gitnexus analyze`.

This scans all source files, builds the knowledge graph, and stores it in `.gitnexus/`.

### 2. Check Index Status

```bash
npx gitnexus status
```

### 3. List All Indexed Repos

```bash
npx gitnexus list
```

---

## Querying the Knowledge Graph

### Search for Execution Flows

Find how a concept flows through the codebase:

```bash
npx gitnexus query "authentication flow"
npx gitnexus query "gradebook" --limit 5
npx gitnexus query "mind map editor" --content   # includes source code
```

Options:
- `--limit <n>` — Max processes to return (default: 5)
- `--content` — Include full symbol source code in output
- `--context <text>` — Add task context to improve ranking
- `--goal <text>` — Describe what you want to find

### Get 360-Degree View of a Symbol

See everything about a function/class — who calls it, what it calls, which processes it belongs to:

```bash
npx gitnexus context "get_current_user"
npx gitnexus context "useMapPersistence"
npx gitnexus context "AuthProvider" --content
```

Options:
- `--file <path>` — Disambiguate if multiple symbols share the same name
- `--uid <uid>` — Direct symbol UID for zero-ambiguity lookup
- `--content` — Include full source code

### Blast Radius / Impact Analysis

See what breaks if you change a symbol:

```bash
npx gitnexus impact "get_current_user"
npx gitnexus impact "mapsApi" --direction downstream
npx gitnexus impact "AuthProvider" --depth 5
```

Options:
- `--direction <dir>` — `upstream` (what depends on it) or `downstream` (what it depends on). Default: `upstream`
- `--depth <n>` — Max relationship depth (default: 3)
- `--include-tests` — Include test files in results

### Raw Cypher Queries

Run custom queries directly against the graph database:

```bash
# Find all exported functions
npx gitnexus cypher "MATCH (n:Function) WHERE n.exported = true RETURN n.name, n.filePath LIMIT 20"

# Find all files in a directory
npx gitnexus cypher "MATCH (n:File) WHERE n.filePath STARTS WITH 'backend/app/routers/' RETURN n.name"

# Find call relationships
npx gitnexus cypher "MATCH (a)-[:CALLS]->(b) RETURN a.name, b.name LIMIT 20"
```

---

## Viewing the Knowledge Graph (Web UI)

GitNexus includes a local web server that connects to a visual graph explorer.

### Start the Server

```bash
npx gitnexus serve
```

This starts a local HTTP server at **http://127.0.0.1:4747** by default.

Options:
- `--port <port>` — Change port (default: 4747)
- `--host <host>` — Bind address (use `0.0.0.0` for remote access)

### Access the Visual Explorer

Once the server is running, open your browser and go to:

```
https://gitnexus.dev
```

The web UI at gitnexus.dev connects to your **local** server on port 4747. Your code never leaves your machine — the UI fetches data from `localhost:4747`.

In the web UI you can:
- Browse the full knowledge graph visually
- Click on nodes to see symbol details
- Explore clusters and execution flows
- Search for symbols and trace call chains
- View module boundaries and cross-module dependencies

---

## Generate a Wiki

Auto-generate documentation from the knowledge graph (requires an LLM API key):

```bash
npx gitnexus wiki --api-key <YOUR_OPENAI_KEY>
npx gitnexus wiki --provider openai --model gpt-4o
npx gitnexus wiki --gist   # publish as GitHub Gist
```

---

## MCP Integration (Claude Code / Cursor)

Set up GitNexus as an MCP server so your AI coding assistant can query the knowledge graph automatically:

```bash
npx gitnexus setup
```

This configures MCP for Claude Code, Cursor, OpenCode, or Codex. Once set up, your assistant can use GitNexus tools (query, context, impact) directly during conversations.

### Start the MCP Server Manually

```bash
npx gitnexus mcp
```

---

## Useful Examples for MySmartStudy

```bash
# How does the authentication system work?
npx gitnexus query "JWT authentication" --content

# What calls the gradebook API?
npx gitnexus context "gradebookApi"

# What breaks if I change the map editor persistence hook?
npx gitnexus impact "useMapPersistence"

# Find all API routers
npx gitnexus cypher "MATCH (n:Function) WHERE n.filePath CONTAINS 'routers/' RETURN n.name, n.filePath LIMIT 30"

# Explore the course module cluster
npx gitnexus query "course management" --limit 10

# View the graph visually
npx gitnexus serve
# Then open https://gitnexus.dev in your browser
```

---

## Re-index After Changes

After making significant code changes, re-run analysis to update the graph:

```bash
npx gitnexus analyze --skip-git
```

To force a clean re-index:

```bash
npx gitnexus clean
npx gitnexus analyze --skip-git
```
