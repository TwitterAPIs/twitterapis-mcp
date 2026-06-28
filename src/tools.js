// Tool catalog + pure query-builder for @twitterapis/mcp.
// Kept separate from the server wiring (index.js) so it can be unit-tested
// without spawning the stdio transport.
//
// Each tool maps 1:1 to a REST endpoint at https://api.twitterapis.com. Tool
// arg names map 1:1 to endpoint query params (every endpoint, including the
// POST write actions, reads its params from the query string). A tool with
// `method: "POST"` is a write that acts on behalf of the authenticated account
// behind your API key; reads are GET and default when `method` is omitted.
import { z } from "zod";

// ── Shared Zod input-schema fragments ───────────────────────────────────────
const PAGINATION = {
  count: z.number().int().min(1).max(200).optional().describe(
    "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
  ),
  cursor: z.string().optional().describe(
    "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
  ),
};
const USER_REF = {
  username: z.string().optional().describe(
    'Twitter/X handle WITHOUT the leading @ (e.g. "elonmusk", "openai"). Provide exactly one of username or user_id.',
  ),
  user_id: z.string().optional().describe(
    'Numeric Twitter/X user id (e.g. "44196397"). Provide exactly one of username or user_id.',
  ),
};
const TWEET_REF = {
  id: z.string().optional().describe(
    'Tweet/post numeric id (e.g. "1789012345678901234"). Provide exactly one of id or url.',
  ),
  url: z.string().optional().describe(
    'Full tweet URL, e.g. "https://x.com/elonmusk/status/1789012345678901234". Provide exactly one of id or url.',
  ),
};
// Optional pooled-session selector, shared by every write action. A customer
// key maps to a default authenticated session; pass account only to target a
// specific handle in a multi-account pool.
const ACCOUNT = {
  account: z.string().optional().describe(
    "Optional. The @handle (without @) of the authenticated account to act AS, when your key manages more than one session. Omit to use your key's default session.",
  ),
};
// Per-call inline credentials. Pass an account's own X session cookies to act AS
// that account for this one call, without pre-registering a session, so a single
// API key can act as many accounts (e.g. polling several inboxes or posting from
// a pool). Sent as request headers, never in the URL. Omit to use the key's
// linked session.
const INLINE = {
  auth_token: z.string().optional().describe(
    "Optional. The account's auth_token cookie, to act AS that account for this call (must be paired with ct0). Sent as the x-auth-token header; never placed in the URL.",
  ),
  ct0: z.string().optional().describe(
    "Optional. The account's ct0 cookie, paired with auth_token. Sent as the x-ct0 header.",
  ),
  proxy_url: z.string().optional().describe(
    "Optional. Residential proxy URL to egress this call through. Recommended for writes: X soft-blocks writes from datacenter IPs as automated. Sent as the x-proxy-url header.",
  ),
  user_agent: z.string().optional().describe(
    "Optional. User-Agent string to send for this session. Sent as the x-user-agent header.",
  ),
};

