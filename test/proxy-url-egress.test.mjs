// proxy_url is EGRESS, not a credential, so it must travel without the cookie pair.
//
// THE DEFECT THIS PINS (feedback b9bc1db5). proxy_url was destructured off the
// outgoing args, so it could not travel as a query param, and the x-proxy-url
// header was only set INSIDE the `auth_token && ct0` branch. A caller who sent
// proxy_url alone therefore got a normal 200 answered over the DEFAULT egress,
// with nothing in the response saying their proxy had been dropped. Accepted,
// validated, silently discarded.
//
// Every case here drives the SHIPPED createServer with a fetchImpl that captures
// the real outgoing headers. Nothing asserts that a source file contains a
// string.

import assert from "node:assert";
import { createServer } from "../src/server.js";

let n = 0;
const ok = (m) => { n++; console.log(`  ok  ${m}`); };

/** Call a tool through the shipped server and return the headers it actually sent. */
async function headersFor(toolName, args) {
  let seen = null;
  const fetchImpl = async (_url, init) => {
    seen = init?.headers || {};
    return new Response(JSON.stringify({ data: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const { server } = createServer({ apiKey: "k", fetchImpl, retryDelaysMs: [] });
  const tool = server._registeredTools[toolName];
  assert.ok(tool, `tool ${toolName} is not registered`);
  await tool.handler(args, {});
  assert.ok(seen, "fetchImpl was never called, so no headers were captured");
  return seen;
}

const PROXY = "http://user:pw@proxy.example.com:8080";

// THE FIXTURE MUST DECLARE THE PARAMETER. The first version of this file drove a
// tool with NO headerArgs at all, so every case proved callEndpoint's header
// logic against a tool that cannot receive proxy_url and could never deliver it
// from a real client (zod strips unknown keys). It was a fixture that made the
// suite look green about the 49 tools it never touched. twitter_bookmarks
// declares headerArgs ["auth_token","ct0","proxy_url","user_agent"], so this
// exercises a tool that genuinely exposes the parameter.
const READ_TOOL = "twitter_bookmarks";

(async () => {
  // THE CASE THAT WAS BROKEN. proxy_url alone, no cookies.
  const alone = await headersFor(READ_TOOL, { proxy_url: PROXY });
  assert.strictEqual(
    alone["x-proxy-url"],
    PROXY,
    `proxy_url sent alone was dropped. Headers: ${JSON.stringify(Object.keys(alone))}`,
  );
  assert.strictEqual(alone["x-auth-token"], undefined, "a credential header appeared with no credential supplied");
  assert.strictEqual(alone["x-ct0"], undefined, "a credential header appeared with no credential supplied");
  ok("proxy_url travels WITHOUT the cookie pair (the reported defect)");

  // THE CASE THAT ALREADY WORKED must not regress.
  const withCookies = await headersFor(READ_TOOL, { proxy_url: PROXY,
    auth_token: "a",
    ct0: "c",
  });
  assert.strictEqual(withCookies["x-proxy-url"], PROXY, "proxy_url was lost when cookies WERE supplied");
  assert.strictEqual(withCookies["x-auth-token"], "a");
  assert.strictEqual(withCookies["x-ct0"], "c");
  ok("proxy_url still travels alongside the cookie pair (no regression)");

  // NEGATIVE CONTROL. Without this, both cases above would also pass if the
  // header were set unconditionally to a constant.
  const none = await headersFor(READ_TOOL, {});
  assert.strictEqual(
    none["x-proxy-url"],
    undefined,
    "x-proxy-url was sent when the caller supplied no proxy_url",
  );
  ok("no x-proxy-url header when the caller supplied none (negative control)");

  // THE CREDENTIAL PAIR IS STILL ALL-OR-NOTHING. Loosening proxy must not have
  // loosened the cookies: a half-supplied session is not a session.
  const halfCreds = await headersFor(READ_TOOL, { auth_token: "a" });
  assert.strictEqual(halfCreds["x-auth-token"], undefined, "auth_token travelled without ct0");
  assert.strictEqual(halfCreds["x-ct0"], undefined, "a ct0 header appeared from nowhere");
  ok("auth_token without ct0 still sends NO credential headers (the pair stays all-or-nothing)");

  // proxy_url MUST NOT LEAK INTO THE QUERY STRING. It carries a password in the
  // usual form, and a query param lands in URLs and access logs.
  let sawUrl = null;
  const fetchImpl = async (url, init) => {
    sawUrl = String(url);
    return new Response(JSON.stringify({ data: "ok" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const { server } = createServer({ apiKey: "k", fetchImpl, retryDelaysMs: [] });
  await server._registeredTools[READ_TOOL].handler({ proxy_url: PROXY }, {});
  assert.ok(sawUrl, "no URL captured");
  assert.ok(!sawUrl.includes("proxy"), `proxy_url leaked into the query string: ${sawUrl}`);
  assert.ok(!sawUrl.includes("pw"), `the proxy password leaked into the query string: ${sawUrl}`);
  ok("proxy_url never reaches the query string (it carries a password)");

  console.log(`\nproxy-url-egress: ${n} of 5 checks passed`);
  process.exit(n === 5 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
