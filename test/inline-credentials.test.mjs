// createServer({ inlineCredentials: false }) hides the per-call X session args on a hosted,
// directory-listed server (feedback 538e90b5), without touching twitter_customer_session,
// whose own payload IS the credentials. Every tool also names its docs page.
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import { TOOLS } from "../src/tools.js";

const keys = (t) => Object.keys((t.inputSchema && t.inputSchema.shape) || t.inputSchema || {});
const open = createServer({ apiKey: "k" }).server._registeredTools;
let calls = [];
const fakeFetch = async (url, init) => { calls.push({ url: String(url), headers: init?.headers || {} }); return new Response("{}", { status: 200 }); };
const hosted = createServer({ apiKey: "k", inlineCredentials: false, fetchImpl: fakeFetch, retryDelaysMs: [] }).server._registeredTools;
let n = 0;
const ok = (m) => { n++; console.log(`  ok   ${m}`); };

const withCreds = TOOLS.filter((t) => t.headerArgs && t.headerArgs.length);
assert.ok(withCreds.length >= 40, `only ${withCreds.length} tools declare headerArgs`);
ok(`${withCreds.length} tools declare headerArgs`);

assert.ok(keys(open.twitter_delete_tweet).includes("ct0"), "default server must keep per-call creds");
ok("default server keeps auth_token/ct0 (npm stdio users unaffected)");

const leaking = Object.entries(hosted).filter(([, t]) => keys(t).includes("ct0") || keys(t).includes("auth_token")).map(([name]) => name);
assert.deepEqual(leaking, ["twitter_customer_session"]);
ok("hosted server: only twitter_customer_session still takes auth_token/ct0");

calls = [];
await hosted.twitter_delete_tweet.handler({ tweet_id: "1", auth_token: "SMUGGLED", ct0: "SMUGGLED" }, {});
assert.equal(calls.length, 1);
assert.ok(!JSON.stringify(calls[0]).includes("SMUGGLED"), "a smuggled cookie must not reach the request");
ok("hosted server drops smuggled cookies a client sends anyway");

assert.ok(!hosted.twitter_customer_session.description.includes("per-call without registering"));
ok("hosted customer_session description no longer promises per-call creds");

const noDocs = TOOLS.filter((t) => !/Docs: https:\/\/docs\.twitterapis\.com\/docs\/reference\/[a-z0-9-]+\/[a-z0-9-]+$/.test(t.description)).map((t) => t.name);
assert.deepEqual(noDocs, []);
ok(`all ${TOOLS.length} tool descriptions end with their docs page`);

console.log(`inline-credentials: ${n} passed, 0 failed`);
