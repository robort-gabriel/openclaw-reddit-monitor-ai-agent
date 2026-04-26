---
name: reddit-comment-hitl
description: Human-in-the-loop rules for posting Reddit comments after Lobster or manual draft approval. Load when the user wants to comment or you are about to use the browser on a post thread.
metadata:
  openclaw:
    requires: []
---

# Reddit — comment HITL

## Rules

1. **No** submission without a prior **`approve draft-N`** (via `comment-from-approval.lobster` or the same string in chat as configured). The default flow may offer two options (**draft-1** and **draft-2**); the user approves one.
2. **Browser:** use the **default** profile (gateway `browser.defaultProfile` in `openclaw.json`). Do not name a `profile` on each browser call. Ensure that default profile is logged into Reddit in your environment. See [Browser tool](https://docs.openclaw.ai/tools/browser).
3. After a **successful** post, **you are done** by default. Optional: run **`archive-posted-comment.lobster`** with `draft_id` (and an optional `comment_url` if the user wants it stored in SQLite). Do not treat the permalink as mandatory.
4. If Reddit shows captcha or login wall: **stop** and ask the user to complete manually; do not bypass.

## New Reddit thread UI (composer / “Join the conversation”)

The main comment area is often a **rich text** surface (ProseMirror-style). Automation that only sets the **outer** accessible node (or uses `fill` without updating editor state) can look “successful” in the tool while Reddit still shows **“The field is required and cannot be empty”** and leaves **Comment** disabled.

- Prefer the recipe from **`post-approved-comment.lobster`**: **`reddit.evaluateFn`** + **`text`** = full draft body on the **textbox** `ref` from a **depth-2–3** snapshot (after opening the composer, e.g. “Go to comments”, if needed).
- If that still fails after one retry, **stop** and ask the user to **paste the draft text manually** and click **Comment**. You may then optionally use `archive-posted-comment.lobster` to mark the draft as posted in SQLite; a permalink in that call is **optional**.
- Avoid huge page snapshots (full thread + sidebar) in a tight loop — it can hit **model TPM** limits on the gateway.

## Drafts (SQLite)

- Drafts are rows in `memory/reddit_monitor.db` (fields `post_url`, `body`, `draft_num`). Create via `create-draft.lobster` or `lobster_upsert_draft.mjs`.

## Rate and etiquette

- Stay within human-like frequency; respect subreddit and site rules. See `AGENTS.md`.
