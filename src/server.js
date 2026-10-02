// createServer(): one McpServer per caller, holding that caller's key and last
// failure in its own closure.
//
// WHY A FACTORY: the key and the last-failed-call record used to be module
// globals. Under stdio there is one process per user, so that was harmless;
// served remotely, one process serves many users, and a module global would
// send one caller's requests with another caller's key and hand one caller's
// failure (path, request id) to another caller's feedback draft. Every piece
// of per-caller state now lives inside createServer, and nothing in this file
// reads process.env: the entry point (index.js for stdio) resolves config and
// passes it in.

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TOOLS, buildQuery, resolvePathParams, MissingPathParamError } from "./tools.js";
import { createFeedbackHandler } from "./feedback.js";

// Single source of truth for the version. Previously this was a literal in two
// places and drifted: the package shipped 0.5.0 while the MCP handshake and the
// outbound user-agent both still advertised 0.3.0.
export const VERSION = createRequire(import.meta.url)("../package.json").version;

export const DEFAULT_BASE_URL = "https://api.twitterapis.com";
export const DEFAULT_TIMEOUT_MS = 30000;

// The 404 hint used to be a flat status-only ternary telling EVERY caller that
// "the user, tweet, or list may have been deleted or the id is wrong". For a
// feedback id that sentence is simply wrong, and it sends a customer chasing a
// report id off to look at a tweet. The feedback routes are the first mounted
// outside the /twitter surface, so they are the first place the assumption is
// plainly visible; /account/* would have been next.
//
// ONLY THE 404 VARIES. Every other status is about the KEY, the CREDIT
// balance, the caller's SESSION, or OUR service, and each of those reads
// identically on every endpoint. Adding per-path branches for them would be
// surface area with no reader.
const NOT_FOUND_HINTS = [
  [/^\/feedback/, " (not found. No feedback report with that id on this account, and an id from another account will not resolve here. Use the id returned by twitter_feedback_send action=send.)"],
  [/^\/account/, " (not found. That account resource does not exist for this key.)"],
];
const DEFAULT_NOT_FOUND_HINT =
  " (not found. The user, tweet, or list may have been deleted or the id is wrong)";

// AGENT-ACTIONABLE PAYWALL. A missing key, a rejected key, an empty balance and
// a missing X session are the moments a user decides whether to keep going, and
// they happen inside an agent's turn. The payload names the exact page (or tool)
// so the agent can say "top up here, then I will retry". It is appended to the
// text (every client reads that) and returned as structuredContent. Which
// failures ARE a paywall is decided from the API's own response BODY, not the
// status alone (the API's bodies, read 2026-09-29 from scraper/src/server/auth.ts
// and routes/actions.ts): 401 {"error":"unauthorized"}, 402
// {"error":"insufficient_credits"}, 409 {"error":"session_required"|"session_dead"}.
export const SIGNUP_URL = "https://www.twitterapis.com/signup?utm_source=mcp&utm_medium=tool_error";
export const API_KEYS_URL = "https://www.twitterapis.com/dashboard?utm_source=mcp&utm_medium=tool_error";
export const TOP_UP_URL = "https://www.twitterapis.com/dashboard/buy-credits?utm_source=mcp&utm_medium=tool_error";

