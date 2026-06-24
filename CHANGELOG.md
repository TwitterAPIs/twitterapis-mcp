# Changelog

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
