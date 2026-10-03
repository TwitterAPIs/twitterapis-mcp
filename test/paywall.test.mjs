// paywall.test.mjs: a missing key, a rejected credential, an empty balance and a
// missing X session come back as an agent-actionable payload, in the text AND as
// structuredContent. Every fake response is the SHAPE the live API sends
// (scraper/src/server/auth.ts, routes/actions.ts, read 2026-09-29).
import assert from "node:assert/strict";
import { createServer, paywallFor, classifyPaywall, SIGNUP_URL, TOP_UP_URL, API_KEYS_URL } from "../src/server.js";
import { TOOLS } from "../src/tools.js";
import { PLAYBOOKS } from "../src/playbooks.js";

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
{
  const r = await call(409, '{"error":"session_required","message":"Log in first: POST /twitter/user/user_login"}');
  assert.equal(r.structuredContent.needs, "x_session");
  assert.equal(r.structuredContent.next_tool, "twitter_user_login");
  ok("409 session_required (no linked session): needs=x_session, next_tool=twitter_user_login");
}
{
  // The live dead-session shape is a 401, and must NOT read as a bad API key.
  const r = await call(401, '{"error":"session_dead","message":"Your session is no longer valid. Re-login.","action":"like","target_id":"1"}');
  assert.equal(r.structuredContent.needs, "x_session");
  assert.match(r.content[0].text, /re-link/);
  ok("401 session_dead (expired X session, the real shape): needs=x_session, not valid_key");
}

