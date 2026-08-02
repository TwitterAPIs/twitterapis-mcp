// openapi-parity.mjs — fail-closed drift gate between the MCP tools and the
// canonical openapi.json (the same spec that generates the docs). Ensures the
// MCP surface never drifts from the REST contract: every tool maps to a real
// endpoint, every public endpoint has a tool, and every tool arg is a real
// request param. Response-field prose is not machine-checkable here; the
// openapi<->live-API contract is enforced separately by the live-contract gate.
//
// Run: node test/openapi-parity.mjs   (wired into `npm test`)
// Source of truth: https://docs.twitterapis.com/openapi.json (falls back to the
// vendored copy at test/openapi.snapshot.json when the network is unavailable).
//
// This gate reads the LIVE spec, which is what makes it different from the build
// check. `npm run build:check` proves the catalog matches the VENDORED snapshot;
// this proves the catalog matches what the API publishes RIGHT NOW, so a route
// added or retired upstream shows up here as a failure whose fix is
// `npm run openapi:refresh` followed by `npm run build`. Because the two read
// different copies, the pair also catches a stale snapshot, which a single gate
// reading either copy alone cannot see.

import { TOOLS } from "../src/tools.js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
// Overridable so the offline fallback path is testable. The default is the real
// published spec; nothing reads this variable in normal use.
const OPENAPI_URL = process.env.OPENAPI_URL || "https://docs.twitterapis.com/openapi.json";
const SNAPSHOT = resolve(HERE, "openapi.snapshot.json");

// openapi paths omit the /twitter prefix the MCP tool paths carry.
const norm = (p) => p.replace(/^\/twitter/, "");

// Every public openapi endpoint now has a first-class MCP tool (customer/session,
// user_login and media/upload used to be walled here; they are now real tools), so
// nothing is excluded from the "every endpoint has a tool" coverage check. Keep
// this empty: any path added here is EXCLUDED from that check and needs a reason.
const NO_TOOL_ALLOWLIST = new Set([]);

// Tool args that map to request HEADERS or are universal pagination, so they are
// NOT expected to appear as openapi query/body params.
const NON_PARAM_ARGS = new Set([
  "auth_token", "ct0", "proxy_url", "user_agent", // -> x-* headers
]);

async function loadOpenapi() {
  try {
    const res = await fetch(OPENAPI_URL, { signal: AbortSignal.timeout(15000) });
    if (res.ok) return await res.json();
    throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    if (existsSync(SNAPSHOT)) {
      console.warn(`  (network fetch failed: ${e.message}; using vendored snapshot)`);
      return JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    }
    throw new Error(`cannot load openapi.json (network: ${e.message}; no snapshot at ${SNAPSHOT})`);
  }
}

function openapiIndex(oa) {
  const idx = {};
  for (const [p, ops] of Object.entries(oa.paths || {})) {
    for (const [method, op] of Object.entries(ops)) {
      if (method !== "get" && method !== "post") continue;
      const params = new Set((op.parameters || []).map((x) => x.name));
      const rb = op.requestBody?.content?.["application/json"]?.schema?.properties || {};
      for (const k of Object.keys(rb)) params.add(k);
      idx[p] = params;
    }
  }
  return idx;
}

async function main() {
  const oa = await loadOpenapi();
  const oaIdx = openapiIndex(oa);
  const oaPaths = new Set(Object.keys(oaIdx));
  const problems = [];

  // 1) every tool path exists in openapi
  const toolPaths = new Set();
  for (const t of TOOLS) {
    const np = norm(t.path);
    toolPaths.add(np);
    if (!oaPaths.has(np)) {
      problems.push(`tool ${t.name} -> ${t.path} has no matching openapi endpoint (${np})`);
    }
  }

  // 2) every public openapi endpoint has a tool (minus the allowlist)
  for (const p of oaPaths) {
    if (NO_TOOL_ALLOWLIST.has(p)) continue;
    if (!toolPaths.has(p)) {
      problems.push(`openapi endpoint ${p} has NO MCP tool (add a tool, or add to NO_TOOL_ALLOWLIST with a reason)`);
    }
  }

  // 3) every tool arg is a real request param on that endpoint
  for (const t of TOOLS) {
    const np = norm(t.path);
    const oaParams = oaIdx[np];
    if (!oaParams) continue; // already reported in (1)
    for (const arg of Object.keys(t.shape || {})) {
      if (NON_PARAM_ARGS.has(arg)) continue;
      if (!oaParams.has(arg)) {
        problems.push(`tool ${t.name} arg "${arg}" is not a request param of ${np} (openapi params: ${[...oaParams].join(", ") || "none"})`);
      }
    }
  }

  console.log(`  openapi-parity: ${TOOLS.length} tools, ${oaPaths.size} endpoints, ${NO_TOOL_ALLOWLIST.size} allowlisted`);
  if (problems.length) {
    console.error("");
    for (const p of problems) console.error(`  \x1b[31m✗ ${p}\x1b[0m`);
    console.error(`\n  \x1b[31m✗ openapi-parity: ${problems.length} drift(s) between MCP tools and openapi.json\x1b[0m`);
    process.exit(1);
  }
  console.log(`  \x1b[32m✓ openapi-parity: MCP tools ⇄ openapi.json in full sync\x1b[0m`);
}

main().catch((e) => {
  console.error(`  \x1b[31m✗ openapi-parity gate error: ${e.message}\x1b[0m`);
  process.exit(1);
});
