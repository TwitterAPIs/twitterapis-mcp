// Pure endpoint-table builder for gen-tools.mjs, split into its own module so it
// is unit-testable against a synthetic OpenAPI `paths` object rather than only
// through the real vendored spec. This is the piece that decides which HTTP
// methods on a path exist and how a path-templated segment ({id}) becomes a
// synthesized param -- the exact logic that used to assume one method per path
// and silently drop DELETE (task #49).
//
// No file I/O, no process.exit: a caller (gen-tools.mjs for the real build, a
// test for a synthetic fixture) owns all of that.

const METHODS = new Set(["get", "post", "delete"]);

/** Path-template segments, e.g. "/monitor/{id}/health" -> ["id"]. */
export function pathParamNames(p) {
  return [...p.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
}

export const endpointKey = (p, method) => `${method} ${p}`;

/**
 * Build the (path, method) endpoint table from an OpenAPI-shaped `paths`
 * object (the same shape as `spec.paths`).
 *
 * Returns:
 *   endpoints      Map<"METHOD /path", { path, method, params: Map<name, info> }>
 *   methodsByPath  Map<"/path", Set<"METHOD">>   -- for ambiguity checks
 *
 * A path segment written `{name}` is picked up as a synthesized required
 * string param (flagged path:true) even when no formal `in: "path"` parameter
 * declares it, because this API's own spec does not declare one. A GET and a
 * DELETE (or POST and DELETE, etc) on the SAME path both get their own entry:
 * this is the fix for "the catalog assumed one verb per path".
 */
/**
 * Resolve one entry of an operation's `parameters` array. The docs SoT declares
 * its shared read parameters (`fields`, `compact`, 2026-09-23) once under
 * components.parameters and references them as `{ $ref: "#/components/
 * parameters/<name>" }` on every GET; before this, such an entry read as a
 * param named "undefined" and the build refused every read tool. Fail-closed:
 * a ref this builder cannot resolve is an error, never a silently dropped
 * param, because a param the spec has and the catalog ignores is the exact
 * drift gen-tools.mjs exists to refuse.
 */
export function resolveParam(x, components, where, depth = 0) {
  if (!x || typeof x !== "object") throw new Error(`${where}: parameter entry is not an object`);
  if (!("$ref" in x)) {
    // A resolved target with no string name would bring back the exact
    // "param named undefined" defect this resolver exists to close
    // (#/components/parameters/__proto__ resolves to {} on a plain object).
    if (typeof x.name !== "string" || !x.name) throw new Error(`${where}: parameter entry has no string name (${JSON.stringify(x).slice(0, 80)})`);
    return x;
  }
  if (depth > 8) throw new Error(`${where}: parameter $ref chain deeper than 8 (a cycle?) at ${JSON.stringify(x.$ref)}`);
  const m = /^#\/components\/parameters\/([^/]+)$/.exec(String(x.$ref));
  const target = m && Object.hasOwn(components?.parameters ?? {}, m[1]) ? components.parameters[m[1]] : undefined;
  if (!target) throw new Error(`${where}: cannot resolve parameter $ref ${JSON.stringify(x.$ref)} (vendored components.parameters lacks it; re-run openapi:refresh)`);
  return resolveParam(target, components, where, depth + 1);
}

export function buildEndpoints(paths, components = undefined) {
  const endpoints = new Map();
  const methodsByPath = new Map();

  for (const [p, ops] of Object.entries(paths || {})) {
    const pParams = pathParamNames(p);
    for (const [m, op] of Object.entries(ops || {})) {
      if (!METHODS.has(m)) continue;
      const params = new Map();
      for (const name of pParams) params.set(name, { required: true, type: "string", path: true });
      for (const raw of op.parameters || []) {
        const x = resolveParam(raw, components, `${m.toUpperCase()} ${p}`);
        params.set(x.name, {
          required: Boolean(x.required) || x.in === "path",
          type: x.schema?.type || "string",
          path: x.in === "path" || pParams.includes(x.name),
        });
      }
      const body = op.requestBody?.content?.["application/json"]?.schema;
      if (body) {
        const req = new Set(body.required || []);
        for (const [k, v] of Object.entries(body.properties || {})) {
          params.set(k, { required: req.has(k), type: v.type || "string", body: true });
        }
      }
      const method = m.toUpperCase();
      // operationId + first tag locate the endpoint's docs page:
      // https://docs.twitterapis.com/docs/reference/<tag slug>/<operationId> (112 of 112
      // verified against the docs repo, 2026-10-01).
      endpoints.set(endpointKey(p, method), { path: p, method, params, operationId: op.operationId, tag: (op.tags || [])[0] });
      if (!methodsByPath.has(p)) methodsByPath.set(p, new Set());
      methodsByPath.get(p).add(method);
    }
  }

  return { endpoints, methodsByPath };
}