// ── Tool catalog. Reads are GET (default); writes set method:"POST". ─────────
// write:true   -> action mutates account/Twitter state (annotated readOnlyHint:false)
// destructive:true -> action removes/reverses state (delete, un-follow/like/RT/bookmark)
export const TOOLS = [
  // ── Reads: search + discovery ──────────────────────────────────────────────
  {
    name: "twitter_advanced_search",
    path: "/twitter/tweet/advanced_search",
    description:
      "Search recent tweets using X's advanced-search operators. Supports from:, to:, since:YYYY-MM-DD, until:YYYY-MM-DD, min_faves:N, min_retweets:N, filter:links, -filter:replies, lang:en, and free-text. Returns tweet text, author info, engagement metrics, and a pagination cursor. Use product='Latest' for chronological results; 'Top' (default) for engagement-ranked. Example queries: 'AI agents min_faves:100', 'from:openai filter:links since:2024-01-01', '#buildinpublic -filter:replies lang:en'.",
    shape: {
      query: z.string().describe(
        "Full advanced-search query string. Supports X operators: from:handle, to:handle, since:YYYY-MM-DD, until:YYYY-MM-DD, min_faves:N, min_retweets:N, filter:links, filter:images, filter:videos, -filter:replies, lang:en, #hashtag, \"exact phrase\". Example: 'from:openai min_faves:500 since:2024-01-01'.",
      ),
      product: z.enum(["Top", "Latest", "Media", "People"]).optional().describe(
        "Result ranking mode. 'Latest' = reverse-chronological (best for monitoring). 'Top' = engagement-ranked (best for finding popular tweets, default when omitted). 'Media' = tweets with images/video. 'People' = matching user accounts.",
      ),
      ...PAGINATION,
    },
  },
  {
    name: "twitter_user_search",
    path: "/twitter/user/search",
    description:
      "Search for Twitter/X user accounts by name, keyword, or topic. Returns matching profiles (username, display name, bio, follower count, verification status) with a pagination cursor. Use this to discover accounts in a niche, find brand handles, or locate a person when you only know their name.",
    shape: {
      query: z.string().describe(
        "Name, keyword, or topic to search accounts for. Examples: 'OpenAI', 'AI researcher', 'tech founder'.",
      ),
      ...PAGINATION,
    },
  },
  {
    name: "twitter_user_info",
    path: "/twitter/user/info",
    description:
      "Get a user's complete public profile by their @handle: display name, bio, follower count, following count, verification status, location, website, account creation date, and pinned tweet. Use this before fetching tweets or followers to confirm the account exists and resolve the numeric user_id.",
    shape: {
      username: z.string().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. 'elonmusk', 'openai', 'sama').",
      ),
    },
  },
  {
    name: "twitter_user_info_by_id",
    path: "/twitter/user/info_by_id",
    description:
      "Get a user's complete public profile by their numeric user id. Identical response to twitter_user_info. Use this when you already have a user_id from a previous API response and want to avoid a handle lookup.",
    shape: {
      user_id: z.string().describe(
        "Numeric Twitter/X user id (e.g. '44196397' for @elonmusk). Found in responses from other tools as user_id or author_id.",
      ),
    },
  },
  {
    name: "twitter_user_about",
    path: "/twitter/user/user_about",
    description:
      "Get a user's 'About' panel: the structured profile facts X surfaces beyond the bio, such as account category, professional/business labels, joined date, and location when present. Provide a username or a user_id. Use this to enrich a profile beyond what twitter_user_info returns.",
    shape: { ...USER_REF },
  },
  {
    name: "twitter_user_affiliates",
    path: "/twitter/user/affiliates",
    description:
      "List the affiliated accounts of an organization profile (the smaller accounts X displays under a company's 'Affiliated' badge, e.g. employees or sub-brands). Provide a username or user_id. Returns profile data per affiliate plus a pagination cursor. Returns empty for accounts with no affiliations.",
    shape: {
      ...USER_REF,
      team: z.string().optional().describe(
        "Optional team/sub-group name to filter affiliates by, when the org exposes named teams.",
      ),
      ...PAGINATION,
    },
  },
  {
    name: "twitter_check_follow_relationship",
    path: "/twitter/user/check_follow_relationship",
    description:
      "Check the follow relationship between two accounts by numeric user id: whether the source follows the target, whether the target follows the source, blocking/muting flags where available. Both ids are required. Use this to verify a follow before/after a follow action, or to detect mutuals.",
    shape: {
      source_user_id: z.string().describe(
        "Numeric user id of the SOURCE account (the 'is this account following...' subject).",
      ),
      target_user_id: z.string().describe(
        "Numeric user id of the TARGET account (the '...the target?' object).",
      ),
    },
  },
  // ── Reads: a user's tweets / timeline ──────────────────────────────────────
  {
    name: "twitter_user_tweets",
    path: "/twitter/user/tweets",
    description:
      "Get a user's recent original tweets, excluding replies and retweets. Returns tweet text, id, timestamp, and engagement metrics. Paginate with cursor to go further back. Use this to analyse a user's own content, opinions, or posting cadence. For replies too, use twitter_user_tweets_and_replies; for the full back-catalogue in one call, use twitter_user_tweets_complete.",
    shape: { ...USER_REF, ...PAGINATION },
  },
  {
    name: "twitter_user_tweets_and_replies",
    path: "/twitter/user/tweets_and_replies",
    description:
      "Get a user's full activity timeline: their original tweets AND replies to others. Useful for understanding how someone engages with a community, not just what they post. Paginate with cursor. To see only original tweets, use twitter_user_tweets.",
    shape: { ...USER_REF, ...PAGINATION },
  },
  {
    name: "twitter_user_tweets_complete",
    path: "/twitter/user/tweets/complete",
    description:
      "Get a user's near-complete original-tweet history in a single call, auto-paginating server-side up to a cap (Twitter's ~3200-tweet per-user ceiling). Heavier than twitter_user_tweets; use when you want the whole back-catalogue at once rather than page-by-page. Returns a flat tweet array. Requires the numeric user_id (resolve a handle first with twitter_user_info).",
    shape: {
      user_id: z.string().describe(
        "Numeric Twitter/X user id. Required: this endpoint does not accept a username. Resolve a handle to a user_id first with twitter_user_info.",
      ),
      max: z.number().int().min(1).max(3200).optional().describe(
        "Maximum number of tweets to collect (default 800, hard ceiling 3200). Higher values take longer and cost more.",
      ),
    },
  },
  {
    name: "twitter_user_media",
    path: "/twitter/user/media",
    description:
      "Get the images and videos a user has posted. Returns media-containing tweets with URLs to the media files, dimensions, and type (photo/video/animated_gif). Paginate with cursor. Use this to pull a user's visual content history.",
    shape: { ...USER_REF, ...PAGINATION },
  },
  {
    name: "twitter_user_mentions",
    path: "/twitter/user/mentions",
    description:
      "Get recent public tweets that mention (@ tag) a user. Searches for tweets directed at the username using the to: operator. Returns matching tweets with author info and metrics. Paginate with cursor. Use this to monitor brand mentions, replies directed at an account, or public conversations about a person.",
    shape: {
      username: z.string().describe(
        "Twitter/X handle WITHOUT the leading @ of the user to find mentions for (e.g. 'openai' to find tweets mentioning @openai).",
      ),
      ...PAGINATION,
    },
  },
  {
    name: "twitter_user_likes",
    path: "/twitter/user/likes",
    description:
      "Get the tweets a user has liked (their public Likes tab), most recent first. Returns each liked tweet with author and metrics, plus a pagination cursor. Use this to infer interests or find content a user has endorsed. Returns empty if the account hides its likes. Requires the numeric user_id (resolve a handle first with twitter_user_info).",
    shape: {
      user_id: z.string().describe(
        "Numeric Twitter/X user id (e.g. '44196397'). Required: this endpoint does not accept a username. Resolve a handle to a user_id first with twitter_user_info.",
      ),
      ...PAGINATION,
    },
  },
  // ── Reads: followers / following graph ─────────────────────────────────────
  {
    name: "twitter_user_followers",
    path: "/twitter/user/followers",
    description:
      "List the accounts that follow a given user. Returns profile data for each follower (username, display name, bio, follower count). Paginate with cursor for large audiences. Useful for audience analysis, finding who follows a brand or influencer.",
    shape: { ...USER_REF, ...PAGINATION },
  },
  {
    name: "twitter_user_following",
    path: "/twitter/user/following",
    description:
      "List the accounts that a given user follows. Returns profile data for each account followed. Paginate with cursor. Useful for mapping a user's information sources, influencer networks, or competitor monitoring lists.",
    shape: { ...USER_REF, ...PAGINATION },
  },
  {
    name: "twitter_user_verified_followers",
    path: "/twitter/user/verified_followers",
    description:
      "List a user's followers who have a verified account (checkmark). Filters the follower list to verified accounts only, useful for identifying notable or institutional followers. Paginate with cursor.",
    shape: { ...USER_REF, ...PAGINATION },
  },
  {
    name: "twitter_followers_you_know",
    path: "/twitter/user/followers_you_know",
    description:
      "List the 'Followers you know' for a target user id: the followers of that account that YOUR authenticated account also follows (mutual-connection overlap). Requires an authenticated session behind your key. Returns profile data per overlap account plus a cursor.",
    shape: {
      user_id: z.string().describe(
        "Numeric user id of the target account to compute shared followers against.",
      ),
      ...PAGINATION,
      ...INLINE,
    },
  },
  // ── Reads: a single tweet + its conversation ───────────────────────────────
  {
    name: "twitter_tweet_detail",
    path: "/twitter/tweet/detail",
    description:
      "Get the full detail of a single tweet: text, author profile, post timestamp, like/retweet/reply/quote counts, attached media, referenced quoted tweet, and parent reply context. Use this to inspect a specific tweet before fetching its replies or thread. Accepts either the tweet id or its full URL.",
    shape: { ...TWEET_REF },
  },
  {
    name: "twitter_tweet_replies",
    path: "/twitter/tweet/replies",
    description:
      "Get replies to a specific tweet. Returns each reply tweet with author, text, and metrics. Paginate with cursor to load more. Use this to read the conversation under a tweet, gauge sentiment, or find notable responses.",
    shape: { ...TWEET_REF, ...PAGINATION },
  },
  {
    name: "twitter_tweet_thread",
    path: "/twitter/tweet/thread",
    description:
      "Get all tweets in a thread: the connected chain of tweets posted by the SAME author in sequence (a tweetstorm or numbered thread). Pass any tweet id/url from the thread and the API returns the full ordered sequence. Paginate with cursor for long threads. Does NOT return replies from other users, use twitter_tweet_replies for that.",
    shape: { ...TWEET_REF, ...PAGINATION },
  },
  {
    name: "twitter_tweet_retweeters",
    path: "/twitter/tweet/retweeters",
    description:
      "List the accounts that retweeted a specific tweet. Returns profile data for each retweeter. Paginate with cursor. Useful for finding who amplified a piece of content or mapping a tweet's distribution network.",
    shape: { ...TWEET_REF, ...PAGINATION },
  },
  {
    name: "twitter_list_members",
    path: "/twitter/list/members",
    description:
      "List the members of a Twitter/X List by its numeric list id. Returns profile data for each member. Paginate with cursor. Use this to enumerate curated account sets, including competitor lists, industry watchlists, or media outlet lists. The list_id appears in the X.com list URL (x.com/i/lists/<list_id>).",
    shape: {
      list_id: z.string().describe(
        "Numeric Twitter/X List id. Found in the list URL: x.com/i/lists/<list_id>.",
      ),
      ...PAGINATION,
    },
  },
  // ── Reads: authenticated-account surfaces (require a session behind your key) ─
  {
    name: "twitter_home_timeline",
    path: "/twitter/user/home_timeline",
    description:
      "Get YOUR authenticated account's Home timeline (the 'Following'/'For you' feed), most recent first. Requires an authenticated session behind your key. Returns tweets with author and metrics plus a cursor. Use this to read what your account would see when it opens X.",
    shape: { ...PAGINATION, ...INLINE },
  },
  {
    name: "twitter_bookmarks",
    path: "/twitter/user/bookmarks",
    description:
      "List YOUR authenticated account's bookmarked tweets, most recent first. Requires an authenticated session behind your key. Returns each bookmarked tweet with author and metrics plus a cursor.",
    shape: { ...PAGINATION, ...INLINE },
  },
  {
    name: "twitter_bookmark_search",
    path: "/twitter/user/bookmark_search",
    description:
      "Full-text search within YOUR authenticated account's bookmarks. Requires an authenticated session behind your key. Returns matching bookmarked tweets plus a cursor. Use this to retrieve a previously bookmarked tweet by keyword.",
    shape: {
      query: z.string().describe(
        "Search terms to match against your bookmarked tweets' text.",
      ),
      ...PAGINATION,
      ...INLINE,
    },
  },
  {
    name: "twitter_dm_list",
    path: "/twitter/dm/list",
    description:
      "List YOUR authenticated account's Direct Message conversations (inbox), each with the participant and a conversation_id you can pass to twitter_dm_conversation. Requires an authenticated session behind your key. Read-only: this does not send DMs.",
    shape: { ...INLINE },
  },
  {
    name: "twitter_dm_conversation",
    path: "/twitter/dm/conversation",
    description:
      "Get the messages in one Direct Message conversation by its conversation_id (from twitter_dm_list). Requires an authenticated session behind your key. Returns each message with sender id, time, and text. Read-only: this does not send DMs.",
    shape: {
      conversation_id: z.string().describe(
        "The conversation_id from a twitter_dm_list entry identifying which DM thread to read.",
      ),
      ...INLINE,
    },
  },

  // ── Writes: tweet authoring ────────────────────────────────────────────────
  {
    name: "twitter_create_tweet",
    path: "/twitter/tweet/create",
    method: "POST",
    write: true,
    description:
      "Post a new tweet AS your authenticated account. Set reply_to to post a reply, or quote to post a quote-tweet. This publishes publicly and is not silently reversible (use twitter_delete_tweet to remove it). Requires an authenticated session with write capability behind your key. Returns the new tweet_id and url.",
    shape: {
      text: z.string().min(1).describe(
        "The tweet body text (1 to 280 characters, or longer if the account has extended limits).",
      ),
      reply_to: z.string().optional().describe(
        "Optional. Numeric id of the tweet to reply to. When set, this tweet is posted as a reply in that conversation.",
      ),
      quote: z.string().optional().describe(
        "Optional. Numeric id of the tweet to quote. When set, this tweet quote-tweets that tweet.",
      ),
      media_ids: z.string().optional().describe(
        "Optional. Comma-separated media id(s) from a prior media upload to attach (images/video).",
      ),
      ...ACCOUNT, ...INLINE,
    },
  },
  {
    name: "twitter_delete_tweet",
    path: "/twitter/tweet/delete",
    method: "POST",
    write: true,
    destructive: true,
    description:
      "Delete a tweet AS your authenticated account. Irreversible: the tweet is permanently removed. You can only delete tweets your authenticated account authored. Provide the tweet id or url. Requires write capability behind your key.",
    shape: { ...TWEET_REF, ...ACCOUNT, ...INLINE },
  },
  // ── Writes: engagement (favorite / retweet / bookmark) + inverses ──────────
  {
    name: "twitter_favorite_tweet",
    path: "/twitter/tweet/favorite",
    method: "POST",
    write: true,
    description:
      "Like (favorite) a tweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key. Reverse with twitter_unfavorite_tweet.",
    shape: { ...TWEET_REF, ...ACCOUNT, ...INLINE },
  },
  {
    name: "twitter_unfavorite_tweet",
    path: "/twitter/tweet/unfavorite",
    method: "POST",
    write: true,
    destructive: true,
    description:
      "Remove a like (unfavorite) from a tweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key.",
    shape: { ...TWEET_REF, ...ACCOUNT, ...INLINE },
  },
  {
    name: "twitter_retweet",
    path: "/twitter/tweet/retweet",
    method: "POST",
    write: true,
    description:
      "Retweet a tweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key. Reverse with twitter_unretweet.",
    shape: { ...TWEET_REF, ...ACCOUNT, ...INLINE },
  },
  {
    name: "twitter_unretweet",
    path: "/twitter/tweet/unretweet",
    method: "POST",
    write: true,
    destructive: true,
    description:
      "Undo a retweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key.",
    shape: { ...TWEET_REF, ...ACCOUNT, ...INLINE },
  },
  {
    name: "twitter_bookmark_tweet",
    path: "/twitter/tweet/bookmark",
    method: "POST",
    write: true,
    description:
      "Bookmark a tweet to YOUR authenticated account's private bookmarks. Provide the tweet id or url. Requires write capability behind your key. Reverse with twitter_unbookmark_tweet.",
    shape: { ...TWEET_REF, ...ACCOUNT, ...INLINE },
  },
  {
    name: "twitter_unbookmark_tweet",
    path: "/twitter/tweet/unbookmark",
    method: "POST",
    write: true,
    destructive: true,
    description:
      "Remove a tweet from YOUR authenticated account's bookmarks. Provide the tweet id or url. Requires write capability behind your key.",
    shape: { ...TWEET_REF, ...ACCOUNT, ...INLINE },
  },
  // ── Writes: follow graph ───────────────────────────────────────────────────
  {
    name: "twitter_follow_user",
    path: "/twitter/user/follow",
    method: "POST",
    write: true,
    description:
      "Follow a user AS your authenticated account, by numeric user_id. Requires write capability behind your key. Reverse with twitter_unfollow_user.",
    shape: {
      user_id: z.string().describe(
        "Numeric user id of the account to follow. Resolve a handle to a user_id first with twitter_user_info.",
      ),
      ...ACCOUNT, ...INLINE,
    },
  },
  {
    name: "twitter_unfollow_user",
    path: "/twitter/user/unfollow",
    method: "POST",
    write: true,
    destructive: true,
    description:
      "Unfollow a user AS your authenticated account, by numeric user_id. Requires write capability behind your key.",
    shape: {
      user_id: z.string().describe(
        "Numeric user id of the account to unfollow.",
      ),
      ...ACCOUNT, ...INLINE,
    },
  },
];

// Pure query-string builder: drops undefined/null/empty values, URL-encodes the rest.
export function buildQuery(args) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(args || {})) {
    if (v !== undefined && v !== null && String(v).length > 0) qs.set(k, String(v));
  }
  return qs.toString();
}