export function paywallFor(kind) {
  if (kind === "no_key") {
    return {
      needs: "account",
      message:
        "Missing TWITTERAPIS_KEY: no API key is set. Sign up free at twitterapis.com (new accounts start " +
        "with free credit, no card), copy the key from the dashboard, set TWITTERAPIS_KEY in the MCP " +
        "client config, then retry this call.",
      action_url: SIGNUP_URL,
      api_keys_url: API_KEYS_URL,
      retry: "same call, after the key is set",
    };
  }
  if (kind === "bad_key") {
    return {
      needs: "valid_key",
      message:
        "The twitterapis.com credential was rejected (the API key is invalid, revoked or rotated, or the " +
        "connected app was disconnected). Copy a current key from the dashboard and set TWITTERAPIS_KEY, " +
        "or reconnect the app, then retry this call.",
      action_url: API_KEYS_URL,
      retry: "same call, after the key is replaced or the app reconnected",
    };
  }
  if (kind === "credits") {
    return {
      needs: "credits",
      message:
        "The twitterapis.com account is out of credits. Top up (pay as you go, no subscription), then " +
        "retry this call; nothing was charged for the failed request. twitter_account_me shows the balance.",
      action_url: TOP_UP_URL,
      retry: "same call, after topping up",
    };
  }
  if (kind === "x_session") {
    return {
      needs: "x_session",
      message:
        "This action needs a working linked X account: writes and account-only reads act as the user's " +
        "own X session, and none is linked or the linked one has expired. Link or re-link it with the " +
        "twitter_user_login tool (or twitter_customer_session with auth_token and ct0), then retry this call.",
      next_tool: "twitter_user_login",
      retry: "same call, after an X session is linked",
    };
  }
  return null;
}

export function classifyPaywall(status, bodyText) {
  let body = null;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = null;
  }
  const err = body && typeof body.error === "string" ? body.error : "";
  // A dead X session is a 401 {"error":"session_dead"} (routes/actions.ts,
  // routes/customer.ts), NOT a bad API key: telling the user to rotate a working
  // key when their X cookies expired is the wrong fix. A 401 whose message is
  // about the internal headers is a server wiring fault, not the user's key.
  if (status === 401 && err === "session_dead") return "x_session";
  if (status === 401 && err === "unauthorized" && !/x-internal/i.test(String(body?.message || ""))) return "bad_key";
  if (status === 402 && err === "insufficient_credits") return "credits";
  if (status === 409 && err === "session_required") return "x_session";
  return null;
}

function paywallResult(kind, detail = "") {
  const p = paywallFor(kind);
  return {
    isError: true,
    content: [{ type: "text", text: `${p.message}${detail ? ` (${detail})` : ""}\n\n${JSON.stringify(p)}` }],
    structuredContent: p,
  };
}

export function hintFor(status, path) {
  if (status === 401) return " (invalid or missing API key, verify TWITTERAPIS_KEY at https://www.twitterapis.com/dashboard)";
  if (status === 402) return " (insufficient credits, top up at https://www.twitterapis.com/dashboard)";
  if (status === 403) return " (access forbidden. The resource may be private or your plan does not include this endpoint)";
  if (status === 404) {
    for (const [re, h] of NOT_FOUND_HINTS) if (re.test(path || "")) return h;
    return DEFAULT_NOT_FOUND_HINT;
  }
  if (status === 409) return " (no authenticated X session for this key. Write actions and account-only reads (likes, bookmarks, DMs, home timeline, follow, post) require linking an X account/session to your key first; see https://www.twitterapis.com/dashboard)";
  if (status === 429) return " (rate limited. Wait a few seconds and retry; reduce request frequency or increase TWITTERAPIS_TIMEOUT_MS if needed)";
  if (status >= 500) return " (upstream API error. Retry in a moment; if persistent, check https://www.twitterapis.com/status)";
  return "";
}

