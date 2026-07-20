#!/usr/bin/env node
/**
 * RememberKin MCP Server
 *
 * Exposes the RememberKin family memory agent (Express REST API) to any
 * MCP client (Claude Desktop, Cursor, ...) over stdio.
 *
 * Environment variables:
 *   REMEMBERKIN_API_URL   Base URL of the API (default: http://localhost:6100/api/v1)
 *   REMEMBERKIN_EMAIL     Account email used to log in
 *   REMEMBERKIN_PASSWORD  Account password
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_URL = (process.env.REMEMBERKIN_API_URL ?? "http://localhost:6100/api/v1").replace(/\/+$/, "");
const EMAIL = process.env.REMEMBERKIN_EMAIL;
const PASSWORD = process.env.REMEMBERKIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  // MCP stdio servers must not write to stdout except protocol messages.
  console.error("[rememberkin-mcp] REMEMBERKIN_EMAIL and REMEMBERKIN_PASSWORD must be set.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// API client: login, JWT caching, re-login on 401
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;

async function login(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Login failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error("Login succeeded but no token was returned");
  }
  cachedToken = data.token;
  return cachedToken;
}

interface ApiRequestOptions {
  method?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const token = cachedToken ?? (await login());

  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const doFetch = (authToken: string) =>
    fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res = await doFetch(token);

  // JWT expired or invalid — re-login once and retry.
  if (res.status === 401) {
    cachedToken = null;
    const freshToken = await login();
    res = await doFetch(freshToken);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${options.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
  }

  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Response types (mirroring backend/src routes & models)
// ---------------------------------------------------------------------------

interface SearchResult {
  type: "story" | "memory";
  id: string;
  content: string;
  summary?: string;
  relevance: number;
}

interface FamilyTreeNode {
  id: string;
  name: string;
  nickname?: string;
  birthDate?: string;
  deathDate?: string;
  isDeceased?: boolean;
  isRegistered?: boolean;
}

interface FamilyTreeEdge {
  from: string;
  to: string;
  relationship: "PARENT_OF" | "SPOUSE_OF" | "SIBLING_OF";
}

interface FamilyTree {
  nodes: FamilyTreeNode[];
  edges: FamilyTreeEdge[];
}

interface SemanticMemory {
  id: string;
  factType: string;
  fact: string;
  aboutName: string;
  confidence: number;
  reinforcementCount: number;
  decayFactor: number;
}

interface FamilyEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  date: string;
  recurring: boolean;
  involves: { id: string; name: string }[];
  daysUntil: number;
}

interface ChatApiResponse {
  response: string;
  relatedStories?: { id: string; summary: string }[];
  suggestedActions?: { type: string; label: string }[];
  sessionId: string;
  usage?: {
    model: string;
    tokenUsage?: { input: number; output: number; total: number };
    costEstimate?: { totalCost: number; currency: string };
    latencyMs?: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// MCP server + tools
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "rememberkin",
  version: "1.0.0",
});

server.registerTool(
  "search_family_memories",
  {
    title: "Search family memories",
    description:
      "Semantic search across the family's stories and extracted memories. " +
      "Returns matching story/memory text ranked by relevance.",
    inputSchema: {
      query: z.string().min(2).describe("Search query (at least 2 characters)"),
      limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)"),
    },
  },
  async ({ query, limit }) => {
    try {
      const data = await apiRequest<{ results: SearchResult[] }>("/search", {
        query: { q: query, types: "stories,memories", limit: limit ?? 10 },
      });

      if (!data.results.length) {
        return textResult(`No stories or memories matched "${query}".`);
      }

      const lines = data.results.map((r, i) => {
        const header = `${i + 1}. [${r.type}] (relevance ${(r.relevance * 100).toFixed(0)}%)`;
        const summary = r.summary ? `\n   Summary: ${r.summary}` : "";
        return `${header}\n   ${r.content}${summary}`;
      });
      return textResult(`Found ${data.results.length} result(s) for "${query}":\n\n${lines.join("\n\n")}`);
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.registerTool(
  "get_family_tree",
  {
    title: "Get family tree",
    description:
      "Returns the family tree: all members (name, nickname, birth date, living status) " +
      "and the relationships between them (parent/spouse/sibling).",
    inputSchema: {},
  },
  async () => {
    try {
      const tree = await apiRequest<FamilyTree>("/family/tree");
      const nameById = new Map(tree.nodes.map((n) => [n.id, n.name]));

      const memberLines = tree.nodes.map((n) => {
        const details: string[] = [];
        if (n.nickname) details.push(`"${n.nickname}"`);
        if (n.birthDate) details.push(`born ${n.birthDate}`);
        if (n.isDeceased) details.push(n.deathDate ? `deceased ${n.deathDate}` : "deceased");
        if (n.isRegistered === false) details.push("not registered");
        return `- ${n.name}${details.length ? ` (${details.join(", ")})` : ""}`;
      });

      const relLabel: Record<FamilyTreeEdge["relationship"], string> = {
        PARENT_OF: "is a parent of",
        SPOUSE_OF: "is the spouse of",
        SIBLING_OF: "is a sibling of",
      };
      const edgeLines = tree.edges.map(
        (e) =>
          `- ${nameById.get(e.from) ?? e.from} ${relLabel[e.relationship] ?? e.relationship} ${nameById.get(e.to) ?? e.to}`
      );

      return textResult(
        `Family tree (${tree.nodes.length} member(s), ${tree.edges.length} relationship(s))\n\n` +
          `Members:\n${memberLines.join("\n")}\n\n` +
          `Relationships:\n${edgeLines.length ? edgeLines.join("\n") : "- (none recorded)"}`
      );
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.registerTool(
  "get_semantic_memories",
  {
    title: "Get consolidated semantic memories",
    description:
      "Lists the consolidated long-term facts the family memory system has learned " +
      "(preferences, traits, biographical facts, routines...), each with a confidence score.",
    inputSchema: {},
  },
  async () => {
    try {
      const data = await apiRequest<{ memories: SemanticMemory[]; total: number }>(
        "/memory-dashboard/semantic"
      );

      if (!data.memories.length) {
        return textResult("No consolidated semantic memories yet.");
      }

      const lines = data.memories.map((m) => {
        const confidence = `${(m.confidence * 100).toFixed(0)}% confidence`;
        const reinforced = m.reinforcementCount > 1 ? `, reinforced ${m.reinforcementCount}x` : "";
        return `- [${m.factType}] ${m.fact} (about ${m.aboutName}; ${confidence}${reinforced})`;
      });
      return textResult(`${data.total} consolidated semantic memory(ies):\n\n${lines.join("\n")}`);
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.registerTool(
  "get_upcoming_events",
  {
    title: "Get upcoming family events",
    description:
      "Lists upcoming family events (birthdays, anniversaries, surgeries, custom events) " +
      "within the next N days, with countdowns and who is involved.",
    inputSchema: {
      days: z.number().int().min(1).max(3650).optional().describe("Look-ahead window in days (default 365)"),
    },
  },
  async ({ days }) => {
    try {
      const lookahead = days ?? 365;
      const data = await apiRequest<{ events: FamilyEvent[] }>("/events", {
        query: { days: lookahead },
      });

      if (!data.events.length) {
        return textResult(`No upcoming events in the next ${lookahead} days.`);
      }

      const lines = data.events.map((e) => {
        const who = e.involves.map((p) => p.name).join(", ");
        const desc = e.description ? ` — ${e.description}` : "";
        return `- [${e.type}] ${e.title} on ${e.date} (in ${e.daysUntil} day(s))${who ? `, involves: ${who}` : ""}${e.recurring ? " [recurring]" : ""}${desc}`;
      });
      return textResult(`${data.events.length} upcoming event(s) in the next ${lookahead} days:\n\n${lines.join("\n")}`);
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.registerTool(
  "ask_family_agent",
  {
    title: "Ask the family memory agent",
    description:
      "Sends a message to the RememberKin AI agent, which answers using the family's " +
      "stories, memories, tree, and events. Note: this consumes AI (Qwen) tokens on the backend.",
    inputSchema: {
      message: z.string().min(1).describe("The question or message for the family memory agent"),
    },
  },
  async ({ message }) => {
    try {
      const data = await apiRequest<ChatApiResponse>("/chat", {
        method: "POST",
        body: { message, history: [] },
      });

      let text = data.response;
      if (data.relatedStories?.length) {
        text += `\n\nRelated stories:\n${data.relatedStories.map((s) => `- ${s.summary}`).join("\n")}`;
      }
      if (data.usage?.tokenUsage) {
        text += `\n\n(model: ${data.usage.model}, tokens: ${data.usage.tokenUsage.total})`;
      }
      return textResult(text);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[rememberkin-mcp] connected via stdio (API: ${API_URL}, account: ${EMAIL})`);
