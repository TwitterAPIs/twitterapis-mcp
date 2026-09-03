#!/usr/bin/env node
// feedback.test.mjs: the local draft queue behind twitter_feedback_send.
// No network: callEndpoint is a recorder. The queue lives in a temp dir via
// TWITTERAPIS_FEEDBACK_DIR so a run never touches the developer's real queue.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFeedbackHandler, queuePath, draftId, QUEUE_CAP } from "../src/feedback.js";

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) pass++;
  else { fail++; console.error("  FAIL:", name, detail); }
};

const dir = mkdtempSync(join(tmpdir(), "twapi-feedback-"));
const env = { TWITTERAPIS_FEEDBACK_DIR: dir };
const calls = [];
let nextResponse = () => ({ content: [{ type: "text", text: JSON.stringify({ id: "srv-1", status: "new" }) }] });
const callEndpoint = async (path, args, method, jsonBody) => {
  calls.push({ path, args, method, jsonBody });
  return nextResponse();
};
let lastError = null;
const tool = createFeedbackHandler({
  callEndpoint,
  version: "9.9.9",
  getClientInfo: () => ({ name: "claude-code", version: "2.1.259" }),
  getLastError: () => lastError,
  env,
});
const txt = (r) => r.content[0].text;
const queue = () => JSON.parse(readFileSync(queuePath(env), "utf8")).drafts;

// ── draft ──────────────────────────────────────────────────────────────────
{
  const r = await tool({ type: "bug", title: "thread 502 on deleted root", details: "- What happened: 502\n- What the user said: none\n- Repro: x\n- Evidence: y", area: "tweet/thread" });
  check("draft is not an error", !r.isError, txt(r));
  check("draft says nothing was sent", /Nothing was sent/.test(txt(r)));
  check("draft made no network call", calls.length === 0);
  const q = queue();
  check("one draft on disk", q.length === 1);
  check("draft id is stable", q[0].id === draftId("bug", "thread 502 on deleted root"));
  check("client is filled from the handshake and version", q[0].client === "claude-code/2.1.259 via @twitterapis/mcp@9.9.9");
  check("evidence carries mcp_version", q[0].evidence.mcp_version === "9.9.9");
  check("area kept", q[0].area === "tweet/thread");
}
{
  // Redrafting the same issue replaces, never duplicates.
  const r = await tool({ type: "bug", title: "Thread 502 on deleted root ", details: "updated details" });
  check("redraft replaces", /replaced an earlier draft/.test(txt(r)));
  check("still one draft", queue().length === 1);
  check("details updated", queue()[0].details === "updated details");
}
{
  // The last failing call is attached only where the model left a gap.
  lastError = { tool: "twitter_tweet_thread", path: "/twitter/tweet/thread", status: 502, requestId: "req_9" };
  await tool({ type: "missing_capability", title: "no way to fetch a Space transcript", details: "d", evidence: { status: 418 } });
  const d = queue().find((x) => x.type === "missing_capability");
  check("evidence.tool filled from last error", d.evidence.tool === "twitter_tweet_thread");
  check("evidence.endpoint filled from last error", d.evidence.endpoint === "/twitter/tweet/thread");
  check("model-supplied evidence.status wins", d.evidence.status === 418);
  check("request_id filled", d.evidence.request_id === "req_9");
  lastError = null;
}
{
  const bad1 = await tool({ type: "rant", title: "t", details: "d" });
  check("bad type is an error", bad1.isError && /type is required/.test(txt(bad1)));
  const bad2 = await tool({ type: "idea", title: "", details: "d" });
  check("empty title is an error", bad2.isError && /title is required/.test(txt(bad2)));
  const bad3 = await tool({ type: "idea", title: "t", details: "" });
  check("empty details is an error", bad3.isError && /four labelled bullets/.test(txt(bad3)));
  const bad4 = await tool({ type: "idea", title: "t", details: "d", evidence: { blob: "x".repeat(5000) } });
  check("oversized evidence is an error", bad4.isError && /4096/.test(txt(bad4)));
  check("rejections wrote nothing", queue().length === 2);
}

// ── list ───────────────────────────────────────────────────────────────────
{
  const r = await tool({ action: "list" });
  check("list names both drafts", /2 feedback draft\(s\) pending/.test(txt(r)) && /thread 502/i.test(txt(r)) && /Space transcript/.test(txt(r)));
  check("list makes no network call", calls.length === 0);
}

// ── send ───────────────────────────────────────────────────────────────────
{
  const noIds = await tool({ action: "send" });
  check("send without ids is an error", noIds.isError && /needs ids/.test(txt(noIds)));
  const unknown = await tool({ action: "send", ids: ["deadbeef"] });
  check("unknown id is an error", unknown.isError && /Unknown draft id/.test(txt(unknown)));
  check("no call for a refused send", calls.length === 0);

  const id = draftId("bug", "thread 502 on deleted root");
  const r = await tool({ action: "send", ids: [id] });
  check("send is not an error", !r.isError, txt(r));
  check("exactly one POST", calls.length === 1);
  check("posted to /feedback as JSON body", calls[0].path === "/feedback" && calls[0].method === "POST" && calls[0].jsonBody === true);
  check("body carries the draft fields", calls[0].args.type === "bug" && calls[0].args.details === "updated details" && calls[0].args.client.startsWith("claude-code/"));
  check("reports the server id", /srv-1/.test(txt(r)));
  check("sent draft left the queue", queue().length === 1 && queue()[0].type === "missing_capability");
}
{
  // A failed send keeps the draft.
  nextResponse = () => ({ isError: true, content: [{ type: "text", text: "HTTP 502 (upstream)" }] });
  const id = queue()[0].id;
  const r = await tool({ action: "send", ids: [id] });
  check("failed send is an error result", r.isError === true);
  check("failed send names the draft", new RegExp(id).test(txt(r)) && /stayed in the queue/.test(txt(r)));
  check("draft kept", queue().length === 1);
  nextResponse = () => ({ content: [{ type: "text", text: "{}" }] });
}

// ── discard ────────────────────────────────────────────────────────────────
{
  const id = queue()[0].id;
  const r = await tool({ action: "discard", ids: [id] });
  check("discard confirms", /Discarded 1/.test(txt(r)));
  check("queue empty", queue().length === 0);
  const empty = await tool({ action: "list" });
  check("empty list says so", /No feedback drafts pending/.test(txt(empty)));
}

// ── cap ────────────────────────────────────────────────────────────────────
{
  for (let i = 0; i < QUEUE_CAP; i++) await tool({ type: "idea", title: `idea ${i}`, details: "d" });
  check(`queue holds ${QUEUE_CAP}`, queue().length === QUEUE_CAP);
  const over = await tool({ type: "idea", title: "one too many", details: "d" });
  check("cap refuses the eleventh", over.isError && /already holds/.test(txt(over)));
  check("cap did not write", queue().length === QUEUE_CAP);
  const bad = await tool({ action: "explode" });
  check("unknown action is an error", bad.isError);
}

rmSync(dir, { recursive: true, force: true });
console.log(`feedback: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
