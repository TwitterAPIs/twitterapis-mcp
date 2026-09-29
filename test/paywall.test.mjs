// paywall.test.mjs: a missing key, a rejected credential, an empty balance and a
// missing X session come back as an agent-actionable payload, in the text AND as
// structuredContent. Every fake response is the SHAPE the live API sends
// (scraper/src/server/auth.ts, routes/actions.ts, read 2026-09-29).
import assert from "node:assert/strict";
import { createServer, paywallFor, classifyPaywall, SIGNUP_URL, TOP_UP_URL, API_KEYS_URL } from "../src/server.js";

let n = 0;
const ok = (m) => { n++; console.log(`  ok  ${m}`); };

function fakeFetch(status, body = "{}") {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => body,
  });
}
const call = (status, body) =>
  createServer({ apiKey: "k", baseUrl: "https://api.test", fetchImpl: fakeFetch(status, body) })
    .callEndpoint("/twitter/user/info", { username: "x" });
const payloadOf = (r) => JSON.parse(r.content[0].text.split("\n\n").pop());

{
  const s = createServer({ apiKey: undefined, baseUrl: "https://api.test", fetchImpl: fakeFetch(200) });
  const r = await s.callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /Missing TWITTERAPIS_KEY/);
  assert.equal(r.structuredContent.needs, "account");
  assert.equal(r.structuredContent.action_url, SIGNUP_URL);
  assert.deepEqual(payloadOf(r), r.structuredContent);
  ok("no key: needs=account, signup URL, same payload in text and structuredContent");
}
{
  const r = await call(401, '{"error":"unauthorized","message":"Missing or invalid x-api-key header."}');
  assert.equal(r.structuredContent.needs, "valid_key");
  assert.equal(r.structuredContent.action_url, API_KEYS_URL);
  ok("401 unauthorized (the real bad-key shape): needs=valid_key, dashboard");
}
{
  const r = await call(402, '{"error":"insufficient_credits","message":"Not enough credits for this request. Top up to continue."}');
  assert.equal(r.structuredContent.needs, "credits");
  assert.equal(r.structuredContent.action_url, TOP_UP_URL);
  assert.match(r.content[0].text, /out of credits/);
  ok("402 insufficient_credits: needs=credits, buy-credits page");
}
for (const err of ["session_required", "session_dead"]) {
  const r = await call(409, JSON.stringify({ error: err, message: "Log in first" }));
  assert.equal(r.structuredContent.needs, "x_session", err);
  assert.equal(r.structuredContent.next_tool, "twitter_user_login");
}
ok("409 session_required / session_dead: needs=x_session, next_tool=twitter_user_login");

// NEGATIVES: same statuses, different meaning, keep the ordinary text.
{
  const r = await call(409, '{"error":"session_mismatch","message":"Login resolved to a different account than requested."}');
  assert.equal(r.structuredContent, undefined);
  assert.match(r.content[0].text, /^HTTP 409/);
  ok("409 session_mismatch (a login result, not a missing session): ordinary text");
}
{
  const r = await call(401, '{"error":"unauthorized","message":"Missing x-internal-user-id."}');
  assert.equal(r.structuredContent.needs, "valid_key");
  ok("401 unauthorized from the internal path still reads as a credential problem");
}
{
  const r = await call(402, '{"error":"payment_required"}');
  assert.equal(r.structuredContent, undefined);
  ok("a 402 that is not insufficient_credits is not sold as a top-up");
}
{
  const r = await call(500, "<html>oops</html>");
  assert.equal(r.structuredContent, undefined);
  assert.match(r.content[0].text, /^HTTP 500/);
  assert.equal(classifyPaywall(500, "<html>"), null);
  assert.equal(paywallFor("nope"), null);
  ok("control: a 500 and a non-JSON body carry no paywall payload");
}
for (const u of [SIGNUP_URL, TOP_UP_URL, API_KEYS_URL]) assert.match(u, /^https:\/\/www\.twitterapis\.com\//);
ok("every paywall URL is https on www.twitterapis.com");

console.log(`\npaywall: ${n} passed, 0 failed`);
