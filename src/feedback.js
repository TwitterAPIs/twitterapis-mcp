// src/feedback.js, the local half of twitter_feedback_send.
//
// Claude Code's own feedback tool works like this: the model drafts a report at
// a high-signal moment, the harness writes it to a LOCAL queue, and nothing
// leaves the machine until the user reviews the queue and approves. That
// consent step is what makes it safe to let a model draft freely. This module
// gives twitterapis.com customers the same loop inside whatever MCP client
// they already use: action "draft" appends to ~/.twitterapis/feedback-queue.json
// and sends nothing; "list" shows the drafts; "send" posts ONLY the ids the user
// named to POST /feedback (free, not metered); "discard" drops them.
//
// The tool DESCRIPTION in scripts/tools.overrides.mjs is the product: it names
// the trigger moments and the four-bullet format. This file enforces the same
// rules mechanically so a draft that reaches the server is well-formed, and it
// auto-attaches the evidence the server already holds (the last failing call,
// the client name from the MCP handshake, this package's version), so the model
// never has to type identifiers it might get wrong.
//
// STATE ON DISK, ON PURPOSE. The queue outlives the session: a user can review
// tomorrow what an agent drafted today. Writes are atomic (temp file + rename)
// because two MCP clients can share one home directory.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const QUEUE_CAP = 10;
export const TYPES = ["bug", "idea", "missing_capability"];
export const ACTIONS = ["draft", "list", "send", "discard"];
const MAX = { title: 120, details: 8000, area: 80 };
const EVIDENCE_MAX_BYTES = 4096;

/** Where drafts live. TWITTERAPIS_FEEDBACK_DIR overrides the default ~/.twitterapis. */
export function queuePath(env = process.env) {
  const dir = env.TWITTERAPIS_FEEDBACK_DIR || join(homedir(), ".twitterapis");
  return join(dir, "feedback-queue.json");
}

export function readQueue(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed?.drafts) ? parsed.drafts : [];
  } catch {
    return [];
  }
}

function writeQueue(path, drafts) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 1, drafts }, null, 2) + "\n");
  renameSync(tmp, path);
}

/** Stable per-issue id: the same type + title redrafted replaces itself. */
export function draftId(type, title) {
  return createHash("sha256").update(`${type}\n${title.trim().toLowerCase()}`).digest("hex").slice(0, 8);
}

function clientString(clientInfo, version) {
  const name = clientInfo?.name ? `${clientInfo.name}${clientInfo.version ? `/${clientInfo.version}` : ""}` : "unknown-client";
  return `${name} via @twitterapis/mcp@${version}`;
}

const text = (t, isError = false) => ({ isError, content: [{ type: "text", text: t }] });

function summarize(d) {
  const first = d.details.split("\n")[0].slice(0, 140);
  return `${d.id}  [${d.type}] ${d.title}${d.area ? ` (${d.area})` : ""}  drafted ${d.ts}\n    ${first}`;
}

/**
 * @param {object} deps
 * @param {(path:string, args:object, method:string, jsonBody:boolean)=>Promise<object>} deps.callEndpoint
 * @param {string} deps.version            this package's version
 * @param {() => ({name?:string, version?:string}|undefined)} [deps.getClientInfo]
 * @param {() => (object|null)} [deps.getLastError]   the last failing tool call, if any
 * @param {object} [deps.env]
 */
