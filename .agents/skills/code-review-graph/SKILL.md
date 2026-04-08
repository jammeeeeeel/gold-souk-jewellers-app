---
name: code-review-graph
description: Install and use code-review-graph — a local knowledge graph that builds a persistent AST-based map of your codebase so AI assistants read only what matters (6.8× fewer tokens on reviews, up to 49× on daily coding tasks). Works with Claude Code, Cursor, Windsurf, Zed, Continue, and OpenCode via MCP.
---

# code-review-graph Skill

## Overview
`code-review-graph` parses your codebase into an AST with Tree-sitter, storing it as a graph of nodes (functions, classes, imports) and edges (calls, inheritance, test coverage). At review time it computes the minimal "blast radius" of changed files so the AI only reads what matters.

Supported languages: Python, TypeScript/TSX, JavaScript, Vue, Go, Rust, Java, Scala, C#, Ruby, Kotlin, Swift, PHP, Solidity, C/C++, Dart, R, Perl.

---

## Prerequisites

- **Python 3.10+**
- **[uv](https://docs.astral.sh/uv/)** — fast Python package manager

Install `uv` if not present:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## Installation

```bash
# 1. Install the package
pip install code-review-graph

# 2. Auto-detect all supported AI platforms and write MCP config
code-review-graph install

# 3. Parse the entire codebase into the knowledge graph
code-review-graph build
```

> After running `install`, **restart your editor / AI tool** so it picks up the new MCP server config.

### Target a specific platform

```bash
code-review-graph install --platform claude-code   # Claude Code (.mcp.json)
code-review-graph install --platform cursor        # Cursor (.cursor/mcp.json)
code-review-graph install --platform windsurf      # Windsurf (.windsurf/mcp.json)
code-review-graph install --platform zed           # Zed (.zed/settings.json)
code-review-graph install --platform continue      # Continue (.continue/config.json)
code-review-graph install --platform opencode      # OpenCode (.opencode/config.json)
```

### Optional dependency groups

```bash
pip install code-review-graph[embeddings]        # Local vector embeddings (sentence-transformers)
pip install code-review-graph[google-embeddings] # Google Gemini embeddings
pip install code-review-graph[communities]       # Community detection (igraph)
pip install code-review-graph[eval]              # Evaluation benchmarks (matplotlib)
pip install code-review-graph[wiki]              # Wiki generation with LLM summaries (ollama)
pip install code-review-graph[all]              # All optional dependencies
```

---

## Building / Updating the Graph

```bash
code-review-graph build    # Full parse of entire codebase (~10 s for 500 files)
code-review-graph update   # Incremental update — changed files only (<2 s for 2900 files)
code-review-graph watch    # Auto-update on every file save / git commit
```

Once installed, ask your AI assistant:
> "Build the code review graph for this project"

---

## Common Commands

| Command | Purpose |
|---|---|
| `code-review-graph install` | Auto-configure all AI platforms |
| `code-review-graph build` | Full codebase parse |
| `code-review-graph update` | Incremental re-index |
| `code-review-graph status` | Show graph statistics |
| `code-review-graph watch` | Watch mode (auto-update) |
| `code-review-graph visualize` | Interactive HTML graph |
| `code-review-graph wiki` | Generate markdown wiki |
| `code-review-graph detect-changes` | Risk-scored change impact |
| `code-review-graph serve` | Start MCP server manually |
| `code-review-graph eval --all` | Run evaluation benchmarks |

---

## MCP Slash Commands (once graph is built)

```
/code-review-graph:build-graph
/code-review-graph:review-delta
/code-review-graph:review-pr
```

MCP Prompt workflows: `review_changes`, `architecture_map`, `debug_issue`, `onboard_developer`, `pre_merge_check`

---

## Excluding Paths

Create `.code-review-graphignore` in the project root:

```
generated/**
*.generated.ts
vendor/**
node_modules/**
```

---

## Contributing / Development Setup

```bash
git clone https://github.com/tirth8205/code-review-graph.git
cd code-review-graph
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

To add a new language: edit `code_review_graph/parser.py` — add the extension to `EXTENSION_TO_LANGUAGE` and node type mappings to `_CLASS_TYPES`, `_FUNCTION_TYPES`, `_IMPORT_TYPES`, `_CALL_TYPES`.

---

## Reference

- GitHub: https://github.com/tirth8205/code-review-graph
- Licence: MIT
