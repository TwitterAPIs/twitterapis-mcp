# Changelog

## Unreleased

### Changed

- The publish firewall now runs on `npm publish` itself, via `prepublishOnly`, not only on a manual `npm test`. A release that skips the test step can no longer reach the registry unchecked. Verified: with a competitor reference reintroduced into the README, `npm publish` aborts before the tarball stage.
- The firewall no longer carries its own list of banned terms. It delegates to the maintainer's isolation registry, which is the single place those rules live, so the gate and everything else that enforces them cannot drift apart. If the registry cannot be located, the gate fails rather than passing.

Both changes are to release tooling. No runtime code changed, so installed packages behave identically.

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
