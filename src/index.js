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

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Single source of truth for the version. Previously this was a literal in two
// places and drifted: the package shipped 0.5.0 while the MCP handshake and the
// outbound user-agent both still advertised 0.3.0.
const VERSION = createRequire(import.meta.url)("../package.json").version;
import { TOOLS, buildQuery, resolvePathParams, MissingPathParamError } from "./tools.js";

const API_KEY = process.env.TWITTERAPIS_KEY;
const BASE_URL = (
  process.env.TWITTERAPIS_BASE_URL || "https://api.twitterapis.com"
).replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 30000;
// A malformed TWITTERAPIS_TIMEOUT_MS (non-numeric, or <= 0) used to reach
// setTimeout() unvalidated. Number("30000ms") and Number("60,000") are both
// NaN, and Node clamps a NaN or sub-1 delay to ~1ms (verified directly:
// `setTimeout(fn, NaN)` fires in under 1ms), so every tool call aborted
// almost immediately with "Request failed: timed out after NaNms" -- which
// reads as a live outage, not the config typo it actually is. An explicit 0
// or negative value has the same effect with no typo needed at all. Fall
// back to the documented default on anything that is not a finite, positive
// number, and say so loudly rather than silently eating every call.
let REQUEST_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
const rawTimeoutEnv = process.env.TWITTERAPIS_TIMEOUT_MS;
if (rawTimeoutEnv) {
  const parsed = Number(rawTimeoutEnv);
  if (Number.isFinite(parsed) && parsed > 0) {
    REQUEST_TIMEOUT_MS = parsed;
  } else {
    console.error(
      `[twitterapis-mcp] TWITTERAPIS_TIMEOUT_MS="${rawTimeoutEnv}" is not a positive number; ` +
        `falling back to the default ${DEFAULT_TIMEOUT_MS}ms instead of timing out every call immediately.`,
    );
  }
}

// Lazy validation, not exit-on-boot: an MCP registry scanner (Smithery, Glama,
// the official registry, Claude Connectors) connects the stdio transport with
// no real credential to enumerate tools/list. Exiting here before the server
// ever registers a tool makes that handshake fail outright and reads as a
// generic connectivity error, not a missing-key error, on the scanner side --
// confirmed live 2026-08-18 (Smithery: "Initialization failed... could not be
// automatically scanned", HTTP 405). Warn and continue; a real tool CALL made
// with no key still fails clearly, at the point of the call, same as it
// already does for a bad key (see the 401 branch below).
if (!API_KEY) {
  console.error(
    "[twitterapis-mcp] Missing TWITTERAPIS_KEY. Get a key at https://www.twitterapis.com/signup and set it in your MCP client config. Tools are registered but every call will fail until it is set.",
  );
}

// ── REST call ────────────────────────────────────────────────────────────────
// Most endpoints (GET reads and the simple POST writes alike) read their params
// from the query string, so the same buildQuery path serves both and only the
// HTTP method differs. A few POST endpoints (customer/session, user_login,
// media/upload) instead read a JSON request body; those tools set jsonBody:true
// and callEndpoint sends the args in the body rather than the query string. A
// handful of monitoring endpoints (/monitor/{id}, /webhook/{id}, ...) carry a
// REST path parameter instead: those tools set pathParams (the arg names to
// substitute into the URL template) and callEndpoint splices them into path
// before building the query string or body, so a pathParams arg never leaks
// into either.
async function callEndpoint(path, args, method = "GET", jsonBody = false, pathParams = []) {
  if (!API_KEY) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: "Missing TWITTERAPIS_KEY (invalid or missing API key, get one at https://www.twitterapis.com/signup and set it in your MCP client config).",
      }],
    };
  }
  // Fill {name} URL segments from args and strip those keys, so a pathParams arg
  // (e.g. a monitor/webhook id) never also leaks into the query string or JSON
  // body. A missing value fails loudly rather than shipping a request that still
  // contains the literal "{id}" against the API.
  let resolvedPath, all;
  try {
    ({ path: resolvedPath, args: all } = resolvePathParams(path, pathParams, args));
  } catch (err) {
    if (err instanceof MissingPathParamError) {
      return { isError: true, content: [{ type: "text", text: err.message }] };
    }
    throw err;
  }

  const headers = {
    // The API accepts either header; send both for maximum compatibility.
    Authorization: `Bearer ${API_KEY}`,
    "x-api-key": API_KEY,
    accept: "application/json",
    "user-agent": `twitterapis-mcp/${VERSION}`,
  };

  let url;
  let reqBody;
  if (jsonBody) {
    // Endpoints whose handler reads a JSON request body (customer/session,
    // user_login, media/upload). Send every arg in the body: for customer/session
    // and user_login the credentials ARE the payload the handler reads from the
    // body, so they must NOT be diverted into x-* headers the way per-call inline
    // creds are on the query-string tools.
    url = `${BASE_URL}${resolvedPath}`;
    headers["content-type"] = "application/json";
    reqBody = JSON.stringify(all);
  } else {
    // Pull per-call inline credentials out of args so they travel as request
    // headers, never the query string (the API reads x-auth-token / x-ct0; passing
    // them as query params would leak them into URLs and access logs). When
    // supplied, this one API key acts as that account; otherwise the key's linked
    // session is used. Lets a single key act as many accounts.
    const { auth_token, ct0, user_agent, proxy_url, ...rest } = all;
    const q = buildQuery(rest);
    url = `${BASE_URL}${resolvedPath}${q ? `?${q}` : ""}`;
    if (auth_token && ct0) {
      headers["x-auth-token"] = auth_token;
      headers["x-ct0"] = ct0;
      if (user_agent) headers["x-user-agent"] = user_agent;
      if (proxy_url) headers["x-proxy-url"] = proxy_url;
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: reqBody,
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
const server = new McpServer({ name: "twitterapis", version: VERSION });

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
    async (args) => callEndpoint(tool.path, args, method, Boolean(tool.jsonBody), tool.pathParams || []),
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
