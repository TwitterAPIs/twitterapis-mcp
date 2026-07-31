# Changelog

## Unreleased

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
