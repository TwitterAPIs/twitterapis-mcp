// GENERATED FILE. DO NOT EDIT BY HAND.
//
// Built by scripts/gen-tools.mjs from:
//   test/openapi.snapshot.json    the vendored REST contract (structure)
//   scripts/tools.overrides.mjs   the hand-authored agent-facing layer (prose)
//
// Edit one of those two, then run `npm run build`. `npm test` regenerates this
// file in memory and fails if it does not match what is committed, so a hand edit
// here is caught rather than shipped.
//
// Catalog: 86 tools (55 reads, 31 writes).
//
// Each tool maps 1:1 to a REST endpoint at https://api.twitterapis.com. Tool arg
// names map 1:1 to endpoint query params (every endpoint, including the POST
// write actions, reads its params from the query string), except the per-call
// inline credentials, which travel as x-* request headers, the 9
// jsonBody tools, whose fields travel in a JSON request body, and any arg listed
// in pathParams, which is substituted into the URL path (e.g. {id}) instead. A
// tool with `method: "POST"` or `method: "DELETE"` is a write that acts on
// behalf of the authenticated account behind your API key; reads are GET and
// default when `method` is omitted.
//
// write:true       -> action mutates account/Twitter state (readOnlyHint:false)
// destructive:true -> action removes/reverses state (delete, un-follow/like/RT/bookmark)
// pathParams        -> arg names substituted into the URL template, not sent as
//                      query-string or body fields (e.g. ["id"] for /monitor/{id})
import { z } from "zod";

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
      product: z.enum(["Top","Latest","Media","People"]).optional().describe(
        "Result ranking mode. 'Latest' = reverse-chronological (best for monitoring). 'Top' = engagement-ranked (best for finding popular tweets, default when omitted). 'Media' = tweets with images/video. 'People' = matching user accounts.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
    name: "twitter_user_status",
    path: "/twitter/user/status",
    description:
      "Check whether a Twitter/X account is alive, suspended, or deleted. Returns a status field that is one of 'alive', 'suspended', 'not_found', or 'unavailable', plus the numeric id when the account is alive and X's own reason when it gives one. Use this instead of twitter_user_info when the QUESTION is whether the account still exists: user info answers a suspended account, a deleted account, and a handle that never existed all the same way, so it cannot tell a ban from a typo. Every outcome here is a successful response, so read the status field rather than treating a suspension as an error. A protected (private) account counts as alive, since protection is a visibility setting and not an account state.",
    shape: {
      userName: z.string().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. 'elonmusk', 'openai', 'sama').",
      ),
    },
  },
  {
    name: "twitter_user_about",
    path: "/twitter/user/user_about",
    description:
      "Get a user's full 'About' object: the structured profile facts X surfaces beyond the bio, including account category and professional/business labels, verification and identity-verification flags, joined date, location and linked website, follower/following counts, and X's 'About this account' transparency panel (the account's country, how the account was created, and its username-change history). Provide a username or a user_id. Use this to enrich a profile beyond what twitter_user_info returns.",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id.",
      ),
    },
  },
  {
    name: "twitter_user_affiliates",
    path: "/twitter/user/affiliates",
    description:
      "List the affiliated accounts of an organization profile (the smaller accounts X displays under a company's 'Affiliated' badge, e.g. employees or sub-brands). Provide a username or user_id. Returns profile data per affiliate plus a pagination cursor. Returns empty for accounts with no affiliations.",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id.",
      ),
      team: z.string().optional().describe(
        "Optional team/sub-group name to filter affiliates by, when the org exposes named teams.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
  {
    name: "twitter_user_tweets",
    path: "/twitter/user/tweets",
    description:
      "Get a user's recent posting timeline. IMPORTANT: this endpoint does NOT filter server-side, so the response routinely includes retweets and replies alongside original posts. Every item carries is_retweet, is_reply and is_quote booleans, so filter client-side on those flags if you need originals only, and read author.username rather than assuming every item was written by the requested user (a retweet's retweeted_tweet holds the original author). Returns tweet text, id, timestamp, and engagement metrics. Paginate with cursor to go further back. For the full back-catalogue in one call, use twitter_user_tweets_complete.",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
  },
  {
    name: "twitter_user_tweets_and_replies",
    path: "/twitter/user/tweets_and_replies",
    description:
      "Get a user's full activity timeline: their original tweets AND replies to others. Useful for understanding how someone engages with a community, not just what they post. Paginate with cursor. Items carry is_retweet, is_reply and is_quote booleans; filter on those if you need a specific subset. Note that twitter_user_tweets does NOT filter replies or retweets out either, so on many accounts the two endpoints return overlapping or identical pages.",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
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
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
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
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
  },
  {
    name: "twitter_user_followers",
    path: "/twitter/user/followers",
    description:
      "List the accounts that follow a given user. Returns profile data for each follower (username, display name, bio, follower count). Paginate with cursor for large audiences. Useful for audience analysis, finding who follows a brand or influencer.",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
  },
  {
    name: "twitter_user_following",
    path: "/twitter/user/following",
    description:
      "List the accounts that a given user follows. Returns profile data for each account followed. Paginate with cursor. Useful for mapping a user's information sources, influencer networks, or competitor monitoring lists.",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
  },
  {
    name: "twitter_user_followers_v2",
    path: "/twitter/user/followers_v2",
    description:
      "List a user's followers using the v2 response shape (richer profile fields and more reliable cursoring for large audiences). Same inputs as twitter_user_followers; prefer this when you need the fuller v2 payload or are paging deep follower lists.",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
  },
  {
    name: "twitter_user_following_v2",
    path: "/twitter/user/following_v2",
    description:
      "List the accounts a user follows using the v2 response shape (richer profile fields and more reliable cursoring). Same inputs as twitter_user_following; prefer this when you need the fuller v2 payload or are paging deep following lists.",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
  },
  {
    name: "twitter_user_verified_followers",
    path: "/twitter/user/verified_followers",
    description:
      "List a user's followers who have a verified account (checkmark). Filters the follower list to verified accounts only, useful for identifying notable or institutional followers. Paginate with cursor.",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
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
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
    },
  },
  {
    name: "twitter_tweet_detail",
    path: "/twitter/tweet/detail",
    description:
      "Get the full detail of a single tweet: text, author profile, post timestamp, like/retweet/reply/quote counts, attached media, referenced quoted tweet, and parent reply context. Use this to inspect a specific tweet before fetching its replies or thread. Accepts either the tweet id or its full URL.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
    },
  },
  {
    name: "twitter_tweet_replies",
    path: "/twitter/tweet/replies",
    description:
      "Get replies to a specific tweet. Returns each reply tweet with author, text, and metrics. Paginate with cursor to load more. Use this to read the conversation under a tweet, gauge sentiment, or find notable responses.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
  },
  {
    name: "twitter_tweet_thread",
    path: "/twitter/tweet/thread",
    description:
      "Get all tweets in a thread: the connected chain of tweets posted by the SAME author in sequence (a tweetstorm or numbered thread). Pass any tweet id/url from the thread and the API returns the full ordered sequence in a single call. Does NOT return replies from other users, use twitter_tweet_replies for that. Accepts either the tweet id or its full URL.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
    },
  },
  {
    name: "twitter_tweet_retweeters",
    path: "/twitter/tweet/retweeters",
    description:
      "List the accounts that retweeted a specific tweet. Returns profile data for each retweeter. Paginate with cursor. Useful for finding who amplified a piece of content or mapping a tweet's distribution network.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
  },
  {
    name: "twitter_tweet_quotes",
    path: "/twitter/tweet/quotes",
    description:
      "List the tweets that QUOTE a specific tweet, cursor-paginated as full tweet objects, so you get the commentary people attached rather than just a number. Different from twitter_tweet_retweeters (a plain retweet carries no text) and from twitter_tweet_replies (a reply is not a quote). IMPORTANT, state this to the user whenever you report a number from it: this endpoint is SEARCH-BACKED, because X exposes no dedicated quote-tweets operation, so it runs the query quoted_tweet_id:<id> against X's search index. The returned 'count' is therefore how many quotes THIS SEARCH returned, never the tweet's true total; the authoritative total is 'quote_count' on the tweet object from twitter_tweet_detail, and the two WILL differ because of index lag and because deleted, protected, suspended and region-withheld quotes are absent from search. Every response carries 'source' (always \"search\"), 'search_query' (the exact query sent), and 'quote_matched' (how many returned tweets demonstrably quote the requested id). quote_matched equal to count means every row is genuine; quote_matched 0 on a NON-EMPTY page means X stopped honouring the operator and the rows are junk, so discard that page rather than reporting it.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
      product: z.enum(["Latest","Top"]).optional().describe(
        "Search ordering. 'Latest' (default) is reverse-chronological and cheap. 'Top' is X's ranked ordering and is materially slower upstream. Any other value falls back to Latest rather than changing what the tool means.",
      ),
      strict: z.string().optional().describe(
        "Set true to DROP every returned row that does not demonstrably quote the requested tweet, instead of only counting them in quote_matched. Default false, because X does not embed the quoted original on every search result, so strict trades a false-positive risk for a false-negative one. Billing follows what you receive, so rows dropped by strict are not charged.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max quote tweets to request for this page. Defaults to 20 and is clamped to 1-100 by the underlying search, so a larger number returns at most 100 rather than erroring.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call.",
      ),
    },
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
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
    },
  },
  {
    name: "twitter_spaces_info",
    path: "/twitter/spaces/info",
    description:
      "Get metadata and the participant roster for one X Space by id, live or ended: title, lifecycle state (Scheduled, NotStarted, Running or Ended), host, topics, scheduled and actual start/end times, peak live listener count, replay view count, and the admin, speaker and listener rosters. Returns metadata only, NOT the Space audio. Note that X does not retain the per-person listener roster once a Space ends, so listeners comes back empty for an ended Space while total_live_listeners and total_replay_watched still reflect the real audience. All timestamps are millisecond-epoch numbers.",
    shape: {
      id: z.string().describe(
        "The Space id: the trailing token of a x.com/i/spaces/<id> URL, e.g. '1RKZzjkoYRAKB'. A '/peek' suffix on the URL is not part of the id.",
      ),
      with_listeners: z.string().optional().describe(
        "Optional. Include the listener roster. Defaults to true. X drops this roster once a Space ends, so it is empty for an ended Space regardless of this flag.",
      ),
      with_replays: z.string().optional().describe(
        "Optional. Include replay availability and related metadata. Defaults to true.",
      ),
    },
  },
  {
    name: "twitter_community_info",
    path: "/twitter/community/info",
    description:
      "Get the metadata for one X Community by its numeric id: name, description, member_count, moderator_count, join_policy, invites_policy, the join question, primary topic, search tags, the posted rules, both the custom and the default banner plus a resolved banner_url, the permalink, the admin and creator profiles, and the facepile member ids. The community id is the digits in a x.com/i/communities/<id> URL. IMPORTANT: role, can_join, is_pinned and viewer_relationship_type are ALWAYS null here and that is deliberate, not an error, because they describe the account that made the call and this is a pooled read served by a rotating account. rules[].description is also always null: X sends only the rule id and name on this payload. Use twitter_community_members for the roster and twitter_community_tweets for the posts.",
    shape: {
      community_id: z.string().describe(
        "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'. Digits only. This is NOT a Space id (those are base-62 tokens) and NOT a user id.",
      ),
    },
  },
  {
    name: "twitter_community_members",
    path: "/twitter/community/members",
    description:
      "List the member roster of an X Community, cursor-paginated, with each row carrying that member's own role in the community: 'Admin', 'Moderator' or 'Member'. Rows are { user, role }. The user object is deliberately REDUCED (id, username, name, profile_image_url, is_blue_verified, verified, is_protected) because X's roster operation sends no bio, no follower or following counts and no created_at; call twitter_user_info with an id when the full profile is needed. Note that the role on a member ROW is NOT caller-relative and is returned in full, unlike the role field on the community object itself. Admins and moderators are interleaved through this list at arbitrary positions, so do NOT derive a moderator list by filtering the first page: use twitter_community_moderators. Paging is a bare next_cursor with no total count from X; stop when members comes back empty or has_more is false.",
    shape: {
      community_id: z.string().describe(
        "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max roster rows to return for this page. Defaults to 20 and is clamped to 1-100, so a larger number returns 100 rather than erroring.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call. Absence of next_cursor is the only end-of-list signal X gives on this operation.",
      ),
    },
  },
  {
    name: "twitter_community_moderators",
    path: "/twitter/community/moderators",
    description:
      "List the moderators and admins of an X Community, cursor-paginated, in the same { user, role } row shape twitter_community_members returns (the array is also called members, deliberately, so the two cannot drift apart). This is a SEPARATE upstream operation, not a filter over the member roster, and that matters for correctness: moderators sit at arbitrary positions inside the full roster, so filtering one page of twitter_community_members would return 'the moderators among the first 20 members' while looking like a complete answer. Read each row's role rather than assuming every row is a Moderator, since admins appear here too. Paging is a bare next_cursor with no total count from X.",
    shape: {
      community_id: z.string().describe(
        "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max rows to return for this page. Defaults to 20 and is clamped to 1-100.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call.",
      ),
    },
  },
  {
    name: "twitter_community_tweets",
    path: "/twitter/community/tweets",
    description:
      "Read an X Community's own post timeline, cursor-paginated as full tweet objects, with the community's PINNED post returned as its own separate 'pinned' field rather than as an item inside 'tweets'. That split is not cosmetic: X delivers the pinned post under a different timeline instruction and does not repeat it in the feed, so a client that iterates only 'tweets' silently loses it, and it is very often the community's rules post, the single most useful item in the response. To build one flat list, read 'pinned' first if non-null, then 'tweets' (the pinned post is excluded from 'tweets', so there is no duplicate). ranking_mode is a REAL upstream parameter, not a local sort. Use twitter_advanced_search instead when the search should span all of X rather than one community.",
    shape: {
      community_id: z.string().describe(
        "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'.",
      ),
      ranking_mode: z.enum(["Recency","Relevance"]).optional().describe(
        "Ordering, sent to X as a real request parameter. 'Recency' is the default and the only value confirmed against a live capture. 'Relevance' is accepted because X's own community tab offers exactly two orderings, but it is NOT confirmed live, so do not depend on it. Any other value is rejected with a 400.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max posts to return for this page. Defaults to 20 and is clamped to 1-100.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call.",
      ),
    },
  },
  {
    name: "twitter_community_memberships",
    path: "/twitter/community/memberships",
    description:
      "The INVERSE community lookup: given a numeric X USER id, list the communities that account belongs to, cursor-paginated. Every other community tool starts from a community; this one starts from an account, which makes it the tool for profiling which audiences a person sits inside. Each row is the FULL community object (the same shape twitter_community_info returns, with member counts, rules, topic, policies, admin and creator), so no follow-up call per community is needed. Takes a numeric user id ONLY, not a @handle: resolve a handle with twitter_user_info first, because resolving it here would silently cost a second call. An EMPTY communities array is a real, successful answer (the account is in no communities), not a not-found. As on twitter_community_info, role / can_join / is_pinned / viewer_relationship_type are always null on every community returned, because this is a pooled read.",
    shape: {
      user_id: z.string().describe(
        "Numeric X user id, e.g. '1281109705495130113'. NOT a @handle and NOT a community id. Resolve a handle to its id with twitter_user_info first.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max communities to return for this page. Defaults to 20 and is clamped to 1-100.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call.",
      ),
    },
  },
  {
    name: "twitter_grok_chat",
    path: "/twitter/grok/chat",
    method: "POST",
    write: true,
    description:
      "Ask X's own Grok a question AS your authenticated account, and get ONE complete JSON reply with the answer plus the sources it cited. Unlike a general LLM, Grok reads X in real time, so it can answer about what is being said right now, and passing a bare tweet or status URL as the message returns a structured summary of that post. Returns answer text, citations (url, title, snippet) merged and de-duplicated across every search Grok ran, the searches themselves, and the model that ACTUALLY answered (which can differ from the one you asked for). Buffered, not streamed. STATELESS: nothing is stored, so to continue a conversation pass the prior turns back in messages[] along with conversation_id. Requires an authenticated session for the acting account.",
    shape: {
      message: z.string().optional().describe(
        "The prompt, for a single-turn question. A bare tweet or status URL is a first-class input and comes back as a summary of that post. Provide either this or messages[].",
      ),
      messages: z.string().optional().describe(
        "Prior turns for a multi-turn conversation, oldest first, each { role: 'user' | 'grok', content: '...' }. The endpoint stores nothing, so the full history you want Grok to see must travel in this array. Provide either this or message.",
      ),
      conversation_id: z.string().optional().describe(
        "Conversation id returned by a previous call. Omit on the first turn and one is created for you.",
      ),
      mode: z.string().optional().describe(
        "Which Grok to use: 'auto' (default, balanced), 'fast' (quicker, less thorough) or 'expert' (slowest, most thorough). The response reports the model that actually answered, which can differ from the mode requested.",
      ),
      image_count: z.number().int().optional().describe(
        "How many images Grok may generate if the prompt calls for one. Defaults to the value X's own client sends. Set 0 for a text-only answer.",
      ),
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
    },
  },
  {
    name: "twitter_grok_config",
    path: "/twitter/grok/config",
    description:
      "Check whether the authenticated account can use Grok, and which models it may pick. Returns eligibility, X's own reasons when it is NOT eligible (passed through verbatim, since we cannot know X's policy), whether free access is enabled, and the available model options. Eligibility is a property of the X ACCOUNT rather than of the API key, so ask this about the same account you intend to run twitter_grok_chat as. Free.",
    shape: {
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
    },
  },
  {
    name: "twitter_trends",
    path: "/twitter/trends",
    description:
      "Get the current top trends for a location. With no location parameter, returns Worldwide (WOEID 1, X's own default). Pass country (an ISO code or country name, e.g. 'US' or 'Japan') or a numeric woeid from twitter_trends_locations; woeid wins when both are given. Returns the resolved location, the as_of / created_at timestamps, and the ranked trends list. Use count to truncate the list. A location X will not serve returns a 400.",
    shape: {
      country: z.string().optional().describe(
        "Country name or ISO code to get trends for, e.g. 'US' or 'Japan'. Resolved against the trends locations list. Omit for Worldwide.",
      ),
      woeid: z.string().optional().describe(
        "Numeric WOEID from twitter_trends_locations. Takes precedence over country when both are supplied.",
      ),
      count: z.number().int().min(1).optional().describe(
        "Truncate the returned trends list to at most this many. Omit to return X's full list for the location.",
      ),
    },
  },
  {
    name: "twitter_trends_locations",
    path: "/twitter/trends/locations",
    description:
      "List every location X publishes trends for, each with the numeric WOEID to pass back to twitter_trends as woeid. Takes no parameters. Use this to resolve a country or city to its WOEID before requesting trends for that place.",
    shape: {},
  },
  {
    name: "twitter_account_me",
    path: "/account/me",
    description:
      "Get YOUR twitterapis.com account details: email, name, credits remaining, credits used, total requests made, and account creation date. Authenticated by your API key. This is an account read, not Twitter data, and is free (it does not spend credits).",
    shape: {},
  },
  {
    name: "twitter_account_payments",
    path: "/account/payments",
    description:
      "Get YOUR twitterapis.com payment history: the list of top-ups and charges on your account. Authenticated by your API key. This is an account read, not Twitter data, and is free (it does not spend credits).",
    shape: {},
  },
  {
    name: "twitter_home_timeline",
    path: "/twitter/user/home_timeline",
    description:
      "Get YOUR authenticated account's Home timeline (the 'Following'/'For you' feed), most recent first. Requires an authenticated session behind your key. Returns tweets with author and metrics plus a cursor. Use this to read what your account would see when it opens X.",
    shape: {
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
    },
  },
  {
    name: "twitter_bookmarks",
    path: "/twitter/user/bookmarks",
    description:
      "List YOUR authenticated account's bookmarked tweets, most recent first. Requires an authenticated session behind your key. Returns each bookmarked tweet with author and metrics plus a cursor.",
    shape: {
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
    },
  },
  {
    name: "twitter_blocking",
    path: "/twitter/user/blocking",
    description:
      "List the accounts YOUR authenticated account has BLOCKED, as full user objects, cursor-paginated. Requires an authenticated session behind your key. There is no user_id argument: X provides no way to read another account's block list, so this reads yours only. An empty users array is a real answer meaning you block nobody, never a silent failure, because the endpoint returns an error status rather than an empty page when it cannot read the list.",
    shape: {
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
    },
  },
  {
    name: "twitter_muting",
    path: "/twitter/user/muting",
    description:
      "List the accounts YOUR authenticated account has MUTED, as full user objects, cursor-paginated. Muting hides an account's posts from your timeline without blocking it, so this is a different list from twitter_blocking and an account can appear in one and not the other. Requires an authenticated session behind your key. There is no user_id argument: X provides no way to read another account's mute list. An empty users array means you mute nobody, never a silent failure.",
    shape: {
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
    },
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
      count: z.number().int().min(1).max(200).optional().describe(
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
    },
  },
  {
    name: "twitter_bookmark_folders",
    path: "/twitter/user/bookmark_folders",
    description:
      "List YOUR authenticated account's bookmark FOLDERS (X's internal name: collections), the named groups you can organize saved tweets into, separate from your flat bookmarks list (twitter_bookmarks). Requires an authenticated session behind your key. Returns each folder's id, name, and a cover image. Takes no arguments; your folders resolve from your session alone. Use twitter_bookmark_folder_timeline with a folder's id to read the tweets inside it.",
    shape: {
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
    },
  },
  {
    name: "twitter_bookmark_folder_timeline",
    path: "/twitter/user/bookmark_folder_timeline",
    description:
      "Read the tweets inside ONE of your authenticated account's bookmark folders, identified by folder_id (from twitter_bookmark_folders). Requires an authenticated session behind your key. Cursor-paginated; there is no count/page-size argument for this op.",
    shape: {
      folder_id: z.string().describe(
        "The bookmark folder's id, from twitter_bookmark_folders (e.g. '2073826456430592429').",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
    },
  },
  {
    name: "twitter_dm_list",
    path: "/twitter/dm/list",
    description:
      "List YOUR authenticated account's Direct Message conversations (inbox), each with the participant and a conversation_id you can pass to twitter_dm_conversation. Requires an authenticated session behind your key. Read-only: this does not send DMs.",
    shape: {
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
    },
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
    },
  },
  {
    name: "twitter_dm_send",
    path: "/twitter/dm/send",
    method: "POST",
    write: true,
    description:
      "Send a Direct Message AS your authenticated account. Provide the recipient's numeric user id (recipient_id, resolve a @handle with twitter_user_info first) and the message text. Requires an authenticated session with write capability behind your key; X soft-blocks writes from datacenter IPs, so route through a residential proxy_url for reliability. Returns message_id and conversation_id. Delivers a real DM and is not silently reversible.",
    shape: {
      recipient_id: z.string().describe(
        "Numeric Twitter/X user id of the recipient (e.g. '44196397'). Resolve a @handle to its id with twitter_user_info first. The recipient must allow DMs from you.",
      ),
      text: z.string().min(1).describe(
        "The Direct Message body text to send (non-empty).",
      ),
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
    },
  },
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
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
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
    },
  },
  {
    name: "twitter_favorite_tweet",
    path: "/twitter/tweet/favorite",
    method: "POST",
    write: true,
    description:
      "Like (favorite) a tweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key. Reverse with twitter_unfavorite_tweet.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
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
    },
  },
  {
    name: "twitter_unfavorite_tweet",
    path: "/twitter/tweet/unfavorite",
    method: "POST",
    write: true,
    destructive: true,
    description:
      "Remove a like (unfavorite) from a tweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
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
    },
  },
  {
    name: "twitter_retweet",
    path: "/twitter/tweet/retweet",
    method: "POST",
    write: true,
    description:
      "Retweet a tweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key. Reverse with twitter_unretweet.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
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
    },
  },
  {
    name: "twitter_unretweet",
    path: "/twitter/tweet/unretweet",
    method: "POST",
    write: true,
    destructive: true,
    description:
      "Undo a retweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
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
    },
  },
  {
    name: "twitter_bookmark_tweet",
    path: "/twitter/tweet/bookmark",
    method: "POST",
    write: true,
    description:
      "Bookmark a tweet to YOUR authenticated account's private bookmarks. Provide the tweet id or url. Requires write capability behind your key. Reverse with twitter_unbookmark_tweet.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
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
    },
  },
  {
    name: "twitter_unbookmark_tweet",
    path: "/twitter/tweet/unbookmark",
    method: "POST",
    write: true,
    destructive: true,
    description:
      "Remove a tweet from YOUR authenticated account's bookmarks. Provide the tweet id or url. Requires write capability behind your key.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
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
    },
  },
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
    },
  },
  {
    name: "twitter_customer_session",
    path: "/twitter/customer/session",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Register YOUR OWN X account session against your API key, so the authenticated-account tools (twitter_home_timeline, twitter_bookmarks, twitter_dm_list, twitter_dm_conversation, twitter_user_likes, twitter_article_list) and the write tools (twitter_create_tweet, twitter_dm_send, twitter_follow_user, twitter_favorite_tweet, twitter_retweet, twitter_media_upload, twitter_article_create, twitter_article_update_title, twitter_article_update_content, twitter_article_publish, twitter_article_unpublish, twitter_article_delete) act as your account. Provide your x.com session cookies auth_token and ct0 (copy them from a logged-in browser); optionally a user_agent and a residential proxy_url. The cookies are stored server-side against your key and are never returned. Returns ok, the resolved username, and whether the session validated live. Prefer twitter_user_login if you would rather pass a username/password than raw cookies. Most tools also accept auth_token/ct0 per-call without registering.",
    shape: {
      auth_token: z.string().describe(
        "Your x.com auth_token cookie value, from a logged-in browser session. Stored server-side against your key; never returned.",
      ),
      ct0: z.string().describe(
        "Your x.com ct0 (CSRF) cookie value, from the same browser session. Paired with auth_token.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. Browser User-Agent to send with this session's requests. Defaults to a current Chrome UA.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. HTTP or SOCKS proxy URL to route this session's traffic through, e.g. 'http://user:pass@host:port'.",
      ),
    },
  },
  {
    name: "twitter_customer_session_delete",
    path: "/twitter/customer/session/delete",
    method: "POST",
    write: true,
    description:
      "Revoke the X account session you registered with twitter_customer_session, deleting the stored auth_token and ct0 from twitterapis.com. Self-serve, no ticket and no human in the loop. Scoped to your own API key by construction: it takes no account identifier of any kind, so it cannot reach another key's session. Idempotent and free: revoking twice, or revoking when nothing was stored, still returns ok with deleted=false, and it costs no credits, so a key that is out of balance can still delete its credentials. After this, the authenticated-account tools (twitter_home_timeline, twitter_bookmarks, twitter_dm_list, twitter_dm_conversation, twitter_user_likes) and the write tools stop acting as that account until you register again. IMPORTANT: this deletes the stored copy only. It does NOT log the account out of x.com, so to invalidate the cookies themselves, also revoke the session from your X account settings.",
    shape: {},
  },
  {
    name: "twitter_user_login",
    path: "/twitter/user/user_login",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Log in to X with a username and password (plus totp_secret if the account has 2FA) and store the resulting session against your API key, so the authenticated-account reads and the write tools then act as that account. On success returns { ok, username, message }; it does NOT return the session cookies (auth_token/ct0 are minted and kept server-side, never sent back). Typical failures: bad_credentials (401), two_factor_required (400, add totp_secret), captcha_required (422), acid_challenge (409, confirm the login from the account then retry). This handles real account credentials; never log or echo the values you pass.",
    shape: {
      username: z.string().describe(
        "The X account username/handle (without the leading @). Some accounts also accept the login email here.",
      ),
      password: z.string().describe(
        "The X account password.",
      ),
      totp_secret: z.string().optional().describe(
        "The account's base32 two-factor (TOTP) secret. Required only when the account has 2FA enabled.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. HTTP or SOCKS proxy URL to perform the login through, e.g. 'http://user:pass@host:port'. Stored with the session and reused for its later requests. Omit to log in directly from the service's own IP. A residential proxy is recommended: X treats datacenter logins as automated.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. Browser User-Agent to mint and use the session with. Defaults to a current Chrome UA. Keep it consistent with the environment the account normally signs in from; a mismatch between the UA and the session is itself a signal to X.",
      ),
    },
  },
  {
    name: "twitter_media_upload",
    path: "/twitter/media/upload",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Upload an image to X and get a media_id to attach to a tweet via twitter_create_tweet's media_ids. Provide media_data as base64-encoded image bytes. Acts as your registered account session (register first with twitter_customer_session or twitter_user_login, or pass auth_token/ct0 for this call). Returns ok and the media_id. Only base64 image data is supported over this tool's JSON transport.",
    shape: {
      media_data: z.string().describe(
        "Base64-encoded image bytes to upload. Sent in the JSON request body.",
      ),
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
    },
  },
  {
    name: "twitter_media_status",
    path: "/twitter/media/status",
    description:
      "Check whether an uploaded media_id has finished processing on X, before you attach it to a tweet. Video, GIF and large uploads are processed ASYNCHRONOUSLY: twitter_media_upload returns a media_id immediately, but attaching it via twitter_create_tweet FAILS until X reports state 'succeeded'. Poll this until then. Returns media_id, state ('pending', 'in_progress', 'succeeded' or 'failed'), check_after_secs (how long X asks you to wait before polling again, honour it rather than tight-looping), progress_percent, and an error object when state is 'failed'. Reads through YOUR OWN registered account session, the same one that performed the upload, so register first with twitter_customer_session or twitter_user_login, or pass auth_token/ct0 for this call. This is a READ: no daily write cap applies.",
    shape: {
      media_id: z.string().describe(
        "Numeric media id returned by twitter_media_upload, e.g. '1234567890123456789'.",
      ),
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
    },
  },
  {
    name: "twitter_article_create",
    path: "/twitter/article/create",
    method: "POST",
    write: true,
    description:
      "Start a new DRAFT article ('Note') AS your authenticated account. No input required. Returns the new article's id (pass this to twitter_article_update_title / twitter_article_update_content / twitter_article_publish / twitter_article_delete) and its full article object. Requires an authenticated session with write capability behind your key.",
    shape: {
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
    },
  },
  {
    name: "twitter_article_update_cover_media",
    path: "/twitter/article/update_cover_media",
    method: "POST",
    write: true,
    description:
      "Attach an ALREADY-UPLOADED image as the cover of a DRAFT or PUBLISHED article, AS your authenticated account. This does NOT upload: call twitter_media_upload first and pass the media_id it returns. Provide the article's id (from twitter_article_create or twitter_article_list). Requires an authenticated session with write capability behind your key. Returns the updated article object with cover_media populated.",
    shape: {
      id: z.string().describe(
        "The article's entity id, from twitter_article_create or twitter_article_list (e.g. 'ArticleEntity:1234567890123456789').",
      ),
      media_id: z.string().describe(
        "The media id returned by twitter_media_upload for the image to use as the cover.",
      ),
      media_category: z.string().optional().describe(
        "Optional. X's media category for the upload. Defaults to 'DraftTweetImage', which is what X's own article editor sends for a cover image. Only set this if you know X expects a different category.",
      ),
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
    },
  },
  {
    name: "twitter_article_update_title",
    path: "/twitter/article/update_title",
    method: "POST",
    write: true,
    description:
      "Set or replace the title of a DRAFT or PUBLISHED article AS your authenticated account. Provide the article's id (from twitter_article_create or twitter_article_list) and the new title. Requires an authenticated session with write capability behind your key. Returns the updated article object.",
    shape: {
      id: z.string().describe(
        "The article's entity id, from twitter_article_create or twitter_article_list (e.g. 'ArticleEntity:1234567890123456789').",
      ),
      title: z.string().min(1).describe(
        "The new article title (non-empty).",
      ),
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
    },
  },
  {
    name: "twitter_article_update_content",
    path: "/twitter/article/update_content",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Replace the body content of a DRAFT or PUBLISHED article AS your authenticated account. Provide the article's id and content_state: Draft.js JSON ({ blocks: [...], entityMap: [...] }) that YOU build and pass through verbatim, this tool does not construct or validate it. Requires an authenticated session with write capability behind your key. Returns the updated article object.",
    shape: {
      id: z.string().describe(
        "The article's entity id, from twitter_article_create or twitter_article_list.",
      ),
      content_state: z.record(z.string(), z.unknown()).describe(
        "Draft.js content state object: { blocks: [...], entityMap: [...] }. You construct this JSON yourself (it is the same shape the X Article editor produces); it is passed through to X verbatim and not validated here.",
      ),
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
    },
  },
  {
    name: "twitter_article_publish",
    path: "/twitter/article/publish",
    method: "POST",
    write: true,
    description:
      "Publish a DRAFT article AS your authenticated account, transitioning it to Published and posting a REAL, PUBLIC announcement tweet that your followers and anyone with the link can see. WARNING: this is a genuinely consequential, hard-to-fully-undo action, it is not like saving a draft. twitter_article_unpublish reverts the article to Draft but LEAVES the announcement tweet up; only twitter_article_delete on a published article unpublishes AND removes the announcement tweet, and by then the content was already public for however long it stayed up. Confirm with the caller before publishing unless they have clearly asked for it. Provide the article's id; audience and reply_control default to 'Everyone' when omitted; caption is an optional short (<=256 character) caption for the announcement tweet. Requires an authenticated session with write capability behind your key. Returns the updated (Published) article object.",
    shape: {
      id: z.string().describe(
        "The article's entity id, from twitter_article_create or twitter_article_list. Must currently be a Draft.",
      ),
      audience: z.string().optional().describe(
        "Optional. Who can see the published article, e.g. 'Everyone'. Defaults to 'Everyone' when omitted.",
      ),
      reply_control: z.string().optional().describe(
        "Optional. Who can reply to the announcement tweet, e.g. 'Everyone'. Defaults to 'Everyone' when omitted.",
      ),
      caption: z.string().optional().describe(
        "Optional. Short caption text for the announcement tweet, up to 256 characters.",
      ),
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
    },
  },
  {
    name: "twitter_article_unpublish",
    path: "/twitter/article/unpublish",
    method: "POST",
    write: true,
    destructive: true,
    description:
      "Revert a PUBLISHED article back to Draft AS your authenticated account. The announcement tweet the publish posted is LEFT IN PLACE, still publicly visible, use twitter_article_delete instead if you also want that tweet removed. X refuses this with an 'invalid_lifecycle' error if the article is not currently Published. Requires an authenticated session with write capability behind your key. Returns the updated (Draft) article object.",
    shape: {
      id: z.string().describe(
        "The article's entity id, from twitter_article_create or twitter_article_list. Must currently be Published.",
      ),
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
    },
  },
  {
    name: "twitter_article_get",
    path: "/twitter/article/get",
    description:
      "Read an article's full content (title, content_state, cover media, author, timestamps, public_url). Two mutually exclusive forms. PUBLIC: provide id or url of the article's announcement tweet, no registered session or per-call credentials needed, just your API key, same auth model as twitter_tweet_detail, works for PUBLISHED articles only. OWNER-ONLY: provide article_id (the article's own entity id, from twitter_article_create or twitter_article_list), requires an authenticated session, also reaches your own Drafts, which have no announcement tweet the public form could resolve. Returns 404 (article null) if not found, not visible, or (article_id form) not owned by the calling account.",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url.",
      ),
      article_id: z.string().optional().describe(
        "OWNER-ONLY form. The article's own entity id, from twitter_article_create or twitter_article_list (e.g. 'ArticleEntity:1234567890123456789', or the bare numeric rest_id). Requires an authenticated session. Provide exactly one of id, url, or article_id.",
      ),
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
    },
  },
  {
    name: "twitter_article_list",
    path: "/twitter/article/list",
    description:
      "List YOUR OWN articles (drafts or published) AS your authenticated account, most recent first. X exposes no combined view, so this filters to ONE lifecycle per call: pass lifecycle='published' to list published articles, omit it (or pass 'draft') for drafts. Requires an authenticated session behind your key. Returns count, next_cursor (pass it back as cursor to fetch the next page; null/absent means no more pages), and the page of article objects.",
    shape: {
      lifecycle: z.enum(["draft","published"]).optional().describe(
        "Which lifecycle to list: 'draft' or 'published'. Defaults to 'draft' when omitted. X has no combined view, list each lifecycle separately.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max articles to return for this page, 1 to 100. Defaults to 20 when omitted.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page.",
      ),
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
    },
  },
  {
    name: "twitter_article_delete",
    path: "/twitter/article/delete",
    method: "POST",
    write: true,
    destructive: true,
    description:
      "Delete an article AS your authenticated account. A DRAFT is hard-deleted outright; a PUBLISHED article is unpublished first and then its announcement tweet is deleted too, so this is the one op that fully removes a published article's public footprint (compare twitter_article_unpublish, which leaves the tweet up). Irreversible. lifecycle and tweet_id are optional fast-path hints (read them off a prior twitter_article_create or twitter_article_list response): when omitted, the server figures out the lifecycle itself by scanning your own Draft then Published articles, which costs an extra round trip. Requires an authenticated session with write capability behind your key. Returns ok/deleted and the id you targeted.",
    shape: {
      id: z.string().describe(
        "The article's entity id, from twitter_article_create or twitter_article_list.",
      ),
      lifecycle: z.enum(["draft","published"]).optional().describe(
        "Optional fast-path hint: 'draft' or 'published', if you already know it. Omit to let the server resolve it (slower, one extra lookup).",
      ),
      tweet_id: z.string().optional().describe(
        "Optional fast-path hint: the announcement tweet id, only meaningful when lifecycle is 'published'. Omit to let the server resolve it from your own article list.",
      ),
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
    },
  },
  {
    name: "twitter_monitor_create",
    path: "/twitter/monitor",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Start watching an X account for new posts. Every new post from that handle is HMAC-signed and delivered to your registered webhook(s) on a shared poll interval (see twitter_monitor_webhook_create to register a delivery URL first). Free: monitor creation is account administration, not a metered read. Returns the new monitor's id, plus its normalized handle, status, and poll_interval_ms.",
    shape: {
      handle: z.string().min(1).describe(
        "The X username to watch, without the leading @ (e.g. 'elonmusk').",
      ),
      webhook_ids: z.string().optional().describe(
        "Optional. Comma-separated webhook id(s) from twitter_monitor_webhook_create to restrict this monitor's deliveries to. Omit to deliver to every active webhook on the account (the default).",
      ),
      domain_filter: z.string().optional().describe(
        "Optional. A bare hostname ('example.com') or a full URL ('https://example.com/blog') to restrict delivery to only the new posts that link to that host or a subdomain of it (e.g. 'example.com' matches both example.com and blog.example.com). Normalized server-side: lowercased, scheme/path/query/fragment/leading www./trailing :port stripped. Omit for no filter, the default (deliver every new post). Rejected with a 400 if what remains after normalization is not a valid hostname shape. A post with no matching link is filtered out of delivery, never silently dropped: it still advances the monitor's cursor and counts toward the account's tweets_domain_filtered health metric.",
      ),
    },
  },
  {
    name: "twitter_monitor_list",
    path: "/twitter/monitor",
    description:
      "List every monitor on your account: id, subject (its from:<handle> query), kind, status ('active' or 'paused'), degraded flag, events_possibly_missed, webhook_ids restriction, and created_at. Takes no arguments.",
    shape: {},
  },
  {
    name: "twitter_monitor_update",
    path: "/twitter/monitor/{id}",
    method: "POST",
    write: true,
    jsonBody: true,
    pathParams: ["id"],
    description:
      "Partially update an existing monitor: pause or resume it via status, change which webhooks receive its events via webhook_ids, change or clear its domain_filter, or any combination in the same call (applied atomically). Resuming a paused monitor re-runs the same capacity and per-account cap checks as creating a new one, since it adds load back to the shared pool. Free per call. All three fields are optional; omit any of them to leave that part unchanged.",
    shape: {
      id: z.string().describe(
        "The monitor's id, from twitter_monitor_create or twitter_monitor_list.",
      ),
      status: z.enum(["active","paused"]).optional().describe(
        "'paused' to pause the monitor, 'active' to resume it. Omit to leave status unchanged.",
      ),
      webhook_ids: z.string().optional().describe(
        "Optional. Comma-separated webhook id(s) to restrict delivery to. Pass an empty string to clear the restriction back to 'deliver to every active webhook'. Omit entirely to leave it unchanged.",
      ),
      domain_filter: z.string().nullable().optional().describe(
        "Optional. A bare hostname or full URL to restrict delivery to, same shape and normalization as twitter_monitor_create's domain_filter. Pass an empty string (or null) to clear an existing filter back to 'deliver every new post'. Omit entirely to leave the current filter unchanged. Rejected with a 400 if a non-empty value does not normalize to a valid hostname.",
      ),
    },
  },
  {
    name: "twitter_monitor_delete",
    path: "/twitter/monitor/{id}",
    method: "DELETE",
    write: true,
    destructive: true,
    pathParams: ["id"],
    description:
      "Stop and remove a monitor by id. Irreversible: create a new monitor with twitter_monitor_create if you want to watch that handle again. Delivery history referencing this monitor is retained, not cascade-deleted. Free per call.",
    shape: {
      id: z.string().describe(
        "The monitor's id, from twitter_monitor_create or twitter_monitor_list.",
      ),
    },
  },
  {
    name: "twitter_monitor_health",
    path: "/twitter/monitor/{id}/health",
    pathParams: ["id"],
    description:
      "Read one monitor's current status, degradation flag, poll interval, possibly-missed-event count, and cursor position (last_tweet_id, last_poll_at), for building your own health dashboard. Free per call.",
    shape: {
      id: z.string().describe(
        "The monitor's id, from twitter_monitor_create or twitter_monitor_list.",
      ),
    },
  },
  {
    name: "twitter_monitor_account_health",
    path: "/twitter/monitor/health",
    description:
      "Account-wide monitoring rollup in ONE call, distinct from twitter_monitor_health (which needs an id and reports one monitor's cursor): service status ('operational' or 'degraded'), active/paused/total counts across every monitor you own, and pending/delivered/failed delivery counts from the last 24 hours. Takes no arguments. A key with zero monitors gets zeroed counts back, never an error. Free per call.",
    shape: {},
  },
  {
    name: "twitter_monitor_deliveries",
    path: "/twitter/monitor/deliveries",
    description:
      "List your most recent monitor delivery events across every monitor, most recent first: id, monitor_id, tweet_id, status, tweet_created_at, and the real measured latency (detected_lag_ms, from X's own post timestamp to enqueue; delivery_lag_ms, the separate queue-to-webhook-POST time; total_lag_ms). Free per call.",
    shape: {
      limit: z.number().int().min(1).max(200).optional().describe(
        "Max delivery events to return, 1 to 200. Defaults to 50 when omitted.",
      ),
    },
  },
  {
    name: "twitter_x_user_stream_add_user",
    path: "/oapi/x_user_stream/add_user_to_monitor_tweet",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Compat drop-in for twitter_monitor_create using an x_user_stream-shaped request/response envelope: watch an X account for new posts, translated onto the same underlying monitor system. Free per call. Prefer twitter_monitor_create for new integrations; this exists for migrating an existing x_user_stream-shaped integration without a rewrite.",
    shape: {
      x_user_name: z.string().describe(
        "The X username to watch, without the @.",
      ),
    },
  },
  {
    name: "twitter_x_user_stream_remove_user",
    path: "/oapi/x_user_stream/remove_user_to_monitor_tweet",
    method: "POST",
    write: true,
    destructive: true,
    jsonBody: true,
    description:
      "Compat drop-in for twitter_monitor_delete using an x_user_stream-shaped envelope: stop watching an account. Irreversible. Free per call.",
    shape: {
      id_for_user: z.string().describe(
        "The monitor id, from twitter_x_user_stream_list_users. Same value as a twitter_monitor_* tool's monitor id.",
      ),
    },
  },
  {
    name: "twitter_x_user_stream_list_users",
    path: "/oapi/x_user_stream/get_user_to_monitor_tweet",
    description:
      "Compat drop-in for twitter_monitor_list using an x_user_stream-shaped envelope: list every account you are currently tweet-monitoring. Honest field mapping, not fabricated: x_user_id is always null (this API stores no numeric Twitter user id) and is_monitor_profile is always 0 (profile-change monitoring is not a capability this API has). Free per call.",
    shape: {},
  },
  {
    name: "twitter_monitor_webhook_create",
    path: "/twitter/webhook",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Register an HTTPS endpoint to receive signed monitor events. The HMAC signing secret is returned ONLY in this response, store it immediately: it cannot be retrieved again, and it is what you use to verify the X-TwitterAPIs-Signature header on every delivery. Free per call.",
    shape: {
      url: z.string().min(1).describe(
        "Your https delivery endpoint, e.g. 'https://example.com/webhooks/twitterapis'. Private, loopback, link-local, and metadata IPs are refused, re-checked at every delivery, not just at registration.",
      ),
    },
  },
  {
    name: "twitter_monitor_webhook_list",
    path: "/twitter/webhook",
    description:
      "List every webhook registered on your account: id, url, status ('active' delivers, 'disabled' means the endpoint returned a 410 Gone and needs re-registering to reactivate), and created_at. The signing secret is never returned here, only at creation. Takes no arguments.",
    shape: {},
  },
  {
    name: "twitter_monitor_webhook_delete",
    path: "/twitter/webhook/{id}",
    method: "DELETE",
    write: true,
    destructive: true,
    pathParams: ["id"],
    description:
      "Soft-delete a webhook by id: it stops receiving deliveries immediately and disappears from twitter_monitor_webhook_list, but delivery history referencing it is retained rather than cascade-deleted. Irreversible from the caller's side (register a new webhook with twitter_monitor_webhook_create to resume delivery). Free per call.",
    shape: {
      id: z.string().describe(
        "The webhook's id, from twitter_monitor_webhook_create or twitter_monitor_webhook_list.",
      ),
    },
  },
  {
    name: "twitter_monitor_webhook_test",
    path: "/twitter/webhook/{id}/test",
    method: "POST",
    write: true,
    pathParams: ["id"],
    description:
      "Send one HMAC-signed test event to this webhook's URL right now and return the outcome synchronously: delivered (true if your endpoint returned a 2xx within the delivery timeout), status_code, and error. Unlike a real monitor event, a test send is never queued, retried, or dead-lettered, it is a one-shot diagnostic to confirm your endpoint and signature verification both work before relying on the webhook. Free per call.",
    shape: {
      id: z.string().describe(
        "The webhook's id, from twitter_monitor_webhook_create or twitter_monitor_webhook_list.",
      ),
    },
  },
];

// The query-string builder and the path-param substitution helper are
// hand-written logic, not catalog data, so they live in their own module and
// are re-exported here to keep this file's one import path.
export { buildQuery, resolvePathParams, MissingPathParamError } from "./query.js";
