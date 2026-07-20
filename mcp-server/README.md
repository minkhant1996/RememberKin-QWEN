# RememberKin MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) stdio server that exposes the RememberKin family memory agent to any MCP client — Claude Desktop, Cursor, Claude Code, etc.

It logs into the RememberKin REST API with a regular user account, caches the JWT (re-logging in automatically on 401), and exposes the family's memories, tree, events, and AI agent as MCP tools.

## Tools

| Tool | Backing endpoint | Description |
|------|------------------|-------------|
| `search_family_memories(query, limit?)` | `GET /search` | Semantic search across stories and extracted memories |
| `get_family_tree()` | `GET /family/tree` | Members and relationships as a readable summary |
| `get_semantic_memories()` | `GET /memory-dashboard/semantic` | Consolidated long-term facts with confidence scores |
| `get_upcoming_events(days?)` | `GET /events?days=` | Upcoming birthdays/anniversaries/events (default window: 365 days) |
| `ask_family_agent(message)` | `POST /chat` | Ask the AI agent a question (note: consumes Qwen tokens on the backend) |

## Setup

Requires Node.js 18+ and a running RememberKin backend (default `http://localhost:6100`).

```bash
cd mcp-server
npm install
npm run build
```

Configuration is via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `REMEMBERKIN_API_URL` | `http://localhost:6100/api/v1` | Base URL of the RememberKin API |
| `REMEMBERKIN_EMAIL` | — (required) | Account email |
| `REMEMBERKIN_PASSWORD` | — (required) | Account password |

Run it manually (it speaks MCP over stdin/stdout):

```bash
REMEMBERKIN_EMAIL=mary@test.local REMEMBERKIN_PASSWORD=test12345 npm start
```

## Claude Desktop configuration

Add to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rememberkin": {
      "command": "node",
      "args": ["/absolute/path/to/RememberKin/mcp-server/dist/index.js"],
      "env": {
        "REMEMBERKIN_API_URL": "http://localhost:6100/api/v1",
        "REMEMBERKIN_EMAIL": "mary@test.local",
        "REMEMBERKIN_PASSWORD": "test12345"
      }
    }
  }
}
```

Restart Claude Desktop and ask things like *"What's on the family calendar this year?"* or *"Search our family memories for Grandpa Joe's kites."*

For Cursor / Claude Code, register the same `command`/`args`/`env` in their MCP settings (e.g. `claude mcp add rememberkin -e REMEMBERKIN_EMAIL=... -e REMEMBERKIN_PASSWORD=... -- node /absolute/path/to/RememberKin/mcp-server/dist/index.js`).

## Notes

- Works with **any** RememberKin account — the tools operate on whatever family the configured account belongs to.
- All requests are subject to the backend's rate limits and AI budget cap; `ask_family_agent` is the only tool that spends AI tokens.
- The server never writes to stdout except MCP protocol messages; diagnostics go to stderr.
