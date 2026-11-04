// Spec paths this package carries ahead of the docs spec, the source
// scripts/openapi-refresh.mjs vendors from.
//
// The website's public/openapi.json publishes a route before the docs site does,
// and it has a different shape (prefixed paths), so it cannot be refreshed from
// directly. Each path below was copied into test/openapi.snapshot.json by hand from
// that spec, with the /twitter prefix removed. While a path is listed:
//   - openapi-refresh keeps the vendored entry over whatever the docs spec says
//   - test/openapi-parity reads the vendored entry when the docs spec lacks the path
//
// Delete an entry once the docs spec publishes that path with the same facts. Only
// a path named here is exempt, so an unlisted gap still fails parity.
export const LEAD_PATHS = [
  // Async Grok pair, live since 2026-11-04.
  "/grok/chat/submit",
  "/grok/chat/result",
  // The docs spec still says $0.0008; billing charges $0 and the website spec says free.
  "/grok/config",
];
