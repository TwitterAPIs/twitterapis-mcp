# Changelog

## 0.22.1 (2026-10-02)

### Changed

- **Feedback reports no longer ask for the user's words.** `twitter_feedback_send` `details` is
  three bullets (What happened, Repro, Evidence), optionally after a one-line summary of the goal,
  and the server instructions say the same: no quote of the conversation is collected, per the
  Connectors Directory rule against extraneous conversation data.
- **The description gate refuses conversation-data asks** (what the user said, verbatim user
  words) in descriptions and instructions, and now also sees bare hosts, backslash authorities,
  emails, IP addresses and javascript:/data: schemes.

## 0.22.0 (2026-10-02)

### Changed

- **Tool and parameter descriptions state product facts only.** Every description now says
  what the tool returns, takes and costs, and nothing else: no instructions to the model
  (should, never, always, ask the user, use X instead), no other tool's name, and no hidden
  or encoded text, as the Claude Connectors Directory requires. Tool names, parameters,
  schemas, annotations and behaviour are unchanged.
- **Guidance moved into the server instructions.** Which tool to pick, how one tool's output
  feeds another (user_id, conversation_id, woeid, media_id), the confirm-before-publishing
  rule for articles and the feedback-drafting policy now live in the MCP `instructions`
  string, which the client hands its model alongside the tool list. It is held to 2048
  characters (Claude Code truncates past that), with the feedback consent rule first.
- **Every description states its cost** (`Cost: $0.0008 per call.`, `... per billed item.`
  or `Free per call.`), derived from the spec's `x-cost-usd` and its billing unit, never
  hand-typed; the build fails if the two disagree.
- `twitter_grok_chat` says plainly that its reply is text and JSON only, with no image field,
  and `image_count` says a generated image is not returned.

### Added

- **`test/description-compliance.mjs`** (in `npm test`, or `npm run check:description-compliance`).
  Lists every tool through `createServer` and an in-memory MCP client, in both the stdio and
  hosted (`inlineCredentials: false`) modes, and fails on any tool or parameter description
  that names another tool, matches a model-instruction pattern, or carries zero-width, bidi
  or encoded text, or links to any host other than twitterapis.com and its docs host. It also
  checks that the server instructions name only real tools, fit 2048 characters in both
  modes, and carry the send-consent and no-secrets rules inside that window.

## 0.21.1 (2026-10-01)

### Changed

- **Every tool description ends with its docs page** (`Docs: https://docs.twitterapis.com/docs/reference/<tag>/<operationId>`),
  derived from the OpenAPI spec by the generator, never hand-typed. All 112 URLs verified live.

### Added

- **`createServer({ inlineCredentials: false })`.** Hides the per-call X session args
  (auth_token, ct0, proxy_url, user_agent) from every tool on a hosted, directory-listed
  server, and drops them from calls even if a client sends them. Callers bind their session
  once with `twitter_customer_session`, whose own credential payload is unaffected. Default
  `true`, so the stdio package is unchanged. Each tool now carries `headerArgs`.

## 0.21.0 (2026-10-01)

### Added

- **`twitter_trends` category gains `for_you` and `business_and_finance`.** `for_you` reads
  X's For you Explore tab. `business_and_finance` is not a tab (X serves none): it reads the
  Trending and News tabs and returns only the ranked trends X itself labels "Business and
  finance", re-ranked, never story items. Category results reflect the Explore view of the
  account the API reads with.

## 0.20.0 (2026-10-01)

### Added

- **`twitter_trends` reads X's Explore topic tabs.** New `category` input: trending, news,
  sports or entertainment. A category response echoes `category`, has `location` null, and
  lists X's ranked trends first, then the tab's story items (AI-written headlines X marks)
  with `is_ai_story: true`, the headline as `query`, an x.com/i/trending link and the post
  count as `tweet_volume`. It cannot be combined with `country` or `woeid`.

## 0.19.1 (2026-10-01)

### Changed

- **`twitter_dm_list` says what it may not return**: conversations X has moved to
  end-to-end encrypted chat may not appear, and neither may conversations still in
  message requests.

## 0.19.0 (2026-10-01)

### Added

- **`twitter_check_follow_relationship_batch`.** One account against up to 100 others
  in one call, in either direction: fix a source and list targets, or fix a target and
  list sources (which of these accounts follow the brand). Relationship is always from
  the source's side. Billed per pair answered with a relationship.
- **`twitter_audience_summary`.** Samples up to 100 followers or retweeters and returns
  a country histogram from the About data plus a likely-bot share from documented
  profile signals.

### Changed

- **`twitter_check_follow_relationship` takes usernames too** (`source_username`,
  `target_username`), as the API already did.

## 0.18.0 (2026-10-01)

### Added

- **`twitter_user_about_batch`.** The About object (account country, how the account
  was created, username-change history, verification) for up to 100 accounts in one
  call, by `usernames` or `user_ids`. Results come back in request order, each with
  an `about` object or an error code. Billed per account X answered for; items that
  failed on our side are free and safe to retry. Takes `fields` and `compact` like
  every other read.

## 0.17.0 (2026-09-30)

### Added

- **`paid_promotion` on the 17 tweet-list tools.** `"only"` keeps tweets X labels
  Paid partnership (`is_paid_promotion` true), `"exclude"` keeps the rest. It filters
  the page the API returned, so `next_cursor` still pages on, and the response carries
  `paid_promotion_filter { mode, kept, removed }`. Same cost as without it.

## 0.16.1 (2026-09-29)

### Changed

- **A restart answered in JSON is ridden out too.** The gateway now answers a
  restart with a JSON 503 (`"error": "gateway_restarting"`, `Retry-After`)
  instead of its HTML page; a read retries on either. Any other JSON 503 from
  the API, and that code on any other status, is still never retried.
- **A cancelled call stops.** When the MCP client cancels a tool call, the
  request in flight is aborted and the wait before a retry ends at once; the
  result says "Request cancelled by the caller." instead of reporting a timeout.

## 0.16.0 (2026-09-29)

### Changed

- **A read rides out an API restart.** A read (GET) that gets the gateway's
  HTML 502/503, or a refused connection, is retried after 3 and
  then 8 seconds, so a deploy restart no longer surfaces as a Bad Gateway error.
  The API's own JSON errors, gateway timeouts, DNS or TLS failures
  and every write are never retried, so a request the API may already have
  handled is not sent twice.
- `twitter_tweet_quotes` explains the Top fallback: an empty first Top page is
  served from Latest (`product_used`, `top_fallback`) and its `next_cursor`
  keeps paging that list.

## 0.15.0 (2026-09-29)

### Added

- **Agent-actionable paywall.** A missing key, a rejected credential (401
  unauthorized), an empty balance (402 insufficient_credits) and a missing or
  expired X session (409 session_required, 401 session_dead) now return a structured payload
  instead of a prose hint: `needs` (`account`, `valid_key`, `credits` or
  `x_session`), the page to send the user to (`action_url`: signup, dashboard,
  buy credits) or the tool to call next (`next_tool`: twitter_user_login), and
  one sentence the agent can relay, both in the text and as `structuredContent`.
  Other failures keep their existing hints.

