#!/usr/bin/env node
// Build the tool catalog: src/tools.js is GENERATED, from
//
//   test/openapi.snapshot.json   the vendored REST contract (structure)
//   scripts/tools.overrides.mjs  the hand-authored agent-facing layer (prose)
//
// The split is the point. The spec knows which endpoints exist, which params each
// accepts, whether a param is required, and its base type; keeping that in a
// hand-maintained file is how a catalog silently drifts from the API it wraps.
// The spec does NOT know the tool descriptions a model reads to choose between
// two sibling tools, the cross-field rules ("provide exactly one of username or
// user_id"), the per-call credential headers, or which writes are destructive;
// regenerating those from the spec would replace tuned prose with endpoint
// documentation and quietly make every tool harder for a model to call
// correctly. So: structure is derived, prose is authored, and this script is the
// gate that keeps the two honest about each other.
//
// The OUTPUT IS COMMITTED and no part of it is fetched at runtime. A server that
// pulls its own tool manifest over the network at boot has handed its entire tool
// surface to whoever controls that hostname, and stops working the day the
// hostname stops answering. Generating at build time and committing the result
// means the published package is a fixed, reviewable artifact.
//
// Usage:
//   node scripts/gen-tools.mjs --write   regenerate src/tools.js   (npm run build)
//   node scripts/gen-tools.mjs --check   fail if src/tools.js differs from the
//                                        regenerated output, i.e. it was hand
//                                        edited or left stale (npm test)
//
// Fail-closed. The build REFUSES to emit when:
//   - an override names an endpoint the spec does not have
//   - the spec has an endpoint no override covers
//   - an override arg is not a real param of that endpoint (and is not a header)
//   - a spec param is neither exposed as an arg nor listed in omit with a reason
//   - two tools share a name or a path, or a group reference does not resolve

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ARG_GROUPS, TOOL_OVERRIDES } from "./tools.overrides.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SNAPSHOT = resolve(ROOT, "test", "openapi.snapshot.json");
const OUT = resolve(ROOT, "src", "tools.js");

const MODE = process.argv.includes("--check") ? "check" : process.argv.includes("--write") ? "write" : null;
if (!MODE) {
  console.error("usage: node scripts/gen-tools.mjs --write | --check");
  process.exit(2);
}

const problems = [];
const bad = (msg) => problems.push(msg);

// ── 1. Read the vendored spec ────────────────────────────────────────────────
if (!existsSync(SNAPSHOT)) {
  console.error(`\x1b[31m✗ gen-tools: no vendored spec at ${relative(ROOT, SNAPSHOT)}. Run \`npm run openapi:refresh\`.\x1b[0m`);
  process.exit(1);
}
const spec = JSON.parse(readFileSync(SNAPSHOT, "utf8"));

/** endpoint path -> { method, params: Map<name,{required,type,body}> } */
const ENDPOINTS = new Map();
for (const [p, ops] of Object.entries(spec.paths || {})) {
  for (const [m, op] of Object.entries(ops)) {
    if (m !== "get" && m !== "post") continue;
    const params = new Map();
    for (const x of op.parameters || []) {
      params.set(x.name, { required: Boolean(x.required), type: x.schema?.type || "string" });
    }
    const body = op.requestBody?.content?.["application/json"]?.schema;
    if (body) {
      const req = new Set(body.required || []);
      for (const [k, v] of Object.entries(body.properties || {})) {
        params.set(k, { required: req.has(k), type: v.type || "string", body: true });
      }
    }
    if (ENDPOINTS.has(p)) bad(`spec declares ${p} under more than one of GET/POST; the catalog assumes one verb per path`);
    ENDPOINTS.set(p, { method: m.toUpperCase(), params });
  }
}

// ── 2. Resolve overrides against the spec ────────────────────────────────────
// The MCP tool path carries the /twitter prefix the spec omits, except for the
// billing reads which live at an un-prefixed /account/*.
const toolPathFor = (endpoint) => (endpoint.startsWith("/account/") ? endpoint : `/twitter${endpoint}`);

function expandArgs(tool) {
  const out = [];
  for (const entry of tool.args || []) {
    if (typeof entry === "string") {
      const key = entry.startsWith("@") ? entry.slice(1) : entry;
      const group = ARG_GROUPS[key];
      if (!group) {
        bad(`tool ${tool.name} references arg group "${entry}" which does not exist in ARG_GROUPS`);
        continue;
      }
      out.push(...group);
    } else {
      out.push(entry);
    }
  }
  return out;
}

const seenNames = new Set();
const seenPaths = new Set();
const seenEndpoints = new Set();
const resolved = [];