// NEGATIVES: same statuses, different meaning, keep the ordinary text.
{
  const r = await call(409, '{"error":"session_mismatch","message":"Login resolved to a different account than requested."}');
  assert.equal(r.structuredContent, undefined);
  assert.match(r.content[0].text, /^HTTP 409/);
  ok("409 session_mismatch (a login result, not a missing session): ordinary text");
}
{
  const r = await call(401, '{"error":"unauthorized","message":"Missing x-internal-user-id."}');
  assert.equal(r.structuredContent, undefined);
  ok("401 about the internal headers (a server wiring fault) is not blamed on the user's key");
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

// ── The block is a sequence, not a sentence ──────────────────────────────────
// Each payload has to say what to do NEXT, in order, with tools this catalog
// actually has. A step naming a tool that does not exist is worse than no step.
{
  const names = new Set(TOOLS.map((t) => t.name));
  for (const kind of ["no_key", "bad_key", "credits", "x_session"]) {
    const p = paywallFor(kind);
    assert.ok(Array.isArray(p.steps) && p.steps.length >= 3, `${kind} needs an ordered step list`);
    const numbers = p.steps.map((s) => s.step);
    assert.deepEqual([...numbers].sort((a, b) => a - b), numbers, `${kind} steps are out of order`);
    assert.equal(numbers[0], 1, `${kind} steps must start at 1`);
    for (const s of p.steps) {
      assert.ok(s.what, `${kind} step ${s.step} has no action`);
      if (s.tool) assert.ok(names.has(s.tool), `${kind} step ${s.step} names ${s.tool}, which is not a tool`);
      if (s.where) assert.match(s.where, /^https:\/\/www\.twitterapis\.com\//, `${kind} step ${s.step} links off-site`);
    }
    assert.match(p.steps[p.steps.length - 1].what, /retry this call/, `${kind} must end by retrying`);
  }
  ok("every paywall payload carries an ordered step list that ends in a retry, naming only real tools and our own URLs");
}
{
  const p = paywallFor("x_session");
  // The state this payload could not previously express: a dead session is
  // filtered out of the lookup, so it fails exactly like one that never existed,
  // and only the status read tells them apart. If step 1 ever stops being that
  // read, an agent is back to guessing.
  assert.equal(p.steps[0].tool, "twitter_customer_session_status");
  assert.match(p.steps[0].note, /never linked/);
  assert.match(p.steps[0].note, /dead/);
  const linkTools = p.steps.filter((s) => s.step === 2).map((s) => s.tool);
  assert.deepEqual(linkTools.sort(), ["twitter_customer_session", "twitter_user_login"]);
  // The timing trap: a 120s server-side login against a 30s default call timeout.
  const loginStep = p.steps.find((s) => s.tool === "twitter_user_login");
  assert.match(loginStep.note, /120s/);
  assert.match(loginStep.note, /30s/);
  assert.match(loginStep.note, /totp_secret/);
  // Step 2 has two alternatives, so index 2 is still a linking route; find the
  // confirm step by its number rather than by position.
  const confirm = p.steps.find((s) => s.step === 3);
  assert.equal(confirm.tool, "twitter_customer_session_status", "the flow must confirm before retrying");
  assert.match(confirm.note, /timeout/, "the confirm step must cover the client-side timeout case");
  assert.ok(p.cannot_retry.length > 40, "the endings a retry cannot fix must be named");
  assert.equal(p.playbook, "playbook://link-x-account");
  assert.ok(PLAYBOOKS.some((pb) => pb.uri === p.playbook), "the linked playbook must exist");
  ok("x_session walks the link: read state, pick a route, confirm, retry, with the 120s-vs-30s trap and the endings a retry cannot fix");
}
{
  // Progressive tier: what resolving the block makes available.
  for (const kind of ["no_key", "credits", "x_session"]) {
    const p = paywallFor(kind);
    assert.ok(p.unlocks && p.unlocks.length > 30, `${kind} must say what it unlocks`);
  }
  assert.match(paywallFor("credits").unlocks, /free/, "a zero balance must say which tools still work");
  assert.ok(TOOLS.some((t) => t.name === paywallFor("credits").history_tool));
  assert.match(paywallFor("x_session").unlocks, /home timeline/);
  ok("each resolvable block states what it unlocks next, and the credits payload names a real history tool");
}
{
  // CONTROL: the step list is reachable by a client, not just by this test
  // importing the function. It has to survive the text/structuredContent split.
  const r = await call(409, '{"error":"session_required","message":"Log in first."}');
  assert.equal(r.structuredContent.steps.length, paywallFor("x_session").steps.length);
  assert.deepEqual(payloadOf(r), r.structuredContent);
  assert.match(r.content[0].text, /twitter_customer_session_status/);
  ok("control: the step list reaches a caller in both the text and structuredContent of a real 409");
}

// ── PUBLISHED NUMBERS ARE PINNED TO THE CATALOG ────────────────────────────
// A review mutated the login price from one cent to nine dollars in two
// published strings, and changed the pooled count by a factor of 100, and this
// suite stayed green on all of it. The only assertions touching `unlocks` were a
// length floor and two word regexes, neither of which can see a number.
//
// It also found a real defect of exactly that class shipping: the payload called
// the pooled TOOL count a count of pooled READS, which overstated the buyer
// facing number by the 13 free writes and then listed those same writes again.
//
// These cases derive every expected value from TOOLS, so they follow the catalog
// instead of restating today's value of it. A literal here would stop testing
// the moment the catalog moved, which is the failure this is meant to prevent.
{
  const pooled = TOOLS.filter((t) => !t.headerArgs || t.headerArgs.length === 0);
  const reads = pooled.filter((t) => !t.write).length;
  const freeWrites = pooled.filter((t) => t.write).length;
  const sessionTools = TOOLS.filter((t) => (t.headerArgs || []).includes("auth_token")).length;
  const u = paywallFor("no_key").unlocks;

  assert.ok(
    u.includes(`the ${reads} pooled reads`),
    `unlocks must state the derived pooled READ count (${reads}), not the tool count. Got: ${u}`,
  );
  assert.ok(
    u.includes(`${freeWrites} free account, monitoring and feedback tools`),
    `unlocks must state the derived free-write count (${freeWrites}). Got: ${u}`,
  );
  assert.ok(
    u.includes(`The ${sessionTools} account tools`),
    `unlocks must state the derived session-tool count (${sessionTools}). Got: ${u}`,
  );
  // THE NUMBERS MUST NOT COLLIDE, or a wrong one could satisfy the right assert.
  assert.ok(reads !== pooled.length, "a read count equal to the pooled count would make this test blind");
  assert.ok(reads + freeWrites === pooled.length, `reads + free writes must account for every pooled tool: ${reads} + ${freeWrites} != ${pooled.length}`);
  ok("the unlocks sentence states catalog-derived counts, and reads exclude the free writes");
}

console.log(`\npaywall: ${n} passed, 0 failed`);
