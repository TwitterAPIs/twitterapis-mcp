// playbooks.test.mjs: the resource surface. Playbooks and tool provenance are
// read the way a client reads them, through createServer plus an in-memory MCP
// client calling resources/list, resources/templates/list and resources/read, so
// every assertion is about the bytes a client actually receives rather than the
// source module.
//
// Four things this suite is here to catch:
//   1. a playbook that names a tool the catalog does not have (a rename leaves
//      stale guidance, and a recipe pointing at a tool that does not exist is
//      worse than no recipe);
//   2. provenance derived wrongly, checked against the catalog entry itself and
//      with both controls (a pooled tool and a session tool must land on
//      different sides, or the derivation is reading nothing);
//   3. a resource that disappears from resources/list, which is how a capability
//      silently stops being advertised;
//   4. a playbook body that drifted into an empty stub.
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { PLAYBOOKS, PLAYBOOK_MIME, provenanceFor, provenanceUri, PROVENANCE_URI_TEMPLATE } from "../src/playbooks.js";
import { TOOLS } from "../src/tools.js";

let n = 0;
const ok = (m) => { n++; console.log(`  ok  ${m}`); };

async function connect(opts = {}) {
  const { server } = createServer({ apiKey: "playbooks-test", ...opts });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "playbooks-test", version: "0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}

const client = await connect();

// ── resources/list ───────────────────────────────────────────────────────────
{
  const { resources } = await client.listResources();
  const uris = resources.map((r) => r.uri);
  assert.deepEqual(uris, PLAYBOOKS.map((p) => p.uri), "resources/list must carry every playbook, in order");
  assert.equal(resources.length, 5);
  ok(`resources/list carries all ${resources.length} playbooks`);

  for (const r of resources) {
    assert.ok(r.description && r.description.length > 80, `${r.uri} needs a real description`);
    assert.equal(r.mimeType, PLAYBOOK_MIME);
    assert.ok(r.title, `${r.uri} needs a title`);
  }
  ok("every listed playbook carries a title, a markdown mime type and a description");

  // A client lists resource descriptions beside tool descriptions, so they are
  // held to the same Connectors Directory attestation: product facts only, and in
  // particular no other tool's name. The BODY is exempt (it is fetched by name,
  // never listed), which is the whole reason the recipes live there.
  for (const r of resources) {
    const named = [...r.description.matchAll(/\btwitter_[a-z0-9_]+\b/g)].map((m) => m[0]);
    assert.deepEqual(named, [], `${r.uri} description names tools: ${named.join(", ")}`);
  }
  ok("no listed resource description names a tool (the Connectors Directory attestation)");
}

// ── resources/templates/list ─────────────────────────────────────────────────
{
  const { resourceTemplates } = await client.listResourceTemplates();
  const found = resourceTemplates.find((t) => t.uriTemplate === PROVENANCE_URI_TEMPLATE);
  assert.ok(found, `provenance template missing; got ${resourceTemplates.map((t) => t.uriTemplate).join(", ")}`);
  assert.equal(found.mimeType, "application/json");
  ok("resources/templates/list advertises the provenance template");

  // The template must NOT expand into resources/list, or one entry per tool would
  // bury the five playbooks under 112 rows.
  const { resources } = await client.listResources();
  assert.ok(!resources.some((r) => r.uri.startsWith("provenance://")), "provenance must not expand into resources/list");
  ok("the provenance template stays out of resources/list");
}

// ── playbook bodies ──────────────────────────────────────────────────────────
{
  const names = new Set(TOOLS.map((t) => t.name));
  const uris = new Set(PLAYBOOKS.map((p) => p.uri));
  let totalNamed = 0;
  for (const p of PLAYBOOKS) {
    const { contents } = await client.readResource({ uri: p.uri });
    assert.equal(contents.length, 1);
    assert.equal(contents[0].uri, p.uri);
    assert.equal(contents[0].mimeType, PLAYBOOK_MIME);
    const text = contents[0].text;
    assert.ok(text.length > 800, `${p.uri} body is ${text.length} bytes; a stub, not a playbook`);
    assert.match(text, /^# /, `${p.uri} body must open with a heading`);

    // Every tool a playbook names has to exist, or the recipe sends an agent at
    // a tool that is not there.
    const named = [...new Set([...text.matchAll(/\btwitter_[a-z0-9_]+\b/g)].map((m) => m[0]))];
    totalNamed += named.length;
    const stale = named.filter((t) => !names.has(t));
    assert.deepEqual(stale, [], `${p.uri} names tools that do not exist: ${stale.join(", ")}`);

    // Same for a playbook pointing at another playbook.
    const linked = [...new Set([...text.matchAll(/playbook:\/\/[a-z-]+/g)].map((m) => m[0]))];
    const danglingLinks = linked.filter((u) => !uris.has(u));
    assert.deepEqual(danglingLinks, [], `${p.uri} links playbooks that do not exist: ${danglingLinks.join(", ")}`);

    // Hidden text is the same hazard here as in a tool description.
    // The `u` flag is load-bearing: without it 0 parses as  followed
    // by a literal "0", which builds a range covering most of the BMP and flags
    // ordinary prose. Tag characters need the \u{...} form.
    assert.doesNotMatch(text, /[​-‏‪-‮⁠-⁤﻿]|[\u{E0000}-\u{E007F}]/u, `${p.uri} carries invisible characters`);
  }
  ok(`every playbook body is substantive, opens with a heading and carries no hidden text`);
  ok(`all ${totalNamed} tool names across the 5 playbook bodies resolve in the catalog`);

  // NEGATIVE CONTROL: the stale-name check must be able to fire at all.
  const planted = "twitter_this_tool_does_not_exist";
  assert.equal(names.has(planted), false, "control name must not be a real tool");
  const plantedStale = [planted].filter((t) => !names.has(t));
  assert.deepEqual(plantedStale, [planted], "the stale-name filter did not flag a planted miss");
  ok("negative control: a planted non-existent tool name is caught by the same filter");
}

// ── every identifier a playbook quotes must exist in the catalog ─────────────
// The stale-TOOL-name check above cannot see a tool that exists but does not do
// what the recipe says, and that is the defect class that actually shipped: a
// first draft told an agent to read `stream_liveness` and `coverage_24h` off a
// health response and to check a `listing_status` on a cursor. All three are
// field names from a different product. The tools were real, so the name check
// was green, and an agent following the recipe would have read undefined.
//
// So: every snake_case identifier a playbook quotes in backticks has to appear
// somewhere in the catalog, as a tool name, an argument name, or a word in a
// tool's own description. An invented field matches none of the three.
{
  const corpus = [
    ...TOOLS.map((t) => t.name),
    ...TOOLS.flatMap((t) => Object.keys(t.shape || {})),
    ...TOOLS.map((t) => t.description || ""),
  ].join("\n");
  const SNAKE = /`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g;
  const unknown = new Map();
  let checked = 0;
  for (const p of PLAYBOOKS) {
    for (const m of p.text.matchAll(SNAKE)) {
      checked++;
      if (!corpus.includes(m[1])) unknown.set(m[1], p.uri);
    }
  }
  assert.equal(unknown.size, 0, `playbooks quote identifiers the catalog never mentions: ${[...unknown].map(([k, v]) => `${k} (${v})`).join(", ")}`);
  assert.ok(checked > 20, `only ${checked} identifiers checked; the matcher is not reading the bodies`);
  ok(`all ${checked} quoted snake_case identifiers across the playbooks appear in the catalog`);

  // NEGATIVE CONTROL: the corpus must not swallow a plausible invented field.
  for (const planted of ["stream_liveness", "coverage_24h", "listing_status"]) {
    assert.equal(corpus.includes(planted), false, `control "${planted}" must not be in the catalog`);
  }
  // POSITIVE CONTROL: a real field the playbooks do quote.
  assert.ok(corpus.includes("last_tweet_id"), "control: a real field must be found in the corpus");
  ok("controls: three plausible invented field names are absent from the corpus, a real one is present");
}

// ── a playbook may not send an argument a tool does not take ─────────────────
{
  // The monitor is handle-driven. A recipe offering it a keyword is the same
  // class of defect: a real tool, called with something it cannot accept.
  const monitor = TOOLS.find((t) => t.name === "twitter_monitor_create");
  const args = Object.keys(monitor.shape);
  assert.ok(args.includes("handle"), "monitor creation must take a handle");
  assert.deepEqual(args.filter((a) => /keyword|query|term|search/.test(a)), [], `monitor creation now takes ${args.join(",")}; the launch playbook's wording needs revisiting`);
  const launch = PLAYBOOKS.find((p) => p.uri === "playbook://launch-day-monitor").text;
  assert.match(launch, /on the HANDLE you are launching from/, "the launch playbook must say the monitor takes a handle");
  ok("the launch playbook's monitor step matches the tool's real argument shape");
}

// ── the linking playbook carries the facts the 409 cannot ────────────────────
{
  const { contents } = await client.readResource({ uri: "playbook://link-x-account" });
  const text = contents[0].text;
  for (const fact of ["twitter_customer_session_status", "twitter_customer_session", "twitter_user_login", "120", "totp_secret"]) {
    assert.ok(text.includes(fact), `the linking playbook must state "${fact}"`);
  }
  ok("the linking playbook states the status read, both link routes, the 120s ceiling and the up-front 2FA secret");
}

// ── the egress playbook describes only what the API actually takes ───────────
{
  const { contents } = await client.readResource({ uri: "playbook://residential-egress" });
  const text = contents[0].text;
  assert.ok(text.includes("There is no install step"), "the egress playbook must say plainly that there is no install step");
  // The three real attachment points, each proved against the catalog rather
  // than asserted in prose.
  const sessionTool = TOOLS.find((t) => t.name === "twitter_customer_session");
  const loginTool = TOOLS.find((t) => t.name === "twitter_user_login");
  assert.ok(Object.keys(sessionTool.shape).includes("proxy_url"), "session registration must take proxy_url");
  assert.ok(Object.keys(loginTool.shape).includes("proxy_url"), "login must take proxy_url");
  const perCall = TOOLS.filter((t) => (t.headerArgs || []).includes("proxy_url"));
  assert.ok(perCall.length > 0, "some tools must take a per-call proxy_url header");
  assert.ok(text.includes(String(perCall.length)), `the egress playbook must state the real per-call tool count (${perCall.length})`);
  ok(`the egress playbook's three attachment points all exist in the catalog (per-call on ${perCall.length} tools)`);
}

// ── provenance ───────────────────────────────────────────────────────────────
{
  // A pooled read and a session read must land on opposite sides. One of these
  // passing alone would prove nothing about the derivation.
  const pooled = await client.readResource({ uri: provenanceUri("twitter_advanced_search") });
  const pooledRec = JSON.parse(pooled.contents[0].text);
  assert.equal(pooledRec.tool, "twitter_advanced_search");
  assert.equal(pooledRec.endpoint, "GET /twitter/tweet/advanced_search");
  assert.equal(pooledRec.kind, "read");
  assert.equal(pooledRec.served_by, "the service's shared account pool");

  const session = await client.readResource({ uri: provenanceUri("twitter_home_timeline") });
  const sessionRec = JSON.parse(session.contents[0].text);
  assert.equal(sessionRec.served_by, "the caller's linked X account");
  assert.notEqual(sessionRec.served_by, pooledRec.served_by);
  ok("provenance: a pooled read and a session read are classified differently (both controls)");

  const write = JSON.parse((await client.readResource({ uri: provenanceUri("twitter_delete_tweet") })).contents[0].text);
  assert.equal(write.kind, "write");
  assert.equal(write.destructive, true);
  ok("provenance: a destructive write reports kind=write and destructive=true");

  const free = JSON.parse((await client.readResource({ uri: provenanceUri("twitter_account_me") })).contents[0].text);
  assert.equal(free.cost, "free");
  assert.match(pooledRec.cost, /^\$\d/, "a priced tool must report a dollar cost");
  ok("provenance: a free tool reads free and a priced tool reads its price");

  // THE UNIT IS PART OF THE PRICE. Three tools bill "per billed item", and a
  // batch call answers up to 100 items, so relabelling the unit "per call"
  // understated one call by up to 100x on a field called provenance. Asserting
  // only that the cost is not "unstated" could not see it, which is how it
  // shipped into review. Every tool's reported cost must carry its own unit.
  const unitMismatch = [];
  const perItem = [];
  for (const t of TOOLS) {
    const m = /\bCost: (Free|\$\d+(?:\.\d+)?)([^.]*)\./.exec(t.description || "");
    assert.ok(m, `${t.name} has no parseable cost sentence`);
    const reported = provenanceFor(t.name, TOOLS).cost;
    const expected = m[1] === "Free" ? "free" : `${m[1]}${m[2].trim() ? ` ${m[2].trim()}` : ""}`;
    if (reported !== expected) unitMismatch.push(`${t.name}: ${reported} != ${expected}`);
    if (/per billed item/.test(m[2])) perItem.push(t.name);
  }
  assert.deepEqual(unitMismatch, [], `cost unit misreported: ${unitMismatch.join("; ")}`);
  // Both controls: the catalog really does bill two ways, so a harness that
  // only ever saw "per call" would pass this vacuously.
  assert.ok(perItem.length > 0, "no per-billed-item tool found; the unit check has nothing to distinguish");
  for (const name of perItem) {
    assert.match(provenanceFor(name, TOOLS).cost, /per billed item$/, `${name} must report its real unit`);
  }
  ok(`provenance: every one of ${TOOLS.length} tools reports its own cost unit, including the ${perItem.length} billed per item`);

  // A tool whose own payload IS the X credential establishes the link; it must
  // not be filed under the shared pool just because it takes no header args.
  for (const name of ["twitter_customer_session", "twitter_user_login"]) {
    const rec = provenanceFor(name, TOOLS);
    assert.match(rec.served_by, /supplied in this call/, `${name} establishes the session; it is not pooled`);
    assert.equal((TOOLS.find((t) => t.name === name).headerArgs || []).length, 0, `${name} is expected to carry no headerArgs, which is why it needs the explicit case`);
  }
  ok("provenance: the two session-establishing tools are classified by what they do, not by their empty headerArgs");

  // Derivation agrees with the catalog for EVERY tool, not just the sampled four.
  let mismatches = 0;
  for (const t of TOOLS) {
    const rec = provenanceFor(t.name, TOOLS);
    if (!rec) { mismatches++; continue; }
    if (rec.endpoint !== `${t.method || "GET"} ${t.path}`) mismatches++;
    if (rec.kind !== (t.write ? "write" : "read")) mismatches++;
    if (rec.cost === "unstated" || rec.docs === null) mismatches++;
  }
  assert.equal(mismatches, 0, `${mismatches} provenance records disagree with the catalog`);
  ok(`provenance derives cleanly for all ${TOOLS.length} tools (endpoint, kind, cost and docs all resolved)`);

  // An unknown tool is an error, not an empty record that reads as "no provenance".
  await assert.rejects(
    () => client.readResource({ uri: provenanceUri("twitter_not_a_tool") }),
    /No tool named/,
    "an unknown tool must fail loudly",
  );
  assert.equal(provenanceFor("twitter_not_a_tool", TOOLS), null);
  ok("provenance: an unknown tool name is refused rather than answered with an empty record");
}

// ── the hosted mode serves the same resources ────────────────────────────────
{
  const hosted = await connect({ inlineCredentials: false });
  const { resources } = await hosted.listResources();
  assert.equal(resources.length, PLAYBOOKS.length);
  const rec = JSON.parse((await hosted.readResource({ uri: provenanceUri("twitter_home_timeline") })).contents[0].text);
  // Hiding the per-call credential ARGS must not change what the API does with
  // the call: a session tool is still served by the caller's linked account.
  assert.equal(rec.served_by, "the caller's linked X account");
  await hosted.close();
  ok("the hosted mode (inlineCredentials:false) serves the same resources and the same provenance");
}

await client.close();

console.log(`\nplaybooks: ${n} passed, 0 failed`);
