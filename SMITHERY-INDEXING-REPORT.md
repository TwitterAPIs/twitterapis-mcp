# Smithery: public registry view does not reflect writes that the API confirms

**Reporter:** twitterapis · **Namespace:** `emma-fwab` · **Date:** 2026-09-06

## Summary

Two different write operations were accepted by `api.smithery.ai` and are correctly
reflected there, and neither is reflected on `registry.smithery.ai`. The public view
is what a browsing developer sees, so a server that published successfully appears
to have no capabilities.

## Reproduction

### 1. Publish

```
smithery mcp publish <bundle> -n emma-fwab/twitterapis-mcp
  -> status SUCCESS, release 0bab37a1-c7bc-4dec-8f03-5626d6d8bd3c
```

The uploaded MCPB bundle's manifest carries 99 tools, each with an `inputSchema`
object (verified inside the packed artifact before upload, not inferred).

| host | tools | active bundle |
|---|---|---|
| `api.smithery.ai/servers/emma-fwab%2Ftwitterapis-mcp` | **99** | `0bab37a1` (new) |
| `registry.smithery.ai/servers/emma-fwab%2Ftwitterapis-mcp` | **0** | `454f8fae` (2026-09-04) |

Re-read repeatedly over roughly two hours. The public view did not change.

### 2. Delete

```
DELETE api.smithery.ai/servers/emma-fwab%2Ftwitterapis
  -> HTTP 200, {"success": true, "namespace": "emma-fwab", "server": "twitterapis"}
```

| host | listings under `emma-fwab` |
|---|---|
| `api.smithery.ai/servers?namespace=emma-fwab` | **1** (deleted one returns 404) |
| `registry.smithery.ai/servers?namespace=emma-fwab` | **2** (deleted one still listed) |

Re-checked 30 seconds after deletion, unchanged.

## Why we think it is indexing rather than our publish

The two operations are independent and of opposite kinds, one creating state and
one removing it. Both are correct on the API host and neither has propagated to the
public host. A fault in our bundle could explain the first result but not the
second, and could not explain a deletion failing to appear.

## What we would like to know

1. Is `registry.smithery.ai` expected to converge with `api.smithery.ai`, and on
   what timescale?
2. Is there a promotion or re-index step a publisher is meant to trigger that we
   have missed?
3. Is the `emma-fwab` namespace itself implicated? It was auto-generated rather
   than chosen, and we would separately like to know whether a listing can be
   transferred to a branded namespace without losing its release history.

## Not asking you to fix

The 0-tool state on our own earlier releases was genuinely our fault: our manifest
omitted `inputSchema` per tool, which your publish API correctly rejected with a
400 carrying one error per tool. That is fixed on our side. This report is only
about the two hosts disagreeing after a write both accept.