for (const t of TOOL_OVERRIDES) {
  if (seenNames.has(t.name)) bad(`duplicate tool name ${t.name}`);
  seenNames.add(t.name);

  const ep = ENDPOINTS.get(t.endpoint);
  if (!ep) {
    bad(
      `tool ${t.name} targets endpoint ${t.endpoint}, which the vendored spec does not have. ` +
        `Either the route was retired upstream (drop the tool) or the snapshot is stale (npm run openapi:refresh).`,
    );
    continue;
  }
  seenEndpoints.add(t.endpoint);

  const path = toolPathFor(t.endpoint);
  if (seenPaths.has(path)) bad(`duplicate tool path ${path}`);
  seenPaths.add(path);

  const args = expandArgs(t);
  const exposed = new Set();
  const finalArgs = [];

  for (const a of args) {
    if (exposed.has(a.name)) {
      bad(`tool ${t.name} declares arg "${a.name}" twice`);
      continue;
    }
    exposed.add(a.name);
    const p = ep.params.get(a.name);

    if (!p && !a.header) {
      bad(
        `tool ${t.name} arg "${a.name}" is not a request param of ${t.endpoint} ` +
          `(spec params: ${[...ep.params.keys()].join(", ") || "none"}). ` +
          `Mark it header:true if it travels as an x-* request header, otherwise remove it.`,
      );
      continue;
    }
    if (p && a.header) {
      bad(`tool ${t.name} arg "${a.name}" is marked header:true but IS a real request param of ${t.endpoint}; drop the flag`);
      continue;
    }

    // Structure derived from the spec, deviations declared in the overrides.
    const required = a.required !== undefined ? a.required : p ? p.required : false;
    let type = a.type;
    if (!type) type = a.enum ? "enum" : p && p.type === "integer" ? "int" : p && p.type === "number" ? "number" : "string";
    if (a.enum) type = "enum";
    if (!a.describe || a.describe.length < 10) {
      bad(`tool ${t.name} arg "${a.name}" has no usable description; a model reads this to decide how to call the tool`);
    }
    if (type === "json" && !t.jsonBody) {
      bad(
        `tool ${t.name} arg "${a.name}" is type:"json" but the tool is not jsonBody:true; a non-jsonBody ` +
          `tool sends args as query-string values, which cannot carry a real object.`,
      );
    }
    finalArgs.push({ name: a.name, type, enum: a.enum, min: a.min, max: a.max, minLength: a.minLength, required, describe: a.describe });
  }

  // Every spec param must be accounted for: exposed, or omitted with a reason.
  const omit = t.omit || {};
  for (const pname of ep.params.keys()) {
    if (exposed.has(pname)) continue;
    const reason = omit[pname];
    if (!reason || String(reason).trim().length < 20) {
      bad(
        `tool ${t.name} does not expose spec param "${pname}" of ${t.endpoint} and gives no reason. ` +
          `Add it to args, or add omit: { ${pname}: "why" }. A param added upstream must never be ignored silently.`,
      );
    }
  }
  for (const pname of Object.keys(omit)) {
    if (!ep.params.has(pname)) bad(`tool ${t.name} omits "${pname}", which is not a param of ${t.endpoint}; delete the stale entry`);
    if (exposed.has(pname)) bad(`tool ${t.name} both exposes and omits "${pname}"`);
  }

  if (!t.description || t.description.length < 40) bad(`tool ${t.name} has no usable description`);
  if (t.destructive && !t.write) bad(`tool ${t.name} is destructive but not write:true`);
  if (t.jsonBody && !t.write) bad(`tool ${t.name} sets jsonBody but is not a write`);

  const method = ep.method;
  if (Boolean(t.write) !== (method === "POST")) {
    bad(
      `tool ${t.name}: the spec serves ${t.endpoint} as ${method} but the override marks it ` +
        `${t.write ? "write:true" : "a read"}. Reads are GET, writes are POST.`,
    );
  }

  resolved.push({ ...t, path, method, args: finalArgs });
}

// Every spec endpoint needs a tool. This is the drift check that catches a route
// added upstream: it fails the BUILD, not just a test, so the catalog cannot ship
// half a step behind the API.
for (const p of ENDPOINTS.keys()) {
  if (!seenEndpoints.has(p)) {
    bad(`spec endpoint ${p} has NO tool. Add an entry to scripts/tools.overrides.mjs with a real description.`);
  }
}

if (problems.length) {
  console.error("");
  for (const p of problems) console.error(`  \x1b[31m✗ ${p}\x1b[0m`);
  console.error(`\n  \x1b[31m✗ gen-tools: ${problems.length} problem(s); src/tools.js NOT written\x1b[0m`);
  process.exit(1);
}

// ── 3. Render ────────────────────────────────────────────────────────────────
const q = (s) => JSON.stringify(s);

