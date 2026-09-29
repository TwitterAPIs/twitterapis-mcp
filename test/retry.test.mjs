// retry.test.mjs: a read that lands in a deploy restart (the gateway's HTML
// 502/503/504, or a refused connection) is retried and succeeds; the API's own
// JSON errors, timeouts and writes are never retried. Measured 2026-09-29: a
// restart answers nginx's HTML "502 Bad Gateway" for about 30 to 60 seconds.
import assert from "node:assert/strict";
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
const server = (fetchImpl) =>
  createServer({ apiKey: "k", baseUrl: "https://api.test", fetchImpl, sleepImpl: async (ms) => { sleeps.push(ms); }, retryDelaysMs: [3, 8] });

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

console.log(`\nretry: ${n} passed, 0 failed`);
