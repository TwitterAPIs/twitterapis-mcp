# @twitterapis/mcp

[![npm version](https://img.shields.io/npm/v/@twitterapis/mcp)](https://www.npmjs.com/package/@twitterapis/mcp)
[![npm downloads](https://img.shields.io/npm/dm/@twitterapis/mcp)](https://www.npmjs.com/package/@twitterapis/mcp)
[![license](https://img.shields.io/npm/l/@twitterapis/mcp)](./LICENSE)

Official **Model Context Protocol** server for [twitterapis.com](https://www.twitterapis.com), the Twitter / X API as native tools for Claude, Cursor, Windsurf, and any MCP client. Reads (search, profiles, timelines, followers, DMs) plus write actions (post, like, retweet, follow).

Ask your agent to search tweets, pull a user's profile or timeline, list followers/following, fetch thread context, or enumerate list members and it calls the API directly. Every tool maps to a REST endpoint at `https://api.twitterapis.com`; the server holds no state and forwards your API key on each call.

## Quick start

No install needed. Run with `npx`. You need one thing: an API key (free $0.50 in credits, no card required): **[twitterapis.com/signup](https://www.twitterapis.com/signup)**.

## Setup

### Claude Desktop

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "twitterapis": {
      "command": "npx",
      "args": ["-y", "@twitterapis/mcp@latest"],
      "env": { "TWITTERAPIS_KEY": "YOUR_API_KEY" }
    }
  }
}
```

Restart Claude Desktop. The `twitter_*` tools appear in the tool picker.

### Cursor

`~/.cursor/mcp.json` (or Settings → MCP → Add New Server):

```json
{
  "mcpServers": {
    "twitterapis": {
      "command": "npx",
      "args": ["-y", "@twitterapis/mcp@latest"],
      "env": { "TWITTERAPIS_KEY": "YOUR_API_KEY" }
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "twitterapis": {
      "command": "npx",
      "args": ["-y", "@twitterapis/mcp@latest"],
      "env": { "TWITTERAPIS_KEY": "YOUR_API_KEY" }
    }
  }
}
```

### VS Code (Copilot / agent mode)

`.vscode/mcp.json` in your workspace, or the user-level MCP settings:

```json
{
  "servers": {
    "twitterapis": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@twitterapis/mcp@latest"],
      "env": { "TWITTERAPIS_KEY": "YOUR_API_KEY" }
    }
  }
}
```

## Configuration

| Env var | Required | Default | Purpose |
|---|---|---|---|
| `TWITTERAPIS_KEY` | Yes | (none) | API key from [dashboard](https://www.twitterapis.com/dashboard) |
| `TWITTERAPIS_BASE_URL` | No | `https://api.twitterapis.com` | Override the API host |
| `TWITTERAPIS_TIMEOUT_MS` | No | `30000` | Per-request timeout in milliseconds |

## Tools

74 tools: 45 reads and 29 write actions. Most user endpoints accept `username` (handle without @) **or** `user_id` (`twitter_user_likes` and `twitter_user_tweets_complete` require `user_id`); tweet endpoints accept `id` **or** `url`; paginated endpoints return a `cursor` you pass back to get the next page. Two of the reads are free account/billing lookups (`twitter_account_me`, `twitter_account_payments`); the 13 monitoring tools are also free (account administration, not metered reads).

Public reads (search, profiles, tweets, followers, likes) work with just your API key. The **account-only** reads (bookmarks, DMs, home timeline, followers-you-know) and **most write actions** act AS an authenticated X account, so they need a session linked to your key first (returns HTTP 409 until then). Link a session either by registering your x.com cookies (`twitter_customer_session`) or by logging in with a username/password (`twitter_user_login`). Alternatively, pass **per-call inline credentials** on any of those tools (`auth_token` + `ct0`, with optional `proxy_url` / `user_agent`) to act AS that account for a single call without pre-registering a session, so one API key can act as many accounts. For write actions, set `proxy_url` to a residential proxy, since X soft-blocks writes that egress from datacenter IPs. Each write tool is annotated `readOnlyHint: false`; reversing actions (delete, unfollow, unlike, unretweet, unbookmark, monitor/webhook delete) are annotated `destructiveHint: true` so MCP clients can prompt before running them. The **monitoring** tools (see below) are the one exception: they administer your twitterapis.com account, not an X session, so they need only your API key, no linked session and no inline credentials.

### Reads

| Tool | What it does |
|---|---|
| `twitter_advanced_search` | Search tweets with X operators (`from:`, `min_faves:`, `since:`, `filter:links`, etc.) |
| `twitter_user_search` | Find user accounts by name or keyword |
| `twitter_user_info` | Full profile by handle (bio, counts, verification, location) |
| `twitter_user_info_by_id` | Full profile by numeric user id |
| `twitter_user_about` | A user's structured About object (category, professional/business labels, verification + identity-verification flags, joined date, and X's 'About this account' transparency panel) |
| `twitter_user_affiliates` | Accounts affiliated with an organization profile |
| `twitter_check_follow_relationship` | Follow relationship between two user ids (who follows whom) |
| `twitter_user_tweets` | A user's recent original tweets (replies excluded) |
| `twitter_user_tweets_and_replies` | A user's full timeline (tweets + replies) |
| `twitter_user_tweets_complete` | A user's near-complete tweet history in one auto-paginated call |
| `twitter_user_media` | Images and videos a user has posted |
| `twitter_user_mentions` | Recent public tweets mentioning a user |
| `twitter_user_likes` | Tweets a user has liked (public Likes tab) |
| `twitter_user_followers` | Accounts that follow a user |
| `twitter_user_following` | Accounts a user follows |
| `twitter_user_followers_v2` | Followers with the v2 response shape (richer fields, deeper cursoring) |
| `twitter_user_following_v2` | Following with the v2 response shape (richer fields, deeper cursoring) |
| `twitter_user_verified_followers` | A user's verified followers only |
| `twitter_followers_you_know` | Followers of a target that your authenticated account also follows |
| `twitter_tweet_detail` | Single tweet: text, author, metrics, media, quoted/reply context |
| `twitter_tweet_replies` | Replies to a tweet |
| `twitter_tweet_thread` | Full author thread (connected tweet chain by same author) |
| `twitter_tweet_retweeters` | Accounts that retweeted a tweet |
| `twitter_list_members` | Members of a Twitter/X List |
| `twitter_home_timeline` | Your authenticated account's Home timeline _(session)_ |
| `twitter_bookmarks` | Your authenticated account's bookmarks _(session)_ |
| `twitter_blocking` | Accounts your authenticated account has blocked (your own list only) _(session)_ |
| `twitter_muting` | Accounts your authenticated account has muted (your own list only) _(session)_ |
| `twitter_bookmark_search` | Full-text search within your bookmarks _(session)_ |
| `twitter_bookmark_folders` | Your authenticated account's bookmark folders _(session)_ |
| `twitter_bookmark_folder_timeline` | Tweets inside one of your bookmark folders, by `folder_id` _(session)_ |
| `twitter_dm_list` | Your DM conversations (inbox), read-only _(session)_ |
| `twitter_dm_conversation` | Messages in one DM conversation, read-only _(session)_ |
| `twitter_trends` | Current top trends for a location (by `country` or `woeid`) |
| `twitter_trends_locations` | Every location X has trends for, each with its WOEID |
| `twitter_account_me` | Your twitterapis.com account: credits, usage, email (free) |
| `twitter_account_payments` | Your twitterapis.com payment history (free) |
| `twitter_media_status` | Processing state of an uploaded `media_id`; poll until `succeeded` before attaching video or GIF _(session)_ |
| `twitter_article_get` | Read a **published** article's full content via its announcement tweet id/url (public, no session) |
| `twitter_article_list` | List your own articles, filtered by `lifecycle` (`draft` or `published`) _(session)_ |

### Write actions _(require a linked X session)_

| Tool | What it does |
|---|---|
| `twitter_create_tweet` | Post a tweet; set `reply_to` to reply or `quote` to quote-tweet |
| `twitter_delete_tweet` | Delete one of your tweets (irreversible) |
| `twitter_favorite_tweet` / `twitter_unfavorite_tweet` | Like / unlike a tweet |
| `twitter_retweet` / `twitter_unretweet` | Retweet / undo retweet |
| `twitter_bookmark_tweet` / `twitter_unbookmark_tweet` | Bookmark / remove bookmark |
| `twitter_follow_user` / `twitter_unfollow_user` | Follow / unfollow a user by id |
| `twitter_dm_send` | Send a Direct Message to a user by their numeric `recipient_id` |
| `twitter_media_upload` | Upload a base64 image, returns a `media_id` for `twitter_create_tweet` |

### Articles _(X's long-form "Notes" feature; writes require a linked X session)_

| Tool | What it does |
|---|---|
| `twitter_article_create` | Start a new draft article, returns its `id` |
| `twitter_article_update_title` | Set a draft or published article's title |
| `twitter_article_update_content` | Replace a draft or published article's body (Draft.js `content_state` you build) |
| `twitter_article_publish` | Publish a draft, posting a **real public announcement tweet** (not fully reversible) |
| `twitter_article_unpublish` | Revert a published article to draft (leaves the announcement tweet up) |
| `twitter_article_delete` | Delete an article (draft: hard delete; published: unpublish + delete the announcement tweet), irreversible |

See also `twitter_article_get` and `twitter_article_list` above.

### Monitoring _(webhook delivery of new posts; free, not metered)_

Watch an X account for new posts and get them pushed to your own HTTPS endpoint, HMAC-signed, instead of polling. Register a webhook first, then create a monitor; every new post from a watched handle is delivered to every active webhook on your account (or a restricted subset via `webhook_ids`). Monitor/webhook CRUD is account administration, not a metered Twitter read, so every tool below is free.

| Tool | What it does |
|---|---|
| `twitter_monitor_create` | Start watching an X account (`handle`) for new posts |
| `twitter_monitor_list` | List every monitor on your account |
| `twitter_monitor_update` | Pause/resume a monitor or change its `webhook_ids` restriction |
| `twitter_monitor_delete` | Stop and remove a monitor (irreversible) |
| `twitter_monitor_health` | One monitor's status, degradation flag, poll interval, cursor position |
| `twitter_monitor_deliveries` | Recent delivery events across every monitor, with detection + delivery latency |
| `twitter_x_user_stream_add_user` | Compat drop-in for `twitter_monitor_create` using an x_user_stream-shaped envelope |
| `twitter_x_user_stream_remove_user` | Compat drop-in for `twitter_monitor_delete` using an x_user_stream-shaped envelope |
| `twitter_x_user_stream_list_users` | Compat drop-in for `twitter_monitor_list` using an x_user_stream-shaped envelope |
| `twitter_monitor_webhook_create` | Register an HTTPS delivery URL; returns the HMAC signing secret **once** |
| `twitter_monitor_webhook_list` | List every webhook registered on your account |
| `twitter_monitor_webhook_delete` | Soft-delete a webhook by id (irreversible from the caller's side) |
| `twitter_monitor_webhook_test` | Send one signed test event to a webhook right now, synchronously |

### Session setup

Link an X account to your key once, so the account-only reads and write actions act as it (or pass per-call `auth_token`/`ct0` instead).

| Tool | What it does |
|---|---|
| `twitter_customer_session` | Register your x.com session cookies (`auth_token` + `ct0`) against your key |
| `twitter_customer_session_delete` | Revoke that stored session, deleting your `auth_token` + `ct0` from the service. Idempotent and free |
| `twitter_user_login` | Log in with `username` + `password` (+ `totp_secret` for 2FA); stores the session against your key. Returns a confirmation, never the cookies |

## Usage examples

### Search for trending AI tweets

> "Find the most popular tweets about AI agents posted this week"

The agent calls `twitter_advanced_search` with:
```
query: "AI agents min_faves:200 since:2024-01-01"
product: "Top"
count: 20
```

### Pull a user's recent posts

> "Get the last 10 tweets from @sama"

The agent calls `twitter_user_tweets` with:
```
username: "sama"
count: 10
```

### Read a full thread

> "Get the full thread for this tweet: https://x.com/karpathy/status/1849....."

The agent calls `twitter_tweet_thread` with:
```
url: "https://x.com/karpathy/status/1849....."
```

### Paginate through followers

> "List the first 100 followers of @openai, then the next 100"

First call, `twitter_user_followers`: `{ username: "openai", count: 100 }`
Second call, pass back the `cursor` from the first response: `{ username: "openai", count: 100, cursor: "<cursor from response>" }`

### Monitor brand mentions

> "Show me recent tweets mentioning @twitterapis"

The agent calls `twitter_user_mentions` with:
```
username: "twitterapis"
count: 50
```

## Troubleshooting

**`HTTP 401 (invalid or missing API key)`** Check that `TWITTERAPIS_KEY` is set correctly in your MCP client config and matches the key shown in your [dashboard](https://www.twitterapis.com/dashboard).

**`HTTP 402 (insufficient credits)`** Top up at [twitterapis.com/dashboard](https://www.twitterapis.com/dashboard). Your first $0.50 is free at signup.

**`HTTP 403 (access forbidden)`** The account or tweet may be private/protected, or your plan does not include this endpoint.

**`HTTP 404 (not found)`** The user, tweet, or list may have been deleted, suspended, or the id/handle is wrong.

**`HTTP 429 (rate limited)`** Wait a few seconds and retry. If you hit this frequently, add `"TWITTERAPIS_TIMEOUT_MS": "60000"` to your env config and space out bulk requests.

**`Request failed: timed out after 30000ms`** The default timeout is 30 s. For large paginated fetches set `TWITTERAPIS_TIMEOUT_MS` to a higher value (e.g. `60000`).

**Tools do not appear in Claude / Cursor** Ensure `npx` is on your PATH and Node.js 18+ is installed (`node --version`). Check MCP client logs for startup errors.

## Pricing

Calls are billed to your twitterapis.com account. Almost every endpoint is $0.0008/call: all reads (search, profiles, tweets, followers, likes) plus the simple write actions (like, retweet, bookmark, follow and their undos, delete). At the read rate that works out to $0.04 per 1,000 tweets, since each call returns about 20 tweets. The premium endpoints cost a little more: tweet creation, sending a DM (`twitter_dm_send`), and DM reads (`twitter_dm_list`, `twitter_dm_conversation`) at $0.0016/call, full tweet history (`twitter_user_tweets_complete`) at $0.0024/call, a full tweet thread (`twitter_tweet_thread`) at $0.004/call, and the article-editing writes (`twitter_article_create`, `twitter_article_update_title`, `twitter_article_update_content`, `twitter_article_publish`, `twitter_article_unpublish`) at $0.0016/call (`twitter_article_get`, `twitter_article_list`, and `twitter_article_delete` stay at the standard $0.0008/call). Your first $0.50 is free. See [twitterapis.com/pricing](https://www.twitterapis.com/pricing).

## Links

- Docs: [docs.twitterapis.com](https://docs.twitterapis.com)
- Dashboard / API keys: [twitterapis.com/dashboard](https://www.twitterapis.com/dashboard)
- Pricing: [twitterapis.com/pricing](https://www.twitterapis.com/pricing)
- REST API base URL (call it directly, without MCP): `https://api.twitterapis.com`

## FAQ

**Do I need an X (Twitter) developer account?** No. Get an API key at [twitterapis.com/signup](https://www.twitterapis.com/signup); there is no application or approval step.

**Is it read-only?** No. 45 read tools work with just your API key; 29 write actions (post, like, retweet, follow, DM, media upload, article create/edit/publish/delete, monitor/webhook create/update/delete) act as a linked X account or per-call inline credentials, except monitor/webhook CRUD, which is account administration and needs only your API key.

**Which clients are supported?** Claude Desktop, Cursor, Windsurf, and VS Code (Copilot agent mode), or any Model Context Protocol client.

**How is it billed?** Per request. New keys start with $0.50 in free credits, no card required. See [pricing](https://www.twitterapis.com/pricing).

**Does it store my key or data?** No. The server holds no state and forwards your API key on each call.

## Maintainers

`src/tools.js` is **generated**. Do not edit it. The catalog is built at build time from two committed inputs:

- `test/openapi.snapshot.json`, a vendored copy of the published OpenAPI spec, which supplies the structure: which endpoints exist, which parameters each accepts, whether a parameter is required, and its type.
- `scripts/tools.overrides.mjs`, hand-authored, which supplies everything the spec cannot express: the tool and argument descriptions a model reads to decide how to call a tool, the cross-field rules ("provide exactly one of `username` or `user_id`"), the per-call credential arguments that travel as `x-*` headers, and the write / destructive / JSON-body flags.

The spec is vendored on purpose. Nothing is fetched at install time or at server boot, so the published package is a fixed artifact rather than one that depends on a hostname still answering.

```bash
npm run openapi:refresh   # re-vendor the spec, prints the route diff
npm run build             # regenerate src/tools.js
npm test                  # gates, incl. "src/tools.js matches the generator"
```

`npm test` fails if `src/tools.js` was hand-edited or left stale, if the catalog and the live spec disagree, or if the tool list and this README disagree.

## License

MIT
