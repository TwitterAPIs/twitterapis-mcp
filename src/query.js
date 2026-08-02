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