## 0.14.0 (2026-09-29)

- **`@twitterapis/mcp/server` export and `authHeaders`.** The package now
  exports `createServer` at `@twitterapis/mcp/server`, so a host can serve the
  same tools remotely. `createServer({ authHeaders })` authenticates each call
  with headers the host supplies instead of an API key, for a host that has
  already authenticated the caller another way (an OAuth token resolved to an
  account). Without it, behavior is unchanged: the API key is sent as before.
  The `exports` map keeps `.` (the stdio entry) and `./package.json`.

- **Per-caller server state.** The server is now built by `createServer()` in
  `src/server.js`, which holds the API key and the last-failed-call record in
  its own closure instead of module globals. Under stdio nothing changes (one
  process, one caller); it is the prerequisite for serving the same tools
  remotely, where one process serves many callers and a global would send one
  caller's requests with another's key. `src/index.js` is now only the stdio
  entry and the one place config is read from the environment.
  `test/per-caller-state.test.mjs` proves two servers in one process never
  share a key or a failure record (red when `lastError` is hoisted back to
  module scope).

## 0.13.1 (2026-09-28)

- **`twitter_user_search` no longer claims bio matching.** X's People search
  matches display name and handle only; a term that appears only in a bio
  returns no match (measured live 2026-09-28). The description and the `query`
  arg now say so, and point to `twitter_user_followers` or
  `twitter_advanced_search` plus a `description` filter for bio lookups. No
  schema change; `test/openapi.snapshot.json` and the catalog baseline are
  refreshed to the corrected docs SoT.

## 0.13.0 (2026-09-23)

- **Every data read takes `fields` and `compact`.** The API added response
  projection on GET routes: `fields` keeps only the dotted paths you name
  (applied to every object in the returned lists and to nested objects; the
  pagination and envelope keys `next_cursor`, `cursor`, `has_more`, `count`,
  `partial`, `error`, `message`, `reason` always survive, anything else at the
  top level that you do not name is dropped), `compact` applies a built-in
  preset (ids, url, text, created_at, lang, engagement counts, the
  retweet/reply/quote flags, conversation ids, the author's id/username/name/
  followers_count/verification, the quoted or retweeted tweet's id/url/author)
  that, on its own, never turns a body into `{}`. 55 data-read tools gained the
  pair (account, feedback, session-status, monitor and webhook reads return
  their bodies unchanged); a model paying per token for a 40-tweet page is the
  caller these were built for. Still 109 tools (65 reads, 44 writes), so a
  MINOR for the new args rather than a new tool.
- **`twitter_dm_conversation` pages backwards.** New optional `max_id`: pass the
  previous page's `min_entry_id` (now returned at the root beside
  `max_entry_id`) to walk a thread back in time. It must be a numeric entry id;
  the API answers 400 for anything else instead of quietly returning page one.
- **`twitter_follow_user` and `twitter_unfollow_user` take a `username`** as an
  alternative to `user_id` (exactly one of the two). The API resolves the handle
  on every call, never from a cache, so a renamed account is acted on by its
  current handle.
- The catalog generator resolves `$ref` parameters. The published spec now
  declares its shared read parameters once under `components.parameters` and
  references them from every GET; the generator and the openapi-parity gate read
  those as a param named `undefined` and refused every read tool. Both now share
  one resolver that fails closed on a ref the vendored spec lacks. The frozen
  catalog baseline was regenerated in the same commit for review.

## 0.12.0 (2026-09-13)

- **Two new tools, 107 -> 109 (65 reads, 44 writes): `twitter_update_avatar` and
  `twitter_update_banner`.** Both endpoints had been serving behind a feature flag
  on the API and documented on no surface, because their upstream host was an
  INFERENCE from the sibling profile write rather than an observation. Both have
  now been called end to end against a live account, both success envelopes were
  captured, and each write was confirmed applied by reading the profile back
  through the GraphQL user lookup. The flag is deleted from the API entirely.
- Each takes ONE field of base64-encoded image bytes (`image` / `banner`): not a
  URL, not multipart, and NOT a `media_id` from `twitter_media_upload`. Both tool
  descriptions say so in the first two sentences, because a model choosing between
  these and the media-upload tool on the word "upload" alone will get it wrong.
- Both descriptions also carry the two things a schema cannot: there is NO UNDO
  and the vendor keeps no history, so read and save the current image URL first;
  and confirm a banner write by reading `cover_picture` back specifically, since
  at least one vendor endpoint reports that field as empty for accounts that
  plainly have one.
- Both are declared `jsonBody`, and here the API's "json-only" classification is
  EXACT rather than conservative: the shared handler reads the JSON body and has
  no query fallback at all, so a query string genuinely cannot work.

## 0.11.1 (2026-09-13)

### Fixed
- `twitter_update_profile`: an empty string CLEARS a field. The tool description said
  the opposite, and 0.11.0 shipped that to npm. It was true of the API when written
  and stopped being true when the handler was fixed the same day.

### Notes
- A PATCH, not a minor: the catalog is unchanged at 107 tools, 65 reads and 42 writes.
  Only description text moves, which `scripts/prepublish-version-class.mjs` confirms.
- The claim is now verified the only way that works on this endpoint: by sending a
  value that CHANGES and reading the profile back. The previous check used a
  byte-for-byte no-op, which is the one test that cannot fail, since the profile looks
  identical whether the write applied or was silently dropped.
- Why it matters that this was wrong rather than merely vague: the old text told a
  model that `description: ""` was a harmless no-op. After the handler fix, that exact
  call blanks the field. A description that is confidently wrong about a destructive
  operation is worse than one that says nothing.
- Separately, writes to this endpoint are sometimes accepted upstream and sometimes
  refused, and only some refusals are classified honestly. That is a defect under
  repair on the API side, not part of this tool's contract, so it is deliberately not
  written into the description.

## 0.11.0 (2026-09-13)

### Added
- `twitter_update_profile` — change the display name, bio, location or link on the
  account behind your session. The catalog goes 106 to 107 tools, 65 reads and 42
  writes, still exact parity with the API's own endpoint count. A MINOR release
  rather than a patch, so a consumer pinned to 0.10.x opts in rather than silently
  receiving a new write tool.

### Notes
- It is a genuine PARTIAL update, tested rather than assumed: X's own client sends
  the whole editable set on every save, so a form carrying only `name` is a shape
  that client never produces. Measured against an account with a non-empty bio
  before publishing: name only, HTTP 200, bio intact.
- An empty string does NOT clear a field. The API trims empty values and treats
  them as absent, so there is no way to blank a bio or a location through this tool
  today. An earlier draft of this release documented the opposite; it was wrong and
  was caught by an adversarial review running the shipped handler rather than
  reading it.
