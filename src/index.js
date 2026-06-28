#!/usr/bin/env node
// @twitterapis/mcp, official MCP server for twitterapis.com
//
// Exposes the Twitter / X API as native MCP tools for Claude, Cursor, and any
// MCP client: reads (search, users, followers/following, tweets, threads,
// lists, mentions, likes, bookmarks, DMs, home timeline) plus write actions
// (post/delete tweet, like, retweet, bookmark, follow, and their inverses).
// Each tool is a thin, typed wrapper over a REST endpoint at
// https://api.twitterapis.com. The server holds no state and forwards your API
// key on every call. The tool catalog lives in ./tools.js.
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
// Every endpoint (GET reads and POST writes alike) reads its params from the
// query string, so the same buildQuery path serves both; only the HTTP method
// differs per tool.
async function callEndpoint(path, args, method = "GET") {
  // Pull per-call inline credentials out of args so they travel as request
  // headers, never the query string (the API reads x-auth-token / x-ct0; passing
  // them as query params would leak them into URLs and access logs). When
  // supplied, this one API key acts as that account; otherwise the key's linked
  // session is used. Lets a single key act as many accounts.
  const { auth_token, ct0, user_agent, proxy_url, ...rest } = args || {};
  const q = buildQuery(rest);
  const url = `${BASE_URL}${path}${q ? `?${q}` : ""}`;

  const headers = {
    // The API accepts either header; send both for maximum compatibility.
    Authorization: `Bearer ${API_KEY}`,
    "x-api-key": API_KEY,
    accept: "application/json",
    "user-agent": "twitterapis-mcp/0.3.0",
  };
  if (auth_token && ct0) {
    headers["x-auth-token"] = auth_token;
    headers["x-ct0"] = ct0;
    if (user_agent) headers["x-user-agent"] = user_agent;
    if (proxy_url) headers["x-proxy-url"] = proxy_url;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers,
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
                : res.status === 409
                  ? " (no authenticated X session for this key. Write actions and account-only reads (likes, bookmarks, DMs, home timeline, follow, post) require linking an X account/session to your key first; see https://www.twitterapis.com/dashboard)"
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
const server = new McpServer({ name: "twitterapis", version: "0.3.0" });

for (const tool of TOOLS) {
  const method = tool.method || "GET";
  // Surface read/write/destructive intent so MCP clients can warn before a
  // mutating call (default = read-only).
  const annotations = {
    title: tool.name,
    readOnlyHint: !tool.write,
    destructiveHint: Boolean(tool.destructive),
    openWorldHint: true,
  };
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: tool.shape, annotations },
    async (args) => callEndpoint(tool.path, args, method),
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
