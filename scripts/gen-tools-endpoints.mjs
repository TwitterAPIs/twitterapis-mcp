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
export function buildEndpoints(paths) {
  const endpoints = new Map();
  const methodsByPath = new Map();

  for (const [p, ops] of Object.entries(paths || {})) {
    const pParams = pathParamNames(p);
    for (const [m, op] of Object.entries(ops || {})) {
      if (!METHODS.has(m)) continue;
      const params = new Map();
      for (const name of pParams) params.set(name, { required: true, type: "string", path: true });
      for (const x of op.parameters || []) {
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
      endpoints.set(endpointKey(p, method), { path: p, method, params });
      if (!methodsByPath.has(p)) methodsByPath.set(p, new Set());
      methodsByPath.get(p).add(method);
    }
  }

  return { endpoints, methodsByPath };
}