- `updated_fields` echoes the field names you SENT. It is not a diff, so a field you
  set to the value it already held still appears in it.
- The two sibling profile writes, avatar and banner, are deliberately not published:
  neither has ever been called, and both need a real image upload.

## 0.10.0 (2026-09-13)

### Added

- **Seven compose tools: private drafts and scheduled posts.** `twitter_draft_create`, `twitter_draft_edit`, `twitter_draft_delete`, `twitter_draft_list`, `twitter_scheduled_create`, `twitter_scheduled_delete`, `twitter_scheduled_list`. Catalog is now **106 tools, 65 reads and 41 writes**, still exact parity with the API's endpoint count. A MINOR bump, not a patch: the catalog grew, so a consumer pinned to `0.9.x` opts in rather than receiving seven new tools silently, which is exactly what `scripts/prepublish-version-class.mjs` refuses.
- **The one thing a model cannot read off a schema is said in every one of the seven descriptions: a DRAFT is private and never posts; a SCHEDULED post WILL publish publicly at its `execute_at` unless it is cancelled first.** A model choosing between `twitter_draft_create` and `twitter_scheduled_create` on the word "create" alone gets it wrong, and the failure is a real post going out. The descriptions also carry the routing to their siblings (`twitter_create_tweet` to post now) and the `execute_at` unit trap: epoch SECONDS, never the milliseconds `Date.now()` returns, with a value at or above 1e12 refused by the API rather than scheduled tens of thousands of years out.
- **Both list tools document `partial`.** True means X's answer was read but not fully understood; it is ABSENT on a clean read, so an empty array with no flag means the account genuinely has nothing. That distinction is what stops a model reporting "you have no drafts" when the real answer is "we could not read the reply".

### Notes

- The routes these tools call were built, merged and deployed on 2026-09-13 behind two env flags (`DRAFT_TWEETS_ENABLED`, `SCHEDULED_TWEETS_ENABLED`, both answering 503 while off), verified end to end against a real customer session, then published and their flags removed. The snapshot in `test/openapi.snapshot.json` was refreshed from the LIVE published spec after the docs site deployed, which is the only order that works: the refresh fetches `docs.twitterapis.com/openapi.json`, never a local file.

## 0.9.9 (2026-09-11)

### Changed

- **The server instructions now ask for a control before an "ignored parameter" report.** A generic query on a score-ordered sort returns the site-wide listing, which reads exactly like a dropped parameter and is not one. Before drafting a report that a parameter is ignored or a field is empty, the model is told to re-run with a distinctive value that could only match if the parameter was honoured, and with the phrase quoted, then title the report by what the control showed.
- **`scripts/prepublish-version-class.mjs`, run by `prepublishOnly`, refuses a patch bump when the tool catalog grew.** It reads the published tarball from npm, counts the catalog on both sides, and blocks a publish whose version is a patch over the published one while the catalog is larger. Fails closed when npm cannot be read. `--selftest` covers both directions offline.

## 0.9.8 (2026-09-04)

### Added

- **`twitter_feedback_list`, read the feedback reports this account has already sent.** The API shipped `GET /feedback` ("List Feedback") after 0.9.7 and no tool covered it, so `test/openapi-parity.mjs` was failing on `origin/main` against the live spec: 98 tools versus 99 endpoints. Because `prepublishOnly` runs `npm test`, that red suite also meant the package could not be published at all. The vendored `test/openapi.snapshot.json` was one route behind the live spec, which is why `scripts/gen-tools.mjs` could not see the endpoint either; refreshed, and exactly one route changed. Distinct from `twitter_feedback_send` action `"list"`, which shows LOCAL drafts that were never sent: this reads what the server holds. Free per call, `status`/`type` filters, cursor-paged. Catalog is now 99 tools, 63 reads and 36 writes, back to exact parity with the API's own endpoint count. **This tool lands BEFORE the route it calls is deployed, which is the deliberate order (surfaces first, route last), so it must not be PUBLISHED to npm until the backend deploy is live.** Probed 2026-09-05: `GET /feedback` returns a bare `404 Not Found`, byte-identical to a nonexistent path, while `GET /feedback/<uuid>` and `POST /feedback` both answer from the application, so the route is authored (twitterapis-backend `origin/feat/feedback-endpoint`, `07a83ad`) but not yet serving. Re-probe before any publish.

### Fixed

- **`manifest.json` now declares its tool catalog statically, so the MCPB bundle carries capability metadata a registry can read without running the server.** Reproduced live: our Smithery listing scored 45/100 with "No capabilities found" even though `tools/list` already answers correctly with 98 tools and no API key (the 2026-08-18 lazy-validation fix). The MCPB manifest schema (v0.3) has an optional `tools: [{name, description}]` field plus a `tools_generated` flag for exactly this; it was never populated. A new `scripts/gen-manifest-tools.mjs` derives it from `src/tools.js` (the same generated catalog everything else in this repo is built from), wired into `npm run build`, `npm run bundle`, and `npm test` (`--check` mode) so it cannot go stale the way `src/tools.js` itself is guarded against.
- **Smithery's own listing for this server was a hard 404 ("Server Not Found or Removed"), not merely showing "No capabilities found" as reported.** Smithery was acquired by Arcade.dev (2026-08-05) and its publish model changed: local/stdio servers now require an explicit `.mcpb` bundle upload (`smithery mcp publish`) rather than an automatic scan of the GitHub repo. The Aug 18 listing did not survive that migration. Republished under `emma-fwab/twitterapis-mcp` (our Smithery org namespace) via the CLI; the listing is live again with correct description, repo, homepage and icon.
- **Known upstream limitation, not fixable from this repo: Smithery's publish backend rejects a `tools[]` entry that lacks `inputSchema`** ("expected object, received undefined" x98), but the official MCPB manifest schema's `tools` field forbids any key beyond `name`/`description` (`additionalProperties: false`), and `mcpb pack` itself refuses to build a bundle that adds one. Confirmed by testing both directions: a manifest with `inputSchema` fails `mcpb validate` and `mcpb pack` outright; a manifest without it publishes fine but Smithery shows "No capabilities found". Shipping the spec-compliant `name`/`description` list here is still correct (matches the documented format, harmless, and picks up automatically if Smithery relaxes their validator), but full capability display on Smithery is blocked on their side until that's resolved.

## 0.9.7 (2026-09-04)

### Fixed

- **`twitter_feedback_send` no longer holds the local queue lock while it talks to the API.** The lock's stale threshold is 10s and a request may take up to 30s, so a send that held it let a second MCP process reclaim the lock, write its draft, and then lose that draft to the sender's pre-send snapshot. Drafts to send are now picked under the lock, posted with it released, and after each success the lock is re-taken, the queue re-read and exactly that draft removed. A draft added by another process mid-send survives; a crash mid-batch still never resends a posted report. If the per-success removal itself cannot take the lock, the report is still shown as posted with its server id and the caller is told to discard that draft rather than send it again.