// Standing instructions the client hands its model alongside the tool list.
//
// THIS is where guidance lives, and only here. Tool and parameter descriptions state
// product facts (what a tool returns, takes and costs) and never name another tool or
// tell the model what to do: the Connectors Directory attestation requires it, and
// test/description-compliance.mjs enforces it on every description a client lists.
// Which tool to pick, how one tool's output feeds another, the feedback-drafting
// policy and the confirm-before-publishing rule therefore belong in this string,
// which the directory permits a server to use for guiding the model.
export const INSTRUCTIONS = [
  "twitterapis.com MCP server. Read tools cost credits per call (each description states its cost); account, monitoring and feedback tools are free.",
  // Feedback first: Claude Code keeps only the first 2048 chars of a server's instructions
  // (MAX_INSTRUCTIONS below), so the consent rule must sit well inside that window.
  "Feedback: if a twitterapis tool call fails with an error other than 401/402/409/429 and the user has to work around it, if the user asks for something no twitterapis tool covers, " +
    "if a documented field comes back empty or wrong, or if the user is clearly frustrated with a result, draft a report with twitter_feedback_send (action \"draft\"). " +
    "Drafting is local and silent: no confirmation, not announced mid-task, one draft per issue. Details: four bullets (What happened, What the user said verbatim, Repro, Evidence); identifiers only, never payloads, keys or secrets. " +
    "Never send a draft unless the user names it after reviewing action \"list\"; send only the ids the user named.",
  "Before drafting a report that a parameter is IGNORED or a field is EMPTY, re-run the call with a distinctive value that could only match if the parameter was honoured, and with the phrase quoted; " +
    "if either comes back on topic the issue is ranking or matching, so title it that way and say what the control showed.",
  // Acting as the user's X account.
  "Writes act as the X session linked with twitter_customer_session or twitter_user_login; never echo credential values. " +
    "Confirm with the user before twitter_article_publish: its public announcement tweet survives twitter_article_unpublish, and only twitter_article_delete removes it. " +
    "twitter_scheduled_create publishes on its own; twitter_draft_create never posts. X keeps no avatar or banner history, so save the current image from twitter_user_info before replacing it.",
  // Routing and chaining; the descriptions state the facts, this only links tools.
  "Routing: twitter_user_info gives the numeric user_id other tools need; twitter_user_status tells a ban from a typo; twitter_dm_list gives conversation_id; twitter_media_upload gives media_id; " +
    "twitter_tweet_quotes counts are search-backed (true total: quote_count from twitter_tweet_detail); twitter_list_tweets filters, twitter_list_timeline is X's native feed.",
].join(" ");

// Claude Code truncates server instructions past this many characters (2.1.287), so
// test/description-compliance.mjs holds INSTRUCTIONS to it.
export const MAX_INSTRUCTIONS = 2048;

// The one sentence a description uses to offer per-call X cookies. A hosted server
// (createServer({ inlineCredentials: false })) hides those args, so it strips this
// sentence too; descriptions must use exactly this wording for the strip to work.
export const PER_CALL_CREDENTIALS_SENTENCE = " Per-call auth_token and ct0 are also accepted.";

/**
 * Build one server for one caller.
 *
 * @param {object} opts
 * @param {string|undefined} opts.apiKey   the caller's key; calls fail clearly without one
 * @param {string} [opts.baseUrl]          API origin, default https://api.twitterapis.com
 * @param {number} [opts.timeoutMs]        per-request timeout, must be > 0
 * @param {object} [opts.feedbackEnv]      env-shaped object for the feedback queue location
 *                                         (TWITTERAPIS_FEEDBACK_DIR); a remote host gives each
 *                                         caller its own directory
 * @param {typeof fetch} [opts.fetchImpl]  injectable for tests
 * @param {(ms:number)=>Promise<void>} [opts.sleepImpl] injectable for tests
 * @param {number[]} [opts.retryDelaysMs] waits before each retry of a read that
 *        hit a gateway failure (deploy restart); default [3000, 8000]
 * @param {Record<string,string>} [opts.authHeaders]
 *        headers that authenticate each call INSTEAD of the API key. For a host
 *        that has already authenticated the caller some other way (an OAuth
 *        token resolved to an account) and forwards calls over its own trusted
 *        channel. When set, no API key is required or sent.
 * @param {boolean} [opts.inlineCredentials=true]
 *        false hides the per-call X session args (each tool's headerArgs: auth_token,
 *        ct0, proxy_url, user_agent) from every tool schema and drops them from calls.
 *        For a hosted, directory-listed server: callers bind their session once with
 *        twitter_customer_session (whose own credential payload is NOT a headerArg),
 *        so raw cookies never pass through a model per call.
 */