function zodExpr(a) {
  let e;
  if (a.type === "enum") e = `z.enum(${JSON.stringify(a.enum)})`;
  else if (a.type === "int") {
    e = "z.number().int()";
    if (a.min !== undefined) e += `.min(${a.min})`;
    if (a.max !== undefined) e += `.max(${a.max})`;
  } else if (a.type === "number") {
    e = "z.number()";
    if (a.min !== undefined) e += `.min(${a.min})`;
    if (a.max !== undefined) e += `.max(${a.max})`;
  } else if (a.type === "json") {
    // Arbitrary JSON object arg, for a param the handler reads as a real
    // parsed object rather than a string (e.g. article/update_content's
    // Draft.js content_state: { blocks, entityMap }). A plain z.string() here
    // would make the MCP client send a JSON-encoded STRING, which a
    // jsonBody:true tool then double-encodes into the request body, so the
    // handler receives `typeof body.x === "string"` where it expects an
    // object and rejects the call. Only valid on a jsonBody:true tool.
    e = "z.record(z.string(), z.unknown())";
  } else {
    e = "z.string()";
    if (a.minLength !== undefined) e += `.min(${a.minLength})`;
  }
  if (!a.required) e += ".optional()";
  return `${e}.describe(\n        ${q(a.describe)},\n      )`;
}

const body = resolved
  .map((t) => {
    const L = [];
    L.push("  {");
    L.push(`    name: ${q(t.name)},`);
    L.push(`    path: ${q(t.path)},`);
    if (t.method !== "GET") L.push(`    method: ${q(t.method)},`);
    if (t.write) L.push("    write: true,");
    if (t.destructive) L.push("    destructive: true,");
    if (t.jsonBody) L.push("    jsonBody: true,");
    L.push("    description:");
    L.push(`      ${q(t.description)},`);
    if (t.args.length === 0) {
      L.push("    shape: {},");
    } else {
      L.push("    shape: {");
      for (const a of t.args) L.push(`      ${a.name}: ${zodExpr(a)},`);
      L.push("    },");
    }
    L.push("  },");
    return L.join("\n");
  })
  .join("\n");

const counts = {
  tools: resolved.length,
  reads: resolved.filter((t) => !t.write).length,
  writes: resolved.filter((t) => t.write).length,
  jsonBody: resolved.filter((t) => t.jsonBody).length,
};

const rendered = `// GENERATED FILE. DO NOT EDIT BY HAND.
//
// Built by scripts/gen-tools.mjs from:
//   test/openapi.snapshot.json    the vendored REST contract (structure)
//   scripts/tools.overrides.mjs   the hand-authored agent-facing layer (prose)
//
// Edit one of those two, then run \`npm run build\`. \`npm test\` regenerates this
// file in memory and fails if it does not match what is committed, so a hand edit
// here is caught rather than shipped.
//
// Catalog: ${counts.tools} tools (${counts.reads} reads, ${counts.writes} writes).
//
// Each tool maps 1:1 to a REST endpoint at https://api.twitterapis.com. Tool arg
// names map 1:1 to endpoint query params (every endpoint, including the POST
// write actions, reads its params from the query string), except the per-call
// inline credentials, which travel as x-* request headers, and the ${counts.jsonBody}
// jsonBody tools, whose fields travel in a JSON request body. A tool with
// \`method: "POST"\` is a write that acts on behalf of the authenticated account
// behind your API key; reads are GET and default when \`method\` is omitted.
//
// write:true       -> action mutates account/Twitter state (readOnlyHint:false)
// destructive:true -> action removes/reverses state (delete, un-follow/like/RT/bookmark)
import { z } from "zod";

export const TOOLS = [
${body}
];

// The query-string builder is hand-written logic, not catalog data, so it lives
// in its own module and is re-exported here to keep this file's one import path.
export { buildQuery } from "./query.js";
`;

// ── 4. Write or check ────────────────────────────────────────────────────────
const onDisk = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;

if (MODE === "check") {
  if (onDisk === rendered) {
    console.log(`  \x1b[32m✓ gen-tools: src/tools.js matches the generator (${counts.tools} tools)\x1b[0m`);
    process.exit(0);
  }
  console.error(
    `  \x1b[31m✗ gen-tools: src/tools.js does NOT match what the generator produces.\x1b[0m\n` +
      `    It was hand-edited, or an input changed and \`npm run build\` was not re-run.\n` +
      `    src/tools.js is generated; edit scripts/tools.overrides.mjs (or refresh the\n` +
      `    spec) and run \`npm run build\`. Do not edit src/tools.js.`,
  );
  if (onDisk !== null) {
    const a = onDisk.split("\n");
    const b = rendered.split("\n");
    let shown = 0;
    for (let i = 0; i < Math.max(a.length, b.length) && shown < 12; i++) {
      if (a[i] !== b[i]) {
        console.error(`    line ${i + 1}:`);
        console.error(`      committed: ${JSON.stringify((a[i] ?? "<eof>").slice(0, 140))}`);
        console.error(`      generated: ${JSON.stringify((b[i] ?? "<eof>").slice(0, 140))}`);
        shown++;
      }
    }
  }
  process.exit(1);
}

writeFileSync(OUT, rendered);
console.log(
  `  \x1b[32m✓ gen-tools: wrote src/tools.js, ${counts.tools} tools (${counts.reads} reads, ${counts.writes} writes)` +
    `${onDisk === rendered ? ", unchanged" : ", CHANGED"}\x1b[0m`,
);