### Added

- **`twitter_feedback_send` and `twitter_feedback_get`, report a bug or a gap to the twitterapis.com team from inside the session you are already in.** Modelled on Claude Code's own feedback tool: the model drafts a report at a high-signal moment (a call failed in a way that is not your key, credits, session or a rate limit and you had to work around it; you asked for something no tool covers; a documented field came back empty or wrong; you were plainly frustrated with a result) into a local queue at `~/.twitterapis/feedback-queue.json`, and nothing is sent until you review the queue and name the drafts to send. Each draft carries the last failing call's endpoint, status and request id, your MCP client's name and this package's version, filled in automatically, so a report is actionable without a follow-up. `twitter_feedback_send` takes `action` (`draft`, `list`, `send`, `discard`); `twitter_feedback_get` reads a sent report's status and the team's response. Both are free. The trigger list also ships as the server's MCP `instructions`, so a client that honours them nudges its model at the right moments. Every non-credential error body now ends with a one-line pointer to the tool. This takes the catalog to 98 tools, 62 reads and 36 writes, still exact parity with the API's own endpoint count.
- **Catalog support for local handlers.** A tool may declare `local: "<handler>"` in `scripts/tools.overrides.mjs`, and args flagged `local: true` are consumed in this package instead of being sent to the API. The generator refuses a `local: true` arg on a tool with no handler, and refuses a `local` handler name `src/index.js` does not implement at boot, so neither flag can turn into a silent passthrough. A new `strings` arg type renders `z.array(z.string())`.

## 0.9.5 (2026-08-31)

### Added

- **`twitter_monitor_webhook_redrive`, replay the deliveries you missed while your endpoint was down.** A delivery is dead-lettered after it fails all 8 attempts across 21 minutes, so an outage longer than that window loses those events outright. This re-queues them with a full retry budget, oldest first, and is free per call. Bounded by default so a recovered endpoint is not flooded: `max_age_hours` defaults to 24 (1 to 168) and `limit` to 100 (1 to 1000). Returns `requeued` and `skipped_permanent`; a delivery that died for a permanent reason (a 410 Gone, a deleted webhook, or a URL egress refused) is not replayed, because it would fail the same way and spend the budget again. Replayed events carry the same signature and payload as the original, so make your handler idempotent on the event id if a duplicate would matter to you. This takes the catalog to 96 tools, 61 reads and 35 writes, which is exact parity with the API's own endpoint count.
- **`include_replies` on `twitter_monitor_create` and `twitter_monitor_update`.** The parameter was added upstream and neither tool exposed it, so a caller could not turn replies off through the MCP at all. `true` delivers the account's replies as well as its own posts, which is the default and what every monitor has always done; `false` holds replies back. It must be a real boolean: the string `"false"` and the number `0` are rejected with a 400 rather than coerced, because coercing them would quietly give you the opposite of what you typed, and the wrong answer here is invisible since it looks exactly like the account not having posted. The generator is fail-closed on an unexposed spec param and refused to build until both were declared, which is how this surfaced.

### Fixed

- **The redrive tool would have 400'd on every call without `jsonBody: true`.** Its handler reads `max_age_hours` and `limit` from the body only, so the args would have gone out as a query string. Caught by `body-mode-parity`, which reads the backend's own generated route manifest rather than trusting this repo's view of it. That manifest was itself stale on the backend's main branch (the route landed without regenerating it), so the failure surfaced here first and was fixed upstream in twitterapis-backend#408 before this release.

## 0.9.4 (2026-08-19)

### Fixed

- **A malformed `TWITTERAPIS_TIMEOUT_MS` silently timed out every single tool call.** `Number(process.env.TWITTERAPIS_TIMEOUT_MS || 30000)` had no validation: a non-numeric value (`"30000ms"`, `"60,000"`, a stray comma or unit) parses to `NaN`, and Node's `setTimeout` clamps a `NaN` delay to about 1ms, so the abort controller fired before any real request could complete. Every tool call failed with `Request failed: timed out after NaNms`, which reads as a live API outage rather than the config typo it actually is. An explicit `0` or negative value had the same effect with no typo required at all. The value is now validated as a finite, positive number before use, falls back to the documented 30000ms default otherwise, and logs a clear warning to stderr naming the bad value instead of silently breaking every call.
- **8 tool args declared `optional: true` in `scripts/tools.overrides.mjs`, a key the generator never reads** (`with_listeners` / `with_replays` on `twitter_spaces_info`, `message` / `messages` / `conversation_id` / `mode` / `image_count` on `twitter_grok_chat`, `media_category` on `twitter_article_update_cover_media`). The render logic only ever checks `a.required`, so `optional: true` was silently a no-op; each of these 8 args happened to render as optional anyway only because the vendored spec's own `required` flag for that param already defaulted to false. A future spec refresh flipping one of those defaults would have silently made the arg required with no warning from any gate. Renamed to `required: false`, the property the generator actually reads. `src/tools.js` is byte-identical before and after (`catalog-identity` confirms), so this closes a live gap without changing today's behavior.
- **The generator now fails the build on any unrecognized key in a `tools.overrides.mjs` arg entry** (`scripts/gen-tools.mjs`), so the class of bug above can't recur silently. Red-tested: reintroducing `optional: true` on a synthetic arg makes `npm run build:check` fail with `sets unrecognized key "optional" ... did you mean "required: false"?`.

## 0.9.3 (2026-08-18)

PR #36 (3 new tools + openapi-parity fix) merged after 0.9.2 had already been
published to npm, so those changes never reached the registry until this
version.

### Added

- **`twitter_list_followers`**: a public List's followers, a different set from its members.
- **`twitter_community_search`**: find X Communities by keyword, the discovery step that produces the numeric id the rest of the community family needs.
- **`twitter_community_about`**: a community's moderators and a member preview as full user profiles, complementing the reduced rows `twitter_community_members` / `twitter_community_moderators` return.
- **`twitter_list_tweets`** gains a `product` argument (Latest / Top), matching the live API's new search-ranking parameter for that endpoint.

## 0.9.2 (2026-08-18)

### Fixed

- **The server no longer exits at startup when `TWITTERAPIS_KEY` is missing.** A registry connectivity scanner (Smithery, Glama, the official MCP registry, Claude Connectors Directory) spins up the server with no real credential just to enumerate `tools/list`. Exiting before the transport connected made every automated scan fail outright and read as a generic connectivity error, HTTP 405 on Smithery, rather than a missing-key error, which is why this listing scored low on registry capability-quality checks that can only run once a scan succeeds. Tools now register and `tools/list` responds regardless of whether a key is present, verified live with the key stripped from the process env. An actual tool call made with no key still fails clearly, at the point of the call, with the same style of message the existing 401 branch already used.

Catalog is now **94 tools: 60 reads and 34 write actions**.

## 0.9.0 (2026-08-17)

