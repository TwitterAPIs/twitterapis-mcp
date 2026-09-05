// Query-string builder for @twitterapis/mcp.
//
// Hand-written logic, deliberately kept out of src/tools.js: that file is
// generated from the vendored openapi spec plus scripts/tools.overrides.mjs, and
// a generated file should contain no behaviour a reviewer has to read. It is
// re-exported from src/tools.js so callers keep a single import path.

// Drops undefined/null/empty values, URL-encodes the rest. A dumb stringifier,
// not a validator: Zod has already validated by the time args reach here.
export function buildQuery(args) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(args || {})) {
    if (v !== undefined && v !== null && String(v).length > 0) qs.set(k, String(v));
  }
  return qs.toString();
}

// Thrown by resolvePathParams when a tool's pathParams arg is missing/empty. The
// caller decides how to surface it (index.js turns it into an MCP tool error);
// this module stays a pure mechanical helper with no knowledge of MCP shapes.
export class MissingPathParamError extends Error {
  constructor(name, path) {
    super(`Missing required path parameter "${name}" for ${path}.`);
    this.name = "MissingPathParamError";
    this.paramName = name;
  }
}

// Substitutes {name} URL-template segments (e.g. "/monitor/{id}") from `args`,
// for the handful of REST endpoints that carry a path parameter instead of a
// query/body one (monitor/webhook CRUD by id). Returns the resolved path plus
// args with every consumed key REMOVED, so a pathParams arg never also leaks
// into the query string or JSON body downstream. Throws MissingPathParamError
// rather than silently shipping a request that still contains the literal
// "{id}" against the API.
export function resolvePathParams(path, pathParams, args) {
  const rest = { ...(args || {}) };
  let resolved = path;
  for (const name of pathParams || []) {
    const value = rest[name];
    delete rest[name];
    if (value === undefined || value === null || value === "") {
      throw new MissingPathParamError(name, path);
    }
    resolved = resolved.replace(`{${name}}`, encodeURIComponent(String(value)));
  }
  return { path: resolved, args: rest };
}
