#!/usr/bin/env node
// Unit tests for scripts/gen-tools-endpoints.mjs against a SYNTHETIC route
// table, independent of the real vendored spec. Regression test for task #49:
// the generator used to assume one HTTP method per path (silently overwriting
// one method's entry with another's) and skipped DELETE outright, which is
// exactly the shape of /twitter/monitor/{id} (POST update, DELETE remove) and
// /twitter/webhook/{id} (DELETE only). test/tools.test.mjs separately asserts
// the REAL catalog reflects this correctly; this file asserts the underlying
// table-building logic is correct in isolation, on a route table this repo did
// not happen to already have.
//
// Run: node test/gen-tools-endpoints.mjs   (wired into `npm test`)

import { buildEndpoints, pathParamNames, endpointKey } from "../scripts/gen-tools-endpoints.mjs";

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.error("  FAIL:", name); } };

// A minimal OpenAPI-shaped `paths` object with the two shapes the generator
// used to be unable to represent: a path served under two methods (one of them
// DELETE), and a DELETE-only path with a {id} path template.
const SYNTHETIC_PATHS = {
  "/widget/{id}": {
    post: {
      requestBody: {
        content: { "application/json": { schema: { type: "object", properties: { label: { type: "string" } } } } },
      },
    },
    delete: {},
  },
  "/widget": {
    get: {},
    post: {
      requestBody: {
        content: { "application/json": { schema: { type: "object", required: ["label"], properties: { label: { type: "string" } } } } },
      },
    },
  },
  "/widget/{id}/archive": {
    delete: {},
  },
};

const { endpoints, methodsByPath } = buildEndpoints(SYNTHETIC_PATHS);

// ── pathParamNames ───────────────────────────────────────────────────────────
check("pathParamNames extracts a single {name}", JSON.stringify(pathParamNames("/widget/{id}")) === JSON.stringify(["id"]));
check("pathParamNames extracts multiple segments", JSON.stringify(pathParamNames("/a/{x}/b/{y}")) === JSON.stringify(["x", "y"]));
check("pathParamNames returns [] for a plain path", JSON.stringify(pathParamNames("/widget")) === JSON.stringify([]));

// ── two methods on one path: both survive, neither overwrites the other ────
check("methodsByPath has both POST and DELETE for /widget/{id}", (() => {
  const s = methodsByPath.get("/widget/{id}");
  return s && s.size === 2 && s.has("POST") && s.has("DELETE");
})());
check("endpoints has a distinct entry for POST /widget/{id}", endpoints.has(endpointKey("/widget/{id}", "POST")));
check("endpoints has a distinct entry for DELETE /widget/{id}", endpoints.has(endpointKey("/widget/{id}", "DELETE")));
check("the two entries are not the same object (no last-write-wins overwrite)", endpoints.get(endpointKey("/widget/{id}", "POST")) !== endpoints.get(endpointKey("/widget/{id}", "DELETE")));

// ── DELETE is represented at all, not skipped ───────────────────────────────
check("DELETE-only /widget/{id}/archive is present", endpoints.has(endpointKey("/widget/{id}/archive", "DELETE")));
check("DELETE-only path's method is recorded as DELETE, not silently dropped", endpoints.get(endpointKey("/widget/{id}/archive", "DELETE")).method === "DELETE");

// ── GET + POST on one path (the pre-existing dual-method shape) still works ─
check("methodsByPath has both GET and POST for /widget", (() => {
  const s = methodsByPath.get("/widget");
  return s && s.size === 2 && s.has("GET") && s.has("POST");
})());

// ── path params are synthesized even with no formal `in: "path"` parameter ─
check("DELETE /widget/{id} synthesizes a required, path:true \"id\" param", (() => {
  const ep = endpoints.get(endpointKey("/widget/{id}", "DELETE"));
  const p = ep.params.get("id");
  return p && p.required === true && p.path === true && p.type === "string";
})());
check("POST /widget/{id} ALSO gets the synthesized id param, independent of its body fields", (() => {
  const ep = endpoints.get(endpointKey("/widget/{id}", "POST"));
  return ep.params.get("id")?.path === true && ep.params.get("label")?.body === true;
})());
check("nested {id} template (/widget/{id}/archive) is synthesized too", endpoints.get(endpointKey("/widget/{id}/archive", "DELETE")).params.get("id")?.path === true);

// ── unrecognized methods (put/patch) are ignored, same as the real generator ─
const withUnknownMethod = buildEndpoints({ "/x": { put: {}, get: {} } });
check("an unrecognized method (put) is dropped, not silently mis-tracked", !withUnknownMethod.endpoints.has(endpointKey("/x", "PUT")) && withUnknownMethod.endpoints.has(endpointKey("/x", "GET")));

// ── empty input is a no-op, not a throw ─────────────────────────────────────
check("buildEndpoints(undefined) returns empty maps rather than throwing", (() => {
  const r = buildEndpoints(undefined);
  return r.endpoints.size === 0 && r.methodsByPath.size === 0;
})());

console.log(`gen-tools-endpoints.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
