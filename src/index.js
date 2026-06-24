#!/usr/bin/env node
// @twitterapis/mcp, official MCP server for twitterapis.com
//
// Exposes the Twitter / X READ API as native MCP tools (search, users,
// followers/following, tweets, threads, lists, mentions) for Claude, Cursor,
// and any MCP client. Each tool is a thin, typed wrapper over a REST endpoint
// at https://api.twitterapis.com. The server holds no state and forwards your
// API key on every call. The tool catalog lives in ./tools.js.
//
// Config (env):
//   TWITTERAPIS_KEY        required. Your key from https://www.twitterapis.com/signup
//   TWITTERAPIS_BASE_URL   optional. Defaults to https://api.twitterapis.com
//   TWITTERAPIS_TIMEOUT_MS optional. Per-request timeout (default 30000)
//
// Run:  npx -y @twitterapis/mcp@latest   (stdio transport)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS, buildQuery } from "./tools.js";

const API_KEY = process.env.TWITTERAPIS_KEY;
const BASE_URL = (
  process.env.TWITTERAPIS_BASE_URL || "https://api.twitterapis.com"
).replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = Number(process.env.TWITTERAPIS_TIMEOUT_MS || 30000);

if (!API_KEY) {
  console.error(
    "[twitterapis-mcp] Missing TWITTERAPIS_KEY. Get a key at https://www.twitterapis.com/signup and set it in your MCP client config.",
  );
  process.exit(1);
}

// ── REST call ────────────────────────────────────────────────────────────────
async function callEndpoint(path, args) {
  const q = buildQuery(args);
  const url = `${BASE_URL}${path}${q ? `?${q}` : ""}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        // The API accepts either header; send both for maximum compatibility.
        Authorization: `Bearer ${API_KEY}`,
        "x-api-key": API_KEY,
        accept: "application/json",
        "user-agent": "twitterapis-mcp/0.1.1",
      },
      signal: ctrl.signal,
    });
    const body = await res.text();
    if (!res.ok) {
      const hint =
        res.status === 401
          ? " (invalid or missing API key, verify TWITTERAPIS_KEY at https://www.twitterapis.com/dashboard)"
          : res.status === 402
            ? " (insufficient credits, top up at https://www.twitterapis.com/dashboard)"
            : res.status === 403
              ? " (access forbidden. The resource may be private or your plan does not include this endpoint)"
              : res.status === 404
                ? " (not found. The user, tweet, or list may have been deleted or the id is wrong)"
                : res.status === 429
                  ? " (rate limited. Wait a few seconds and retry; reduce request frequency or increase TWITTERAPIS_TIMEOUT_MS if needed)"
                  : res.status >= 500
                    ? " (upstream API error. Retry in a moment; if persistent, check https://www.twitterapis.com/status)"
                    : "";
      return { isError: true, content: [{ type: "text", text: `HTTP ${res.status}${hint}: ${body.slice(0, 1200)}` }] };
    }
    return { content: [{ type: "text", text: body }] };
  } catch (err) {
    const msg = err?.name === "AbortError" ? `timed out after ${REQUEST_TIMEOUT_MS}ms` : err?.message || String(err);
    return { isError: true, content: [{ type: "text", text: `Request failed: ${msg}` }] };
  } finally {
    clearTimeout(timer);
  }
}

// ── MCP server ───────────────────────────────────────────────────────────────
const server = new McpServer({ name: "twitterapis", version: "0.1.1" });

for (const tool of TOOLS) {
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: tool.shape },
    async (args) => callEndpoint(tool.path, args),
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs go to stderr so they never corrupt the stdio JSON-RPC stream.
  console.error(`[twitterapis-mcp] ready · ${TOOLS.length} tools · base ${BASE_URL}`);
}

main().catch((err) => {
  console.error("[twitterapis-mcp] fatal:", err);
  process.exit(1);
});