### Added

- **The X List operation family, 5 tools** (task #2251). Two reads that look like two spellings of one capability and are not:
  - **`twitter_list_tweets`** (GET /twitter/list/tweets): posts written by the members of a public List, newest first, read through X's SEARCH INDEX. This is the filterable half of the List feed: it accepts `since` and `until` date bounds (`until` is EXCLUSIVE, matching X's own `until:` operator) and an `include_replies` toggle. It does not carry retweets, and search-index lag applies, so a post made moments ago can be missing for a short while.
  - **`twitter_list_timeline`** (GET /twitter/list/timeline): the same List as X's OWN native feed, carrying members' retweets and X's List ordering. It takes only `list_id`, `count` and `cursor`, because a native timeline cannot honour search operators, so no date range and no reply filter exist on it.

  The two are separated by their PARAMETER SETS, not by their names, and each tool description says so and names the other, so a model picking between them cannot silently answer a different question than the one asked. A regression check in `test/tools.test.mjs` pins the difference so a later edit cannot harmonise it away.

  Three writes that run on the CUSTOMER'S REGISTERED X SESSION rather than a pooled account, because a List belongs to a specific account:
  - **`twitter_list_create`** (POST /twitter/list/create): create a List with a `name` and an optional `description` and `is_private`. A List is public unless you explicitly ask otherwise, and a private List is not readable by the public List read tools.
  - **`twitter_list_add_member`** and **`twitter_list_remove_member`** (POST /twitter/list/add_member, /twitter/list/remove_member): add or remove one account on a List you own. Both return the List's `member_count` read back from X after the write, which is the field to check rather than `ok` alone: X returns a populated `errors[]` on 100% of successful calls to these ops, so the error array cannot tell you whether your write applied, while the count can. `member_count` is null when X returned no list object at all, which is itself the not-applied signal. A write that does not apply comes back with the SAME field layout plus a 422 and a machine-readable reason, and is not billed.

  All 5 cost $0.0008 per call. Register a session once with `twitter_customer_session`, or pass `auth_token` and `ct0` per call, for the three writes. Their backend handlers read every field through the dual-mode query-or-body helper, verified against the backend's own route-body-modes manifest by `test/body-mode-parity.mjs`, so none of them sets `jsonBody`. The catalog is now **91 tools: 57 reads and 34 write actions**.

## 0.8.0 (2026-08-17)

### Added

