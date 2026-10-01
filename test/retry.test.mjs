// retry.test.mjs: a read that lands in a deploy restart (the gateway's HTML
// 502/503/504, or a refused connection) is retried and succeeds; the API's own
// JSON errors, timeouts and writes are never retried. Measured 2026-09-29: a
// restart answers nginx's HTML "502 Bad Gateway" for about 30 to 60 seconds.
import assert from "node:assert/strict";
import { createServer as createHttp } from "node:http";
import { createServer } from "../src/server.js";

let n = 0;
const ok = (m) => { n++; console.log(`  ok  ${m}`); };

const NGINX_502 = "<html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body>\r\n<center><h1>502 Bad Gateway</h1></center>\r\n<hr><center>nginx/1.28.3 (Ubuntu)</center>\r\n</body>\r\n</html>\r\n";

function seq(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init?.method });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: () => null }, text: async () => r.body };
  };
  return { fetchImpl, calls };
}
const sleeps = [];
const server = (fetchImpl, extra = {}) =>
  createServer({ apiKey: "k", baseUrl: "https://api.test", fetchImpl, sleepImpl: async (ms) => { sleeps.push(ms); }, retryDelaysMs: [3, 8], ...extra });

{
  sleeps.length = 0;
  const { fetchImpl, calls } = seq([{ status: 502, body: NGINX_502 }, { status: 200, body: '{"user":{"id":"1"}}' }]);
  const r = await server(fetchImpl).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(r.isError, undefined);
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [3]);
  ok("a read that hits the gateway's HTML 502 is retried and returns the real answer");
}
{
  sleeps.length = 0;
  const refused = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  const { fetchImpl, calls } = seq([refused, { status: 503, body: "<!DOCTYPE html><html>503</html>" }, { status: 200, body: "{}" }]);
  const r = await server(fetchImpl).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(r.isError, undefined);
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [3, 8]);
  ok("a refused connection then an HTML 503 are both ridden out within two retries");
}
{
  sleeps.length = 0;
  const { fetchImpl, calls } = seq([{ status: 502, body: NGINX_502 }]);
  const r = await server(fetchImpl).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(r.isError, true);
  assert.equal(calls.length, 3);
  assert.match(r.content[0].text, /^HTTP 502/);
  ok("retries are bounded: after two, the gateway error is reported as before");
}
{
  sleeps.length = 0;
  const { fetchImpl, calls } = seq([{ status: 502, body: '{"error":"upstream_error","message":"X answered 500"}' }]);
  await server(fetchImpl).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(calls.length, 1);
  ok("the API's own JSON 502 is never retried (it already did the work, and may bill it)");
}
{
  sleeps.length = 0;
  const { fetchImpl, calls } = seq([{ status: 502, body: NGINX_502 }, { status: 200, body: "{}" }]);
  await server(fetchImpl).callEndpoint("/twitter/tweet/create", { text: "hi" }, "POST");
  assert.equal(calls.length, 1);
  ok("a WRITE is never retried, even through a gateway 502 (it could double-post)");
}
{
  sleeps.length = 0;
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  const { fetchImpl, calls } = seq([abort, { status: 200, body: "{}" }]);
  const r = await server(fetchImpl).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(calls.length, 1);
  assert.match(r.content[0].text, /timed out/);
  ok("a timeout is not retried (it would double the wait the user already sat through)");
}

{
  sleeps.length = 0;
  const dns = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
  const { fetchImpl, calls } = seq([dns, { status: 200, body: "{}" }]);
  const r = await server(fetchImpl).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
  assert.match(r.content[0].text, /ENOTFOUND/);
  ok("a DNS failure is not retried (it cannot fix itself) and its code is reported");
}
{
  sleeps.length = 0;
  const r = await server(fetch, { baseUrl: "http://127.0.0.1:59981" }).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(r.isError, true);
  assert.deepEqual(sleeps, [3, 8]);
  assert.match(r.content[0].text, /ECONNREFUSED/);
  ok("a REAL refused connection (closed local port) is retried twice, then reported with its code");
}
{
  sleeps.length = 0;
  const { fetchImpl, calls } = seq([{ status: 504, body: "<html>504 Gateway Time-out</html>" }]);
  await server(fetchImpl).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(calls.length, 1);
  ok("a gateway 504 is not retried (the app may already have done, and billed, the work)");
}

