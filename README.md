# @twitterapis/mcp

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

37 tools: 27 reads and 10 write actions. Most user endpoints accept `username` (handle without @) **or** `user_id` (`twitter_user_likes` and `twitter_user_tweets_complete` require `user_id`); tweet endpoints accept `id` **or** `url`; paginated endpoints return a `cursor` you pass back to get the next page.

Public reads (search, profiles, tweets, followers) work with just your API key. The **account-only** reads (likes, bookmarks, DMs, home timeline, followers-you-know) and **all write actions** act AS an authenticated X account, so they need a session linked to your key first (returns HTTP 409 until then). Alternatively, pass **per-call inline credentials** on any of those tools (`auth_token` + `ct0`, with optional `proxy_url` / `user_agent`) to act AS that account for a single call without pre-registering a session, so one API key can act as many accounts. For write actions, set `proxy_url` to a residential proxy, since X soft-blocks writes that egress from datacenter IPs. Each write tool is annotated `readOnlyHint: false`; reversing actions (delete, unfollow, unlike, unretweet, unbookmark) are annotated `destructiveHint: true` so MCP clients can prompt before running them.

### Reads

| Tool | What it does |
|---|---|
| `twitter_advanced_search` | Search tweets with X operators (`from:`, `min_faves:`, `since:`, `filter:links`, etc.) |
| `twitter_user_search` | Find user accounts by name or keyword |
| `twitter_user_info` | Full profile by handle (bio, counts, verification, location) |
| `twitter_user_info_by_id` | Full profile by numeric user id |
| `twitter_user_about` | A user's structured About panel (category, professional labels, joined date) |
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
| `twitter_user_verified_followers` | A user's verified followers only |
| `twitter_followers_you_know` | Followers of a target that your authenticated account also follows |
| `twitter_tweet_detail` | Single tweet: text, author, metrics, media, quoted/reply context |
| `twitter_tweet_replies` | Replies to a tweet |
| `twitter_tweet_thread` | Full author thread (connected tweet chain by same author) |
| `twitter_tweet_retweeters` | Accounts that retweeted a tweet |
| `twitter_list_members` | Members of a Twitter/X List |
| `twitter_home_timeline` | Your authenticated account's Home timeline _(session)_ |
| `twitter_bookmarks` | Your authenticated account's bookmarks _(session)_ |
| `twitter_bookmark_search` | Full-text search within your bookmarks _(session)_ |
| `twitter_dm_list` | Your DM conversations (inbox), read-only _(session)_ |
| `twitter_dm_conversation` | Messages in one DM conversation, read-only _(session)_ |

### Write actions _(require a linked X session)_

| Tool | What it does |
|---|---|
| `twitter_create_tweet` | Post a tweet; set `reply_to` to reply or `quote` to quote-tweet |
| `twitter_delete_tweet` | Delete one of your tweets (irreversible) |
| `twitter_favorite_tweet` / `twitter_unfavorite_tweet` | Like / unlike a tweet |
| `twitter_retweet` / `twitter_unretweet` | Retweet / undo retweet |
| `twitter_bookmark_tweet` / `twitter_unbookmark_tweet` | Bookmark / remove bookmark |
| `twitter_follow_user` / `twitter_unfollow_user` | Follow / unfollow a user by id |

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

Calls are billed to your twitterapis.com account at the standard read rate ($0.0008/call, or $0.04 per 1,000 tweets (each call returns about 20 tweets)); your first $0.50 is free. See [twitterapis.com/pricing](https://www.twitterapis.com/pricing).

## Links

- Docs: [docs.twitterapis.com](https://docs.twitterapis.com)
- Dashboard / API keys: [twitterapis.com/dashboard](https://www.twitterapis.com/dashboard)
- REST API (without MCP): [api.twitterapis.com](https://api.twitterapis.com)
- Status: [twitterapis.com/status](https://www.twitterapis.com/status)

## License

MIT