- **6 new reads: X Communities and tweet quotes.** `twitter_community_info` (one Community by numeric id: name, counts, join policy, rules, topic, banners, admin), `twitter_community_members` (the member roster, each row carrying that member's `Admin` / `Moderator` / `Member` role), `twitter_community_moderators` (moderators and admins from their own upstream operation, not a filter over the roster), `twitter_community_tweets` (the post timeline, with the pinned post returned as its own `pinned` field), `twitter_community_memberships` (the inverse lookup: every Community a given numeric `user_id` belongs to), and `twitter_tweet_quotes` (tweets that quote a tweet, with their text). The five Community reads are served by the account pool rather than by your session, which is why `role`, `can_join`, `is_pinned` and `viewer_relationship_type` come back null on them: those four describe the account that made the upstream call, and on a pooled read that is a rotating account you have never heard of. `twitter_tweet_quotes` is search-backed, so its `count` is what search returned rather than the tweet's true `quote_count`. The catalog moved to **86 tools: 55 reads and 31 write actions**. (This entry was written on 2026-08-17: the 0.8.0 release bumped the package version and shipped the tools but left no changelog entry behind it.)

## 0.7.8 (2026-08-16)

### Added

- **`twitter_grok_chat`** (POST /twitter/grok/chat): ask X's own Grok a question as your authenticated account and get one complete JSON reply with the answer plus the sources it cited. Unlike a general LLM, Grok reads X in real time, so it can answer about what is being said right now, and passing a bare tweet or status URL as the message returns a structured summary of that post. Citations come back as `{url, title, snippet}`, merged and de-duplicated across every search Grok ran in that answer, and `title` is not always present. The response also reports the model that ACTUALLY answered, which can differ from the mode you asked for. Buffered, not streamed. STATELESS: nothing is stored on our side, so to continue a conversation you pass the prior turns back in `messages[]` with the `conversation_id`. $0.004 per answer, the same tier as `twitter_tweet_thread`, priced on our connection-holding cost rather than on model tokens, since the inference runs on your own X account.
- **`twitter_grok_config`** (GET /twitter/grok/config): whether the authenticated account can use Grok, X's own reasons when it cannot, and the model options available. Eligibility is a property of the X ACCOUNT rather than of the API key, so ask it about the same account you intend to run `twitter_grok_chat` as. Free. 80 tools now: 49 reads and 31 writes.

## 0.7.7 (2026-08-16)

### Added

- **`twitter_spaces_info`** (GET /twitter/spaces/info): metadata and the participant roster for one X Space, live or ended. Returns title, lifecycle state (`Scheduled` / `NotStarted` / `Running` / `Ended`), content type (`audio`, or `visual_audio` when the host enabled video), the host profile, topics, the wrapper tweet, scheduled and actual start/end times, peak live listener count, replay view count, and the admin, speaker and listener rosters. Takes the Space id from a `x.com/i/spaces/<id>` URL. Two things worth knowing before you read a response as wrong: X does NOT retain the per-person listener roster once a Space ends, so `listeners` comes back empty for an ended Space while `total_live_listeners` (peak concurrent) and `total_replay_watched` still reflect the real audience, and `admins` and `speakers` do survive; and every timestamp is a millisecond-epoch number, because X sends `started_at` as a number and `ended_at` as a string in the same payload and both are normalised so you can subtract them directly. Returns metadata only, not the Space audio.
- **`twitter_article_update_cover_media`** (POST /twitter/article/update_cover_media): attach an already-uploaded image as a draft or published article's cover, completing the article write set. This attaches, it does not upload: call `twitter_media_upload` first and pass the `media_id` it returns. `media_category` defaults to `DraftTweetImage`, which is what X's own article editor sends. 78 tools now: 48 reads and 30 writes.

## 0.7.6 (2026-08-16)

### Added

- **`twitter_user_status`** (GET /twitter/user/status): check whether a Twitter/X account is alive, suspended, or deleted. Returns `status` as one of `alive` / `suspended` / `not_found` / `unavailable`, plus the numeric `id` when the account is alive and X's own `reason` when it gives one. Use it instead of `twitter_user_info` when the question is whether an account still exists: user info answers a suspended account, a deleted account, and a handle that never existed all the same way, so it cannot tell a ban from a typo. Every outcome is a successful response, so read the `status` field rather than treating a suspension as an error. A protected (private) account counts as alive. 76 tools now: 47 reads and 29 writes.

## 0.7.5 (2026-08-16)

### Fixed

- **5 write tools sent every arg as a URL query-string parameter with no request body**, silently failing 100% of calls: `twitter_monitor_create`, `twitter_monitor_update`, `twitter_monitor_webhook_create`, `twitter_x_user_stream_add_user`, `twitter_x_user_stream_remove_user`. Their backend routes read only `c.req.json()` with no query-string fallback, unlike most write endpoints here which accept either. Every call to any of these 5 returned a 400 "Provide `<field>` in the JSON body" error. Now sends `jsonBody: true` so args travel as a real JSON body, matching what the backend actually reads. Found by an independent review, confirmed live against production before and after the fix (see this repo's own test/smoke.mjs pattern).
- **`twitter_monitor_update`'s `domain_filter` now accepts `null`** (in addition to an empty string) to clear an existing filter, matching its documented "pass an empty string (or null) to clear" behavior, which the schema previously rejected.

## 0.7.4 (2026-08-15)

### Added

- **`domain_filter` on `twitter_monitor_create` and `twitter_monitor_update`** (task #30 follow-up): an optional bare hostname or full URL that restricts a monitor's delivery to only the new posts carrying a link to that host or a subdomain of it. Normalized server-side (lowercased, scheme/path/query/fragment/leading `www.`/trailing port stripped), rejected with a 400 on an invalid hostname shape after normalization. Pass an empty string on update to clear an existing filter; omit the field to leave it unchanged. A filtered-out post still advances the monitor's cursor and is never a metered read either way, it just isn't delivered. This param was already live on the backend and unrestricted for every account; it was undocumented until now. No new tool, no catalog count change.

## 0.7.3 (2026-08-15)

### Added

- **`twitter_monitor_account_health`** (task #111): account-wide monitoring rollup in ONE call, distinct from `twitter_monitor_health` (which needs an id and reports one monitor's cursor): service status ("operational" or "degraded"), active/paused/total counts across every monitor you own, and pending/delivered/failed delivery counts from the last 24 hours. Takes no arguments. A key with zero monitors gets zeroed counts back, never an error. Free per call. The catalog is now **75 tools: 46 reads and 29 write actions**.

## 0.7.2 (2026-08-14)

### Added

- **3 new compat tools for tweet monitoring** (task #87): `twitter_x_user_stream_add_user`, `twitter_x_user_stream_remove_user`, `twitter_x_user_stream_list_users` -- drop-in equivalents of `twitter_monitor_create`/`twitter_monitor_delete`/`twitter_monitor_list` using an alternate request/response envelope shape, for migrating an existing integration built against that shape without a rewrite. Free per call, same underlying monitor system, same safety checks as the native tools. The catalog is now **74 tools: 45 reads and 29 write actions**.

### Fixed

- **The generator's `toolPathFor` only special-cased `/account/*` as un-prefixed** (billing reads mounted at the API root rather than under `/twitter/`); the 3 new compat routes live at `/oapi/x_user_stream/*`, the same shape of gap, now handled identically.

## 0.7.1 (2026-08-14)

### Added

- **10 new tools for account monitoring + webhooks** (task #49, backend build plan Phase 5): watch an X account for new posts and get them pushed to your own HTTPS endpoint instead of polling. `twitter_monitor_create`, `twitter_monitor_list`, `twitter_monitor_update`, `twitter_monitor_delete`, `twitter_monitor_health`, `twitter_monitor_deliveries`, `twitter_monitor_webhook_create`, `twitter_monitor_webhook_list`, `twitter_monitor_webhook_delete`, `twitter_monitor_webhook_test`. Free per call (account administration, not a metered Twitter read); needs only your API key, no linked X session. The catalog is now **71 tools: 44 reads and 27 write actions**.

### Fixed

- **The generator (`scripts/gen-tools.mjs`) could not represent a DELETE route, or two HTTP methods on the same REST path**, which is exactly the shape the monitor/webhook endpoints need (`/monitor/{id}` is POST to update and DELETE to remove; `/monitor` and `/webhook` are each GET to list and POST to create). The endpoint table was keyed by path alone (a second method on the same path silently overwrote the first) and skipped every method that wasn't `get`/`post` outright, so a vendored `delete` operation never reached the catalog at all. Endpoints are now keyed by `(method, path)`; an override targeting an ambiguous path sets `method: "..."` to say which one. A `{name}` URL-template segment (this API's spec declares no formal `in: "path"` parameter for one) is synthesized as a required arg and threaded through as the tool's `pathParams`, which the runtime (`src/index.js`, via the new `resolvePathParams` in `src/query.js`) substitutes into the URL instead of sending as a query-string or JSON-body field. Regression-tested against a synthetic route table in `test/gen-tools-endpoints.mjs`, independent of the real spec.

## 0.7.0 (2026-08-11)

### Removed

- **`twitter_users_by_ids` removed from the tool list.** X refuses the batch `UsersByRestIds` lookup for the pooled cookie sessions this package's REST backend reads through (confirmed by instrumenting the request and verifying a token was actually attached before it was rejected, not just repeated 403s). The REST endpoint itself stays live and returns an honest `503 endpoint_unavailable` rather than being deleted, but a tool the model can call and always get a hard failure from is worse than no tool at all, so it is out of the catalog. Use `twitter_user_info_by_id` instead: same user object, one id per call. The catalog is now **61 tools: 40 reads and 21 write actions**.

## 0.6.9 (2026-08-10)

### Added

- **2 new tools for X's bookmark folders** (task #9): `twitter_bookmark_folders` (list your own bookmark folders, X's internal name: collections) and `twitter_bookmark_folder_timeline` (read the tweets inside one specific folder, by `folder_id`). Both require an authenticated session, same auth model as `twitter_bookmarks` and `twitter_bookmark_search`. `twitter_bookmark_folder_timeline` is cursor-paginated only; there is no count/page-size argument for this op. The catalog is now **62 tools: 41 reads and 21 write actions**.

## 0.6.8 (2026-08-10)

### Added

- **`twitter_article_get` gains an owner-only `article_id` form** (task #12, competitor parity): pass `article_id` (the article's own entity id, from `twitter_article_create` or `twitter_article_list`) to read one of your own articles by id, including Drafts, which have no announcement tweet the existing public `id`/`url` form could resolve. Requires a registered session or per-call `auth_token`/`ct0`, same as the other authenticated article tools. Returns `article: null` when the id is not found or not owned by the calling account, X exposes no dedicated get-by-id op, so this scans the caller's own Draft then Published lists and matches client-side, same approach `article/delete` already used for lifecycle resolution.

## 0.6.7 (2026-08-10)

### Added

- **8 new tools for X's long-form Articles/Notes feature** (#1096): `twitter_article_create`, `twitter_article_update_title`, `twitter_article_update_content`, `twitter_article_publish`, `twitter_article_unpublish`, `twitter_article_get`, `twitter_article_list`, `twitter_article_delete`. `twitter_article_get` is a public read (no session required, like `twitter_tweet_detail`); the other 7 require a customer session. The catalog is now **60 tools: 39 reads and 21 write actions**.

## 0.6.6 (2026-08-09)

### Added

- **`twitter_customer_session_delete`**, the self-serve counterpart to `twitter_customer_session`: the backend has shipped this revoke endpoint since PR #188, but no published surface carried it, so an agent could link a session with no documented way to unlink it. Takes no body field and no header beyond the API key; the handler resolves the session to delete from the auth context, which is what makes cross-key deletion impossible. Placed next to `twitter_customer_session` so the way out sits beside the way in. The catalog is now **52 tools: 37 reads and 15 write actions**.

### Fixed

- **`twitter_user_login` was missing `proxy_url` and `user_agent`**, which the backend handler reads and stores on the resulting session, governing that session's ongoing egress and fingerprint rather than just the one login call. Both were undocumented and therefore uncallable through the tool. Verified against `src/server/routes/user-login.ts`, not the spec.

## 0.6.5 (2026-08-06)

### Changed

- **`src/tools.js` is now generated at build time instead of maintained by hand.** The catalog is built from two committed inputs: `test/openapi.snapshot.json`, a vendored copy of the published OpenAPI spec, which supplies the structure (which endpoints exist, which parameters each takes, whether a parameter is required, its type); and a new hand-authored `scripts/tools.overrides.mjs`, which supplies everything the spec cannot express, namely the tool and argument descriptions a model reads to decide how to call a tool, the cross-field rules such as "provide exactly one of `username` or `user_id`", the per-call credential arguments that travel as `x-*` request headers and therefore appear in no spec, and the write / destructive / JSON-body flags. Generating the descriptions from the spec instead would have replaced tuned prose (about 307 characters per tool, with routing between sibling tools) with endpoint documentation written for a human reading the docs site (29 to 64 characters, no routing), which is a downgrade to the only text an agent actually reads. **All 51 tools are byte-identical to 0.6.3** across names, REST paths, HTTP methods, flags, argument names and ordering, required-ness, types, bounds, enum members, and every description; `test/catalog-identity.mjs` pins that against a frozen fingerprint of the 0.6.3 catalog and fails on any difference. No behaviour change for any client.
- The spec is **vendored, not fetched**. Nothing is downloaded at install time or at server boot, so the published package stays a fixed, reviewable artifact rather than one whose tool surface depends on a hostname still answering. `npm run openapi:refresh` re-vendors it as a deliberate, reviewed step and prints the route diff; `npm run build` regenerates the catalog; `npm test` regenerates it in memory and fails if the committed file was hand-edited or left stale.
- The query-string builder moved to `src/query.js` and is re-exported from `src/tools.js`, so the generated file contains catalog data and no logic. Import paths are unchanged.

### Fixed

- **`twitter_user_tweets` advertised a filter the endpoint does not apply.** Its description said it returns "a user's recent original tweets, excluding replies and retweets". Measured live against production on two accounts: `elonmusk` returned 9 retweets and 1 reply in 20 items, `sama` returned 5 retweets and 1 reply in 20. Counted on the payload's own `is_retweet` and `is_reply` booleans, not on a text heuristic, and both flags took both values in the sample so they are real fields rather than constants. This is the highest-leverage wrong text in the package: a tool description is what a model reads to decide how to call a tool, so an advertised filter that is never applied produces an agent that reasons over retweets and replies believing it has only the user's own posts. The description now states plainly that no server-side filtering happens, names the three booleans (`is_retweet`, `is_reply`, `is_quote`) to filter on, and warns that `author.username` must be read rather than assumed, because a retweet carries the original author inside `retweeted_tweet`.
- **`twitter_user_tweets_and_replies` claimed a distinction that does not exist.** It told the model "to see only original tweets, use `twitter_user_tweets`", which is the same false filter promise from the other side. On `elonmusk` both endpoints returned the same 20 tweet ids in the same order with identical reply and retweet composition. The cross-reference is replaced with an honest note that the two endpoints overlap and a pointer to the same three booleans.
- **The vendored spec was four endpoints behind the API**, missing `/users/by_ids`, `/user/blocking`, `/user/muting`, and `/media/status`, the four tools added after the snapshot was last refreshed. The parity check only noticed because it prefers the live spec over the vendored copy, so on any run without network access it reported four tools pointing at endpoints that "do not exist" and exited non-zero. Re-vendored; the offline path now passes.
- **The README was missing four of the 51 tools** (`twitter_users_by_ids`, `twitter_blocking`, `twitter_muting`, `twitter_media_status`) and still said "47 tools: 33 reads". Since the README ships inside the package and is its page on npm, those four were callable but documented nowhere. Rows added, counts corrected, and a new `test/readme-parity.mjs` compares the README against the catalog itself, so a tool can no longer ship without a row or a correct count.
- The changelog section describing the seven tools added in 0.6.2 was still headed "Unreleased" twelve days after it shipped. Retitled.

## 0.6.3 (2026-08-02)

### Added

- **Two new tools, `twitter_blocking` and `twitter_muting`**, for the accounts your authenticated account has blocked or muted. Both are cursor-paginated lists of full user objects and both read YOUR OWN lists only: there is no `user_id` argument, because X provides no way to read another account's block or mute list and an argument the API ignores would be worse than none. An empty `users` array means you block or mute nobody; it is never a silent parse failure, because the endpoint returns an error status rather than an empty page when it cannot read the list. The catalog is now **51 tools: 37 reads and 14 write actions**.
- **Registry descriptors so the server is discoverable outside npm**: `server.json` for the official MCP Registry, `smithery.yaml` with a full `configSchema` (so hosted installers prompt for the API key by name rather than showing a bare variable), and `glama.json` for the maintainer claim. npm is a pull channel; these are where agent users browse.

### Fixed

- **`npm test` was failing on `main`, which blocked any release.** `twitter_users_by_ids` and `twitter_media_status` were merged on 2026-07-31 but the catalog-count assertions were left at the pre-merge 47 tools / 33 reads, so the suite reported a mismatch that had nothing to do with the tools themselves. The counts are corrected and now carry a reads-plus-writes-equals-total invariant that does not depend on them, so two cancelling errors cannot pass.

### Changed

- Release tooling hardened. No user-facing or API behaviour change.

## 0.6.2 (2026-07-21)

### Added

- **Seven new tools, closing the gap between the MCP surface and the endpoints the API serves.** Reads: `twitter_trends` (top trends for a location, by `country` or `woeid`), `twitter_trends_locations` (every location X publishes trends for, each with its WOEID), and `twitter_account_me` / `twitter_account_payments` (your twitterapis.com account details and payment history; both free, and served on the un-prefixed `/account/*` path). Session and write: `twitter_customer_session` (register your x.com cookies against your key), `twitter_user_login` (log in with username/password, plus `totp_secret` for 2FA), and `twitter_media_upload` (upload a base64 image, returns a `media_id` for `twitter_create_tweet`). The catalog is now 47 tools: 33 reads and 14 write actions.
- **A JSON-request-body transport for the three endpoints whose handler reads one.** `twitter_customer_session`, `twitter_user_login`, and `twitter_media_upload` set `jsonBody: true`, so their arguments are sent in the JSON body rather than the query string, matching the routes that read `c.req.json()`. For these tools the credential fields are the body payload and are not diverted into `x-*` headers.
- `twitter_user_login` documents its REAL response contract, `{ ok, username, message }`. The account cookies it mints are stored server-side against your key and are never returned to the caller. (The published OpenAPI still describes an `{ auth_token, ct0, twid }` response for this endpoint, which the live handler does not send; a code comment on the tool flags the mismatch for maintainers.)

### Fixed

- **`twitter_tweet_thread` no longer advertises a `cursor` it ignores.** `/twitter/tweet/thread` returns the whole ordered thread in a single response and accepts only `id`/`url`, so the tool's `cursor` argument and its "paginate with cursor" wording were removed to match the contract (the live `openapi.json` had already dropped `cursor` here).
- **`twitter_user_about` description refreshed** to cover the fields the endpoint returns today: verification and identity-verification flags, linked website, and X's "About this account" transparency panel (account country, how the account was created, and username-change history).
- **`test/openapi.snapshot.json` regenerated from the live `openapi.json`**, bringing the vendored offline copy back in sync. It had drifted on 23 endpoints' fields, and now also carries the four new paths and the `Trend` component schemas.

### Changed

- Release tooling hardened. No user-facing or API behaviour change.

## 0.6.1 (2026-07-20)

### Fixed

- **The server advertised the wrong version.** `serverInfo.version` in the MCP handshake and the outbound `user-agent` header were both hardcoded to `0.3.0`, so every client since 0.4.0 was told it was talking to 0.3.0. Both now derive from `package.json`, so the literal cannot drift again.
- Corrected a factual error in the 0.6.0 changelog entry below: the endpoint that stopped advertising `count` alongside `twitter_tweet_replies` is `twitter_tweet_thread`, not `twitter_tweet_retweeters`. `twitter_tweet_retweeters` does accept `count` and is unchanged.

## 0.6.0 (2026-07-20)

### Fixed

- **Removed three phantom parameters from the published tool schemas.** Eleven write tools (`twitter_create_tweet`, `twitter_delete_tweet`, `twitter_favorite_tweet` / `twitter_unfavorite_tweet`, `twitter_retweet` / `twitter_unretweet`, `twitter_bookmark_tweet` / `twitter_unbookmark_tweet`, `twitter_follow_user` / `twitter_unfollow_user`, `twitter_dm_send`) advertised an optional `account` parameter that the API never accepted, so agents that passed it were silently ignored. `twitter_tweet_replies` and `twitter_tweet_thread` advertised the full pagination shape when the endpoint only accepts `cursor`.
- A fail-closed MCP-to-OpenAPI parity gate now runs on every `npm test`, so a tool schema can no longer drift from the live API contract unnoticed.
- README: corrected the Links section (the REST base URL is `https://api.twitterapis.com`; removed a link to a status page that does not exist) and added an FAQ covering signup, read-vs-write scope, supported clients, billing, and data handling.

### Breaking

- If your client explicitly passed `account` to a write tool, or `count` to `twitter_tweet_replies` / `twitter_tweet_thread`, those keys are no longer part of the schema. They were never honoured by the API, so behaviour is unchanged; only the advertised schema is now accurate.

## 0.5.0 (2026-07-06)

### Added

- `twitter_user_followers_v2` and `twitter_user_following_v2` — the v2 response shape (richer profile fields and more reliable cursoring for large follower/following audiences). Same inputs as the v1 tools (`username` / `user_id` + `cursor`). Catalog is now **40 tools** (29 reads + 11 write actions).

### No breaking changes

## 0.3.0 (2026-06-29)

### Added

- **Per-call inline credentials** for multi-account use: the 16 session tools (all writes + account-only reads) accept optional `auth_token` + `ct0` (plus optional `proxy_url` / `user_agent`) to act AS that account for a single call, with no pre-registered session, so one API key can act as many accounts. Sent as `x-auth-token` / `x-ct0` / `x-proxy-url` / `x-user-agent` request headers, never in the URL or query string.
- For write actions, set `proxy_url` to a residential proxy: X soft-blocks writes that egress from datacenter IPs.

## 0.2.0 (2026-06-25)

### Added (full API parity)

- Grew the catalog from 16 to **37 tools**: 27 reads and 10 write actions.
- New reads: `twitter_user_about`, `twitter_user_affiliates`, `twitter_check_follow_relationship`, `twitter_user_tweets_complete`, `twitter_user_likes`, `twitter_followers_you_know`, `twitter_home_timeline`, `twitter_bookmarks`, `twitter_bookmark_search`, `twitter_dm_list`, `twitter_dm_conversation`.
- New write actions: `twitter_create_tweet` (with `reply_to` / `quote`), `twitter_delete_tweet`, `twitter_favorite_tweet` / `twitter_unfavorite_tweet`, `twitter_retweet` / `twitter_unretweet`, `twitter_bookmark_tweet` / `twitter_unbookmark_tweet`, `twitter_follow_user` / `twitter_unfollow_user`.
- Tool annotations: every write is `readOnlyHint: false`; reversing actions (delete, unfollow, unlike, unretweet, unbookmark) are `destructiveHint: true` so MCP clients can prompt before a mutating call.
- Account-only reads and all writes act AS a linked X session; added an HTTP 409 error hint pointing users to link a session.

### No breaking changes

All 16 prior tool names, parameter names, and endpoint mappings are unchanged. Existing `npx @twitterapis/mcp@latest` invocations update automatically.

## 0.1.1 (2026-06-24)

### Improvements

- Tool descriptions rewritten. All 16 tool descriptions and parameter hints now use precise, concrete language matched to how MCP clients surface them. Removed hedging phrases, tightened scope statements, and added concrete value hints for paginated parameters (cursor, count limits).
- Error hints added. Each tool now carries structured error guidance covering the five most common failure codes (401, 402, 403, 404, 429) with a plain-English fix per code, so agents can self-correct without a docs lookup.
- README optimized. Quick-start, setup matrix (Claude Desktop, Cursor, Windsurf, VS Code), configuration table, full tool reference, usage examples, troubleshooting section, and pricing note all revised for clarity and scannability.
- GitHub repository established. The package now carries a canonical repository field pointing to github.com/TwitterAPIs/twitterapis-mcp (public, MIT licensed).

### No breaking changes

All 16 tool names, parameter names, and API endpoint mappings are unchanged. Existing `npx @twitterapis/mcp@latest` invocations update automatically.

## 0.1.0

First public release of the `@twitterapis/mcp` npm package. 16 read-only Twitter/X tools: search, user info, timeline, followers and following, verified followers, media, mentions, tweet detail, replies, threads, retweeters, and list members.
