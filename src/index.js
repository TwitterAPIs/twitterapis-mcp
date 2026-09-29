#!/usr/bin/env node
// @twitterapis/mcp, official MCP server for twitterapis.com
//
// Exposes the Twitter / X API as native MCP tools for Claude, Cursor, and any
// MCP client: reads (search, users, followers/following, tweets, threads,
// lists, mentions, likes, bookmarks, DMs, home timeline) plus write actions
// (post/delete tweet, like, retweet, bookmark, follow, and their inverses).
// Each tool is a thin, typed wrapper over a REST endpoint at
// https://api.twitterapis.com. The server forwards your API key on every call.
// The tool catalog lives in ./tools.js; the server itself is built by
// createServer() in ./server.js, which holds every per-caller value (key, last
// failure) in its own closure so the same code can serve many callers.
//
// This file is the stdio entry point and the ONLY place config is read from
// the environment:
//   TWITTERAPIS_KEY        required. Your key from https://www.twitterapis.com/signup
//   TWITTERAPIS_BASE_URL   optional. Defaults to https://api.twitterapis.com
//   TWITTERAPIS_TIMEOUT_MS optional. Per-request timeout (default 30000)
//
// Run:  npx -y @twitterapis/mcp@latest   (stdio transport)

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS } from "./tools.js";
import { createServer, hintFor, DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS } from "./server.js";

// Re-exported so existing importers of the entry point keep working.
export { hintFor };

const API_KEY = process.env.TWITTERAPIS_KEY;
const BASE_URL = process.env.TWITTERAPIS_BASE_URL || DEFAULT_BASE_URL;

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
// already does for a bad key (see the 401 branch in server.js).
if (!API_KEY) {
  console.error(
    "[twitterapis-mcp] Missing TWITTERAPIS_KEY. Get a key at https://www.twitterapis.com/signup and set it in your MCP client config. Tools are registered but every call will fail until it is set.",
  );
}

async function main() {
  const { server, baseUrl } = createServer({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    timeoutMs: REQUEST_TIMEOUT_MS,
    feedbackEnv: process.env,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs go to stderr so they never corrupt the stdio JSON-RPC stream.
  console.error(`[twitterapis-mcp] ready · ${TOOLS.length} tools · base ${baseUrl}`);
}

main().catch((err) => {
  console.error("[twitterapis-mcp] fatal:", err);
  process.exit(1);
});
