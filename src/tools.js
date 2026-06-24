// Tool catalog + pure query-builder for @twitterapis/mcp.
// Kept separate from the server wiring (index.js) so it can be unit-tested
// without spawning the stdio transport.
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

// ── Read-only tool catalog. Tool arg names map 1:1 to endpoint query params. ─
export const TOOLS = [
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
    name: "twitter_user_tweets",
    path: "/twitter/user/tweets",
    description:
      "Get a user's recent original tweets, excluding replies and retweets. Returns tweet text, id, timestamp, and engagement metrics. Paginate with cursor to go further back. Use this to analyse a user's own content, opinions, or posting cadence. For replies too, use twitter_user_tweets_and_replies.",
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
];

// Pure query-string builder: drops undefined/null/empty values, URL-encodes the rest.
export function buildQuery(args) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(args || {})) {
    if (v !== undefined && v !== null && String(v).length > 0) qs.set(k, String(v));
  }
  return qs.toString();
}