export function createFeedbackHandler({ callEndpoint, version, getClientInfo, getLastError, env = process.env }) {
  return async function feedbackTool(args = {}) {
    const action = args.action || "draft";
    if (!ACTIONS.includes(action)) return text(`action must be one of ${ACTIONS.join(", ")}.`, true);
    const path = queuePath(env);

    if (action === "draft") {
      if (!TYPES.includes(args.type)) return text(`type is required for a draft and must be one of ${TYPES.join(", ")}.`, true);
      const title = String(args.title ?? "").trim();
      if (!title || title.length > MAX.title) return text(`title is required for a draft, at most ${MAX.title} characters.`, true);
      const details = String(args.details ?? "").trim();
      if (!details || details.length > MAX.details) return text(`details is required for a draft, at most ${MAX.details} characters. Use the four labelled bullets: What happened, What the user said, Repro, Evidence.`, true);
      const area = args.area ? String(args.area).trim().slice(0, MAX.area) : undefined;

      const client = clientString(getClientInfo?.(), version);
      const evidence = { ...(args.evidence && typeof args.evidence === "object" && !Array.isArray(args.evidence) ? args.evidence : {}) };
      const last = getLastError?.();
      // Fill only what the model did not supply: its own evidence wins.
      if (last) {
        if (evidence.tool === undefined && last.tool) evidence.tool = last.tool;
        if (evidence.endpoint === undefined && last.path) evidence.endpoint = last.path;
        if (evidence.status === undefined && last.status) evidence.status = last.status;
        if (evidence.request_id === undefined && last.requestId) evidence.request_id = last.requestId;
      }
      evidence.mcp_version = version;
      evidence.client = client;
      if (Buffer.byteLength(JSON.stringify(evidence), "utf8") > EVIDENCE_MAX_BYTES) {
        return text(`evidence must serialize to ${EVIDENCE_MAX_BYTES} bytes or fewer. Send identifiers (tool, endpoint, status, request id), never payloads.`, true);
      }

      const drafts = readQueue(path);
      const draft = { id: draftId(args.type, title), ts: new Date().toISOString(), type: args.type, title, details, area, evidence, client };
      const idx = drafts.findIndex((d) => d.id === draft.id);
      if (idx >= 0) {
        drafts[idx] = draft;
      } else {
        if (drafts.length >= QUEUE_CAP) {
          return text(`The local feedback queue already holds ${QUEUE_CAP} drafts. Ask the user to review them (action "list", then "send" or "discard") before drafting more.`, true);
        }
        drafts.push(draft);
      }
      writeQueue(path, drafts);
      return text(
        `Queued locally as draft ${draft.id}${idx >= 0 ? " (replaced an earlier draft with the same title)" : ""}. ${drafts.length} draft(s) pending in ${path}. ` +
          `Nothing was sent and nothing needs to be said to the user right now. When the user asks to review or send feedback, call this tool with action "list", ` +
          `then action "send" with only the ids the user names, or "discard".`,
      );
    }

    const drafts = readQueue(path);

    if (action === "list") {
      if (drafts.length === 0) return text(`No feedback drafts pending (${path}).`);
      return text(
        `${drafts.length} feedback draft(s) pending in ${path}. Show these to the user and send only the ids they name:\n\n` +
          drafts.map(summarize).join("\n"),
      );
    }

    const ids = Array.isArray(args.ids) ? args.ids.map(String) : [];
    if (ids.length === 0) return text(`action "${action}" needs ids: the draft ids the user named (from action "list").`, true);
    const unknown = ids.filter((id) => !drafts.some((d) => d.id === id));
    if (unknown.length) return text(`Unknown draft id(s): ${unknown.join(", ")}. Run action "list" to see the current ids.`, true);

    if (action === "discard") {
      const kept = drafts.filter((d) => !ids.includes(d.id));
      writeQueue(path, kept);
      return text(`Discarded ${ids.length} draft(s): ${ids.join(", ")}. ${kept.length} still pending.`);
    }

    // send
    const sent = [];
    const failed = [];
    let remaining = drafts;
    for (const id of ids) {
      const d = drafts.find((x) => x.id === id);
      const body = { type: d.type, title: d.title, details: d.details, evidence: d.evidence, client: d.client };
      if (d.area) body.area = d.area;
      const res = await callEndpoint("/feedback", body, "POST", true);
      const out = res?.content?.[0]?.text ?? "";
      if (res?.isError) {
        failed.push(`${id}: ${out.slice(0, 300)}`);
        continue;
      }
      let serverId = null;
      try { serverId = JSON.parse(out).id ?? null; } catch { /* body was not JSON; keep null */ }
      sent.push(`${id} -> ${serverId ?? "sent"}`);
      remaining = remaining.filter((x) => x.id !== id);
    }
    writeQueue(path, remaining);
    const lines = [];
    if (sent.length) lines.push(`Sent ${sent.length} report(s) to twitterapis.com (free, not metered):\n  ${sent.join("\n  ")}\nCheck one later with twitter_feedback_get using the server id.`);
    if (failed.length) lines.push(`${failed.length} draft(s) stayed in the queue because the send failed:\n  ${failed.join("\n  ")}`);
    lines.push(`${remaining.length} draft(s) still pending.`);
    return text(lines.join("\n\n"), sent.length === 0);
  };
}
