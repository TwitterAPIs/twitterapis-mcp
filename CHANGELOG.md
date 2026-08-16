# Changelog

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