export function createServer({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  feedbackEnv = process.env,
  fetchImpl = fetch,
  authHeaders = null,
  sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms)),
  retryDelaysMs = [3000, 8000],
  inlineCredentials = true,
} = {}) {
  const BASE_URL = String(baseUrl).replace(/\/+$/, "");
  const REQUEST_TIMEOUT_MS = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;

  // The last tool call that failed, so a feedback draft can carry the endpoint,
  // status and request id without the model retyping them. Set in callEndpoint's
  // error branch; the tool name is added by the registration wrapper below.
  // Per server, so one caller's failure never reaches another caller's draft.
  let lastError = null;

  // ── REST call ──────────────────────────────────────────────────────────────
  // Most endpoints (GET reads and the simple POST writes alike) read their params
  // from the query string, so the same buildQuery path serves both and only the
  // HTTP method differs. A few POST endpoints (customer/session, user_login,
  // media/upload) instead read a JSON request body; those tools set jsonBody:true
  // and callEndpoint sends the args in the body rather than the query string. A
  // handful of monitoring endpoints (/monitor/{id}, /webhook/{id}, ...) carry a
  // REST path parameter instead: those tools set pathParams (the arg names to
  // substitute into the URL template) and callEndpoint splices them into path
  // before building the query string or body, so a pathParams arg never leaks
  // into either.
  async function callEndpoint(path, args, method = "GET", jsonBody = false, pathParams = [], { signal: callerSignal } = {}) {
    if (!apiKey && !authHeaders) return paywallResult("no_key");
    // Fill {name} URL segments from args and strip those keys, so a pathParams arg
    // (e.g. a monitor/webhook id) never also leaks into the query string or JSON
    // body. A missing value fails loudly rather than shipping a request that still
    // contains the literal "{id}" against the API.
    let resolvedPath, all;
    try {
      ({ path: resolvedPath, args: all } = resolvePathParams(path, pathParams, args));
    } catch (err) {
      if (err instanceof MissingPathParamError) {
        return { isError: true, content: [{ type: "text", text: err.message }] };
      }
      throw err;
    }

    const headers = {
      ...(authHeaders
        ? { ...authHeaders }
        : {
            // The API accepts either header; send both for maximum compatibility.
            Authorization: `Bearer ${apiKey}`,
            "x-api-key": apiKey,
          }),
      accept: "application/json",
      "user-agent": `twitterapis-mcp/${VERSION}`,
    };

    let url;
    let reqBody;
    if (jsonBody) {
      // Endpoints whose handler reads a JSON request body (customer/session,
      // user_login, media/upload). Send every arg in the body: for customer/session
      // and user_login the credentials ARE the payload the handler reads from the
      // body, so they must NOT be diverted into x-* headers the way per-call inline
      // creds are on the query-string tools.
      url = `${BASE_URL}${resolvedPath}`;
      headers["content-type"] = "application/json";
      reqBody = JSON.stringify(all);
    } else {
      // Pull per-call inline credentials out of args so they travel as request
      // headers, never the query string (the API reads x-auth-token / x-ct0; passing
      // them as query params would leak them into URLs and access logs). When
      // supplied, this one API key acts as that account; otherwise the key's linked
      // session is used. Lets a single key act as many accounts.
      const { auth_token, ct0, user_agent, proxy_url, ...rest } = all;
      const q = buildQuery(rest);
      url = `${BASE_URL}${resolvedPath}${q ? `?${q}` : ""}`;
      if (auth_token && ct0) {
        headers["x-auth-token"] = auth_token;
        headers["x-ct0"] = ct0;
        if (user_agent) headers["x-user-agent"] = user_agent;
        if (proxy_url) headers["x-proxy-url"] = proxy_url;
      }
    }

    // A DEPLOY RESTART IS NOT AN ERROR THE USER SHOULD SEE. While the API
    // restarts (about 30 to 60 seconds, measured 2026-09-29) the gateway answers
    // an HTML 502/503 or refuses the connection. A READ is retried through
    // that window; the API's own JSON errors, timeouts and writes never are, so
    // a request the API may already have handled is never sent twice (a gateway
    // 504 is not retried for that reason).
    const canRetry = method === "GET";
    // Only a REFUSED connection is retried: the request never reached the API,
    // so it cannot have been handled or billed. A reset, a broken pipe or a
    // socket dropped mid-answer can all happen after the API did the work, and
    // "fetch failed" alone also covers DNS and TLS errors that retrying cannot fix.
    const RETRYABLE_NET = new Set(["ECONNREFUSED"]);
    // The gateway answers a restart two ways: nginx's stock HTML 502/503 page,
    // or (since 2026-09-29) its own JSON 503 whose error is "gateway_restarting".
    // Nginx sends that JSON only when it could not reach the API at all, so the
    // API's own JSON errors (which never use that code) are still never retried.
    const gatewayFailure = (status, text) => {
      if ((status === 502 || status === 503) && /^\s*<(!doctype|html)/i.test(text)) return true;
      if (status !== 503) return false;
      try { return JSON.parse(text)?.error === "gateway_restarting"; } catch { return false; }
    };
    // The MCP caller's cancel (notifications/cancelled) aborts the request in
    // flight and any wait between retries, so a cancelled call stops at once.
    const cancelled = () => Boolean(callerSignal?.aborted);
    const pause = (ms) => cancelled() ? Promise.resolve() : new Promise((resolve) => {
      const done = () => { callerSignal?.removeEventListener?.("abort", done); resolve(); };
      Promise.resolve(sleepImpl(ms)).then(done, done);
      callerSignal?.addEventListener?.("abort", done, { once: true });
    });
    const transientNetwork = (err) =>
      !gotResponse && err?.name !== "AbortError" && RETRYABLE_NET.has(err?.cause?.code ?? err?.code);
    let attempt = 0;
    let gotResponse = false;
    for (;;) {
    gotResponse = false;
    if (cancelled()) return { isError: true, content: [{ type: "text", text: "Request cancelled by the caller." }] };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    const onCancel = () => ctrl.abort();
    callerSignal?.addEventListener?.("abort", onCancel, { once: true });
    try {
      const res = await fetchImpl(url, {
        method,
        headers,
        body: reqBody,
        signal: ctrl.signal,
      });
      gotResponse = true;
      const body = await res.text();
      if (canRetry && !cancelled() && attempt < retryDelaysMs.length && gatewayFailure(res.status, body)) {
        clearTimeout(timer);
        callerSignal?.removeEventListener?.("abort", onCancel);
        await pause(retryDelaysMs[attempt++]);
        continue;
      }
      if (!res.ok) {
        const hint = hintFor(res.status, resolvedPath);
        lastError = {
          path: resolvedPath,
          method,
          status: res.status,
          requestId: res.headers.get("x-request-id") || undefined,
          ts: Date.now(),
        };
        // Credential, credit, session, rate-limit and not-found failures are the
        // caller's situation (a 404 is almost always a wrong id), not a product
        // defect; everything else may be one, and the model reads error bodies
        // closely, so the pointer lives here.
        const feedbackHint =
          res.status === 401 || res.status === 402 || res.status === 404 || res.status === 409 || res.status === 429
            ? ""
            : " If this blocked the user's task and looks like a defect or a missing capability, draft a report with twitter_feedback_send (queued locally until the user reviews it).";
        const pw = classifyPaywall(res.status, body);
        if (pw) return paywallResult(pw, `HTTP ${res.status}: ${body.slice(0, 1200)}`);
        return { isError: true, content: [{ type: "text", text: `HTTP ${res.status}${hint}: ${body.slice(0, 1200)}${feedbackHint}` }] };
      }
      // A success clears the record so a later draft never inherits an old
      // failure's endpoint or request id (review 2026-09-04: a delete's draft
      // carried the previous update's 404).
      lastError = null;
      return { content: [{ type: "text", text: body }] };
    } catch (err) {
      if (canRetry && !cancelled() && attempt < retryDelaysMs.length && transientNetwork(err)) {
        clearTimeout(timer);
        callerSignal?.removeEventListener?.("abort", onCancel);
        await pause(retryDelaysMs[attempt++]);
        continue;
      }
      if (cancelled()) return { isError: true, content: [{ type: "text", text: "Request cancelled by the caller." }] };
      const code = err?.cause?.code ?? err?.code;
      const msg = err?.name === "AbortError"
        ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
        : `${err?.message || String(err)}${code ? ` (${code})` : ""}`;
      lastError = { path: resolvedPath, method, status: null, error: msg.slice(0, 200), ts: Date.now() };
      return { isError: true, content: [{ type: "text", text: `Request failed: ${msg}` }] };
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener?.("abort", onCancel);
    }
    }
  }

  const server = new McpServer({ name: "twitterapis", version: VERSION }, { instructions: INSTRUCTIONS });

  // Handlers for tools that carry local: "<name>" in the catalog. A name the
  // catalog uses and this map lacks is a boot-time failure, never a silent
  // passthrough to the API with the local args attached.
  const LOCAL_HANDLERS = {
    feedback: createFeedbackHandler({
      callEndpoint,
      version: VERSION,
      getClientInfo: () => server.server.getClientVersion(),
      getLastError: () => lastError,
      env: feedbackEnv,
    }),
  };

  for (const tool of TOOLS) {
    const method = tool.method || "GET";
    // Surface read/write/destructive intent so MCP clients can warn before a
    // mutating call (default = read-only).
    const annotations = {
      title: tool.name,
      readOnlyHint: !tool.write,
      destructiveHint: Boolean(tool.destructive),
      openWorldHint: true,
    };
    let handler;
    if (tool.local) {
      handler = LOCAL_HANDLERS[tool.local];
      if (!handler) throw new Error(`[twitterapis-mcp] tool ${tool.name} declares local handler "${tool.local}" but src/server.js has none`);
    } else {
      handler = async (args, extra) => {
        const result = await callEndpoint(tool.path, args, method, Boolean(tool.jsonBody), tool.pathParams || [], { signal: extra?.signal });
        if (result?.isError && lastError) {
          let resolved = null;
          try { resolved = resolvePathParams(tool.path, tool.pathParams || [], args).path; } catch { resolved = null; }
          // Name the tool only when BOTH method and path match the recorded
          // failure; two tools share /monitor/{id} (POST update, DELETE remove).
          if (resolved === lastError.path && method === lastError.method) lastError.tool = tool.name;
        }
        return result;
      };
    }
    let shape = tool.shape;
    let description = tool.description;
    let run = handler;
    if (!inlineCredentials && tool.headerArgs && tool.headerArgs.length) {
      const hidden = new Set(tool.headerArgs);
      shape = Object.fromEntries(Object.entries(tool.shape || {}).filter(([k]) => !hidden.has(k)));
      // Even a client that ignores the schema cannot smuggle cookies through.
      run = (args, extra) => handler(Object.fromEntries(Object.entries(args || {}).filter(([k]) => !hidden.has(k))), extra);
    }
    if (!inlineCredentials) {
      // Nothing in a hosted description may offer per-call cookies the schema no longer takes.
      description = description.split(PER_CALL_CREDENTIALS_SENTENCE).join("");
    }
    server.registerTool(
      tool.name,
      { description, inputSchema: shape, annotations },
      run,
    );
  }

  return { server, callEndpoint, getLastError: () => lastError, baseUrl: BASE_URL, timeoutMs: REQUEST_TIMEOUT_MS };
}
