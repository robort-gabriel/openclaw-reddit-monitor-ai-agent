// Fetch post + first-page comments (public .json) for context when drafting.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OpenClawRedditMonitor/1.0";

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
async function httpGet(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

/**
 * Turn a post URL into Reddit API JSON.
 * e.g. https://www.reddit.com/r/x/comments/abc/...  ->  .../.json?raw_json=1&limit=60
 * @param {string} postUrl
 * @returns {string}
 */
export function toThreadJsonUrl(postUrl) {
  const u = String(postUrl).trim();
  if (!u.startsWith("http")) {
    return "";
  }
  try {
    const o = new URL(u);
    if (o.pathname.endsWith(".json")) {
      o.searchParams.set("raw_json", "1");
      o.searchParams.set("limit", "60");
      return o.toString();
    }
    o.pathname = o.pathname.replace(/\/$/, "") + ".json";
    o.search = "";
    o.searchParams.set("raw_json", "1");
    o.searchParams.set("limit", "60");
    return o.toString();
  } catch {
    return "";
  }
}

/**
 * @param {unknown} data
 * @param {string[]} out
 * @param {number} max
 */
function collectCommentBodies(data, out, max) {
  if (!data || out.length >= max) return;
  if (data.body && (data.body !== "[removed]" && data.body !== "[deleted]")) {
    out.push(
      String(data.body)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500)
    );
  }
  const replies = data.replies;
  if (!replies || !replies.data || !Array.isArray(replies.data.children)) return;
  for (const c of replies.data.children) {
    if (out.length >= max) return;
    if (c?.kind === "t1" && c.data) collectCommentBodies(c.data, out, max);
  }
}

/**
 * @param {string} postUrl
 * @param {number} maxTopComments
 * @returns {Promise<{
 *   title: string,
 *   subreddit: string,
 *   selftextPreview: string,
 *   comments: string[],
 *   ok: boolean,
 *   error?: string
 * }>}
 */
export async function fetchThreadContextForDraft(postUrl, maxTopComments = 8) {
  const jurl = toThreadJsonUrl(postUrl);
  if (!jurl) {
    return { title: "", subreddit: "", selftextPreview: "", comments: [], ok: false, error: "bad url" };
  }
  try {
    const text = await httpGet(jurl);
    const arr = JSON.parse(text);
    if (!Array.isArray(arr) || !arr[0]?.data?.children?.[0]) {
      return { title: "", subreddit: "", selftextPreview: "", comments: [], ok: false, error: "unexpected json" };
    }
    const p = arr[0].data.children[0].data;
    const title = p?.title ? String(p.title) : "";
    const subreddit = p?.subreddit ? String(p.subreddit) : "";
    const st = p?.selftext ? String(p.selftext).replace(/\s+/g, " ").trim().slice(0, 2000) : "";
    const comments = [];
    const list = arr[1]?.data?.children;
    if (Array.isArray(list)) {
      for (const c of list) {
        if (comments.length >= maxTopComments) break;
        if (c?.kind === "t1" && c.data) collectCommentBodies(c.data, comments, maxTopComments);
      }
    }
    return { title, subreddit, selftextPreview: st, comments, ok: true };
  } catch (e) {
    return {
      title: "",
      subreddit: "",
      selftextPreview: "",
      comments: [],
      ok: false,
      error: String(e),
    };
  }
}