{
  // A REAL socket that answers 200 headers and then drops mid-body: the API has
  // already handled the request, so it must be sent exactly once.
  let hits = 0;
  const srv = createHttp((req, res) => { hits++; res.writeHead(200, { "content-length": "1000" }); res.write("{\"partial\":"); setTimeout(() => req.socket.destroy(), 20); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  sleeps.length = 0;
  const r = await server(fetch, { baseUrl: `http://127.0.0.1:${srv.address().port}` }).callEndpoint("/twitter/user/info", { username: "x" });
  srv.close();
  assert.equal(hits, 1);
  assert.deepEqual(sleeps, []);
  assert.equal(r.isError, true);
  ok("a response dropped mid-body is never re-sent (the API already handled it): exactly 1 hit");
}
{
  // Closed after the request arrived but before any headers: also possibly handled.
  let hits = 0;
  const srv = createHttp((req) => { hits++; setTimeout(() => req.socket.destroy(), 20); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  sleeps.length = 0;
  await server(fetch, { baseUrl: `http://127.0.0.1:${srv.address().port}` }).callEndpoint("/twitter/user/info", { username: "x" });
  srv.close();
  assert.equal(hits, 1);
  ok("a socket closed after the request arrived is never re-sent: exactly 1 hit");
}

{
  // The gateway's own JSON 503 during a restart (nginx error_page, 2026-09-29).
  sleeps.length = 0;
  const RESTART = '{"error":"gateway_restarting","message":"The API is restarting. Retry in a few seconds.","retry_after":10}';
  const { fetchImpl, calls } = seq([{ status: 503, body: RESTART }, { status: 200, body: '{"user":{"id":"1"}}' }]);
  const r = await server(fetchImpl).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(r.isError, undefined);
  assert.equal(calls.length, 2);
  ok("the gateway's JSON 503 gateway_restarting is retried like its HTML page");
}
{
  sleeps.length = 0;
  const { fetchImpl, calls } = seq([{ status: 503, body: '{"error":"upstream_unavailable","message":"billing is down"}' }]);
  await server(fetchImpl).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(calls.length, 1);
  const w = seq([{ status: 502, body: '{"error":"gateway_restarting"}' }]);
  await server(w.fetchImpl).callEndpoint("/twitter/user/info", { username: "x" });
  assert.equal(w.calls.length, 1);
  ok("any other JSON 503 from the API, and the restart code on a non-503, are never retried (controls)");
}
{
  // A caller that cancels during the wait between retries stops at once.
  sleeps.length = 0;
  const ac = new AbortController();
  const { fetchImpl, calls } = seq([{ status: 502, body: NGINX_502 }, { status: 200, body: "{}" }]);
  const s = createServer({ apiKey: "k", baseUrl: "https://api.test", fetchImpl, retryDelaysMs: [60_000], sleepImpl: (ms) => new Promise((res) => setTimeout(res, ms)) });
  const t0 = Date.now();
  const p = s.callEndpoint("/twitter/user/info", { username: "x" }, "GET", false, [], { signal: ac.signal });
  setTimeout(() => ac.abort(), 30);
  const r = await p;
  assert.ok(Date.now() - t0 < 5000, "cancel did not interrupt the retry wait");
  assert.equal(calls.length, 1);
  assert.match(r.content[0].text, /cancelled by the caller/);
  ok("a cancel during the retry wait stops the call: no second request, no 60s wait");
}
{
  // A cancel mid-request aborts the fetch and is reported as a cancel, not a timeout.
  // Abort only once the server HOLDS the request: a fixed 50ms timer raced the request
  // under load (the abort landed before the request arrived, so hits stayed 0).
  let hits = 0;
  const ac = new AbortController();
  const srv = createHttp(() => { hits++; setTimeout(() => ac.abort(), 20); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const p = server(fetch, { baseUrl: `http://127.0.0.1:${srv.address().port}` }).callEndpoint("/twitter/user/info", { username: "x" }, "GET", false, [], { signal: ac.signal });
  const r = await p;
  srv.closeAllConnections?.(); srv.close();
  assert.equal(hits, 1);
  assert.match(r.content[0].text, /cancelled by the caller/);
  ok("a cancel while the request is in flight aborts it and says cancelled, not timed out");
}
{
  const ac = new AbortController(); ac.abort();
  const { fetchImpl, calls } = seq([{ status: 200, body: "{}" }]);
  const r = await server(fetchImpl).callEndpoint("/twitter/user/info", { username: "x" }, "GET", false, [], { signal: ac.signal });
  assert.equal(calls.length, 0);
  assert.match(r.content[0].text, /cancelled/);
  ok("an already-cancelled call sends nothing");
}

console.log(`\nretry: ${n} passed, 0 failed`);
