// Every tool advertised over tools/list carries a human-readable title and all
// four MCP ToolAnnotations hints (spec 2025-06-18): readOnlyHint,
// destructiveHint, idempotentHint, openWorldHint.
//
// It reads what a client actually receives: a real MCP client connected to
// createServer() over the SDK's in-memory transport, so a hint dropped between
// src/annotations.js and the wire fails here too. Table-driven over the whole
// catalog, so a new tool without a row fails without anyone editing this file.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { TOOLS } from "../src/tools.js";
import { TOOL_ANNOTATIONS, annotationsFor } from "../src/annotations.js";

let failed = 0;
let passed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? `: ${detail}` : ""}`); }
}

const HINTS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];

const { server } = createServer({ apiKey: "annotations-test-key", baseUrl: "https://api.test", fetchImpl: async () => { throw new Error("no network in this test"); } });
const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: "annotations-test", version: "0" });
await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
const { tools } = await client.listTools();
const byName = new Map(tools.map((t) => [t.name, t]));

// Positive control on the population: the wire must carry the whole catalog, or
// a per-tool loop over it proves nothing about the tools it never saw.
check(`tools/list carries all ${TOOLS.length} catalog tools`, tools.length === TOOLS.length && TOOLS.every((t) => byName.has(t.name)), `got ${tools.length}`);

// 1. Table-driven: every advertised tool has a title and four boolean hints.
const missing = [];
for (const t of tools) {
  const a = t.annotations || {};
  const problems = [];
  if (typeof t.title !== "string" || !t.title.trim()) problems.push("no top-level title");
  if (typeof a.title !== "string" || !a.title.trim()) problems.push("no annotations.title");
  if (t.title && a.title && t.title !== a.title) problems.push("title and annotations.title differ");
  if (t.title === t.name) problems.push("title is the raw tool name");
  for (const h of HINTS) if (typeof a[h] !== "boolean") problems.push(`${h} not set`);
  if (problems.length) missing.push(`${t.name}: ${problems.join(", ")}`);
}
check(`all ${tools.length} tools carry a title and all four hints`, missing.length === 0, missing.slice(0, 5).join("; "));

// 2. The table and the catalog are the same set, both ways.
const catalogNames = new Set(TOOLS.map((t) => t.name));
const stale = Object.keys(TOOL_ANNOTATIONS).filter((n) => !catalogNames.has(n));
check("no annotation row for a tool the catalog no longer has", stale.length === 0, stale.join(", "));

// 3. Titles: short Title Case, unique.
const badTitle = tools.filter((t) => !t.title || t.title.length > 60 || !/^[A-Z0-9(]/.test(t.title) || /_/.test(t.title)).map((t) => `${t.name}="${t.title}"`);
check("every title is short, starts upper case, and has no underscores", badTitle.length === 0, badTitle.join(", "));
const titles = tools.map((t) => t.title);
check("titles are unique", new Set(titles).size === titles.length);

// 4. Hints agree with the catalog's own read/write and destructive flags.
const disagree = [];
for (const t of TOOLS) {
  const a = byName.get(t.name)?.annotations || {};
  if (a.readOnlyHint !== !t.write) disagree.push(`${t.name}: readOnlyHint ${a.readOnlyHint} but catalog write=${Boolean(t.write)}`);
  if (t.destructive && a.destructiveHint !== true) disagree.push(`${t.name}: catalog destructive but destructiveHint ${a.destructiveHint}`);
  if (a.readOnlyHint && (a.destructiveHint || !a.idempotentHint)) disagree.push(`${t.name}: a read must be non-destructive and idempotent`);
}
check("hints agree with the catalog's write and destructive flags", disagree.length === 0, disagree.slice(0, 5).join("; "));

// 4b. Name classes the catalog flags cannot see. The catalog's `destructive`
// flag marks deletes only, so an overwrite (update, edit, a session or login
// that replaces the linked one) and a write that creates something new on every
// call (create, send, upload, publish, chat, test) need their own rules.
const NON_IDEMPOTENT = /(_create|_send|_upload|_publish|_chat|_login|_redrive|_test|_add_user)$|^twitter_create_tweet$/;
const DESTRUCTIVE = /update|edit|delete|remove|unfollow|unfavorite|unretweet|unbookmark|unpublish/;
const DESTRUCTIVE_EXACT = new Set(["twitter_customer_session", "twitter_user_login"]);
function classViolations(lookup) {
  const out = [];
  const counts = { nonIdempotent: 0, destructive: 0 };
  for (const t of TOOLS) {
    const a = lookup(t.name) || {};
    if (a.readOnlyHint) continue;
    if (NON_IDEMPOTENT.test(t.name)) {
      counts.nonIdempotent++;
      if (a.idempotentHint !== false) out.push(`${t.name}: creates on every call but idempotentHint ${a.idempotentHint}`);
    }
    if (DESTRUCTIVE.test(t.name) || DESTRUCTIVE_EXACT.has(t.name)) {
      counts.destructive++;
      if (a.destructiveHint !== true) out.push(`${t.name}: overwrites or removes but destructiveHint ${a.destructiveHint}`);
    }
  }
  return { out, counts };
}
const wireLookup = (n) => byName.get(n)?.annotations;
const real = classViolations(wireLookup);
check(`class rules cover both classes (${real.counts.nonIdempotent} non-idempotent, ${real.counts.destructive} destructive writes)`, real.counts.nonIdempotent > 0 && real.counts.destructive > 0);
check("every create/send-style write is non-idempotent and every overwrite/remove write is destructive", real.out.length === 0, real.out.slice(0, 5).join("; "));

// In-band mutation check: the class rules must fire on the two regressions the
// catalog flags miss. Each mutant must differ from the real hints, or the
// check below proves nothing.
const mutants = {
  "twitter_update_profile destructiveHint=false": ["twitter_update_profile", { destructiveHint: false }],
  "twitter_dm_send idempotentHint=true": ["twitter_dm_send", { idempotentHint: true }],
};
for (const [label, [tool, patch]] of Object.entries(mutants)) {
  const orig = wireLookup(tool);
  const mutated = { ...orig, ...patch };
  const changed = Object.keys(patch).some((k) => orig?.[k] !== mutated[k]);
  const caught = classViolations((n) => (n === tool ? mutated : wireLookup(n))).out.some((v) => v.startsWith(`${tool}:`));
  check(`class rules catch mutant ${label}`, changed && caught, changed ? "mutant passed the class rules" : "mutant did not change the hint");
}

// 5. Spot assertions: three reads, three writes (one destructive).
const expect = {
  twitter_advanced_search: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  twitter_user_info: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  twitter_account_me: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  twitter_create_tweet: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  twitter_follow_user: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  twitter_delete_tweet: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  twitter_update_avatar: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
};
for (const [name, want] of Object.entries(expect)) {
  const a = byName.get(name)?.annotations || {};
  const diff = HINTS.filter((h) => a[h] !== want[h]).map((h) => `${h}=${a[h]} want ${want[h]}`);
  check(`${name} hints`, diff.length === 0, diff.join(", "));
}
check("twitter_delete_tweet is titled Delete Tweet", byName.get("twitter_delete_tweet")?.title === "Delete Tweet");
check("twitter_advanced_search is titled Advanced Tweet Search", byName.get("twitter_advanced_search")?.title === "Advanced Tweet Search");

// 6. Fail-closed: an unclassified tool is refused, not registered with guesses.
let threw = false;
try { annotationsFor("twitter_not_a_real_tool"); } catch { threw = true; }
check("annotationsFor throws for a tool with no row", threw);
let protoThrew = false;
try { annotationsFor("toString"); } catch { protoThrew = true; }
check("annotationsFor does not resolve inherited object keys", protoThrew);

await client.close();
console.log(`\nannotations: ${passed} of ${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
